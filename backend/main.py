import os
import json
import re
import smtplib
import shutil
import subprocess
import tempfile
import html
import mimetypes
import sqlite3
from pathlib import Path
from urllib.parse import quote_plus, unquote
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from datetime import datetime, date, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from groq import Groq
import requests

load_dotenv()

GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GMAIL_ADDRESS  = os.getenv("GMAIL_ADDRESS", "")
GMAIL_APP_PASS = os.getenv("GMAIL_APP_PASSWORD", "")
SENDER_NAME    = os.getenv("SENDER_NAME", "Abhishek Das")
MODEL          = "llama-3.3-70b-versatile"
BASE_DIR       = Path(__file__).resolve().parent
COVER_LETTER_TEX_PATH = Path(os.getenv("COVER_LETTER_TEX_PATH", str(BASE_DIR / "coverletter.tex")))
if not COVER_LETTER_TEX_PATH.is_absolute():
    COVER_LETTER_TEX_PATH = BASE_DIR / COVER_LETTER_TEX_PATH
RESUME_FILE_ID       = os.getenv("RESUME_FILE_ID", "1JzAj25AsXBa_v0LTTmkmjU02awWyInHK")
DB_PATH              = os.getenv("JOBMAILER_DB_PATH", "jobmailer.db")
STREAK_WHATSAPP_TO   = os.getenv("STREAK_WHATSAPP_TO", "918929797009")
STREAK_EMAIL_TO      = os.getenv("STREAK_EMAIL_TO", GMAIL_ADDRESS)
WHATSAPP_WEBHOOK_URL = os.getenv("WHATSAPP_WEBHOOK_URL", "")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
client = Groq(api_key=GROQ_API_KEY)

applications_db: List[dict] = []
notifications_db: List[dict] = []
_counter = {"id": 0}


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hr_email TEXT NOT NULL,
                hr_name TEXT,
                company TEXT,
                position TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'sent',
                ats_score INTEGER DEFAULT 0,
                sent_at TEXT NOT NULL,
                reply_summary TEXT DEFAULT '',
                resume_filename TEXT DEFAULT '',
                cover_filename TEXT DEFAULT '',
                profile_url TEXT DEFAULT '',
                profile_title TEXT DEFAULT '',
                source TEXT DEFAULT ''
            )
        """)
        existing = {row["name"] for row in conn.execute("PRAGMA table_info(applications)").fetchall()}
        migrations = {
            "hr_email": "TEXT DEFAULT ''",
            "hr_name": "TEXT DEFAULT ''",
            "company": "TEXT DEFAULT ''",
            "position": "TEXT DEFAULT ''",
            "status": "TEXT DEFAULT 'sent'",
            "ats_score": "INTEGER DEFAULT 0",
            "sent_at": "TEXT",
            "reply_summary": "TEXT DEFAULT ''",
            "resume_filename": "TEXT DEFAULT ''",
            "cover_filename": "TEXT DEFAULT ''",
            "profile_url": "TEXT DEFAULT ''",
            "profile_title": "TEXT DEFAULT ''",
            "source": "TEXT DEFAULT ''",
        }
        for column, definition in migrations.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE applications ADD COLUMN {column} {definition}")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS streak_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_date TEXT NOT NULL,
                application_id INTEGER,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER,
                hr_email TEXT NOT NULL,
                from_email TEXT NOT NULL,
                subject TEXT DEFAULT '',
                body TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                thread_id TEXT DEFAULT '',
                received_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL DEFAULT 'reply',
                application_id INTEGER,
                reply_id INTEGER,
                message TEXT NOT NULL,
                company TEXT DEFAULT '',
                hr_name TEXT DEFAULT '',
                read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()


init_db()


# ── Models ────────────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    raw_email: str
    position: str = ""

class RewriteRequest(BaseModel):
    hr_name: str
    company: str
    position: str
    job_description: Optional[str] = ""
    base_resume: str
    base_cover_letter: str = ""

class SendRequest(BaseModel):
    hr_email:             str
    hr_name:              str = ""
    company:              str = ""
    position:             str = ""
    resume_content:       str = ""
    cover_letter_content: str = ""
    ats_score:            int = 0

class RecipientParseRequest(BaseModel):
    hr_email: str
    position: str = ""

class DirectSendRequest(BaseModel):
    hr_email: str
    position: str
    company: Optional[str] = None
    hr_name: Optional[str] = None
    job_description: Optional[str] = ""

class SendAgainRequest(BaseModel):
    application_id: int
    mode: str = "previous"
    position: Optional[str] = None

class ProfileSearchRequest(BaseModel):
    hr_email: str
    hr_name: Optional[str] = ""
    company: Optional[str] = ""

class ReplyWebhookRequest(BaseModel):
    hr_email: str
    subject: str = ""
    body: str = ""
    thread_id: Optional[str] = ""
    received_at: Optional[str] = None


# ── Groq Helper ───────────────────────────────────────────────────

def clean_json_string(raw: str) -> str:
    """Strip markdown fences and fix control characters."""
    # Remove ```json ... ``` or ``` ... ```
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    raw = re.sub(r"\s*```$", "", raw.strip())

    # Replace literal \n \t inside JSON string values with escaped versions
    # so json.loads doesn't choke on real newlines inside strings
    raw = raw.replace("\r\n", "\\n").replace("\r", "\\n")

    # Only replace newlines that appear INSIDE json string values (between quotes)
    # Safe approach: use a full clean pass
    cleaned = []
    in_string = False
    escape_next = False
    for ch in raw:
        if escape_next:
            cleaned.append(ch)
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            cleaned.append(ch)
            continue
        if ch == '"':
            in_string = not in_string
            cleaned.append(ch)
            continue
        if in_string and ch == "\n":
            cleaned.append("\\n")
            continue
        if in_string and ch == "\t":
            cleaned.append("\\t")
            continue
        cleaned.append(ch)

    return "".join(cleaned).strip()


def groq_json(prompt: str, temperature: float = 0.3) -> dict:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    raw = response.choices[0].message.content.strip()
    cleaned = clean_json_string(raw)
    return json.loads(cleaned)


# ── Gmail SMTP Helper ─────────────────────────────────────────────

PUBLIC_EMAIL_DOMAINS = {
    "gmail", "googlemail", "yahoo", "ymail", "rocketmail", "hotmail", "outlook", "live",
    "msn", "icloud", "me", "mac", "aol", "proton", "protonmail", "pm", "zoho", "gmx",
    "mail", "rediffmail", "rediff", "yandex", "hey", "fastmail",
}

COMMON_SECOND_LEVEL_SUFFIXES = {"co", "com", "net", "org", "ac", "edu", "gov"}


def send_via_smtp(to: str, subject: str, plain_text: str, html_body: str, attachments: Optional[List[dict]] = None):
    if not GMAIL_ADDRESS or not GMAIL_APP_PASS:
        raise ValueError("GMAIL_ADDRESS or GMAIL_APP_PASSWORD missing in .env")
    msg = MIMEMultipart("mixed")
    msg["From"]    = f"{SENDER_NAME} <{GMAIL_ADDRESS}>"
    msg["To"]      = to
    msg["Subject"] = subject

    body = MIMEMultipart("alternative")
    body.attach(MIMEText(plain_text, "plain"))
    body.attach(MIMEText(html_body,  "html"))
    msg.attach(body)

    for attachment in attachments or []:
        filename = attachment["filename"]
        content = attachment["content"]
        content_type = attachment.get("content_type") or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        maintype, subtype = content_type.split("/", 1)
        if maintype != "application":
            subtype = "octet-stream"
        part = MIMEApplication(content, _subtype=subtype)
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
        server.sendmail(GMAIL_ADDRESS, to, msg.as_string())


# ── Direct Application Helpers ───────────────────────────────────

def normalize_email(email: str) -> str:
    email = email.strip().lower().replace(" ", "")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise ValueError("Enter a valid recruiter email address")
    return email


def title_from_token(value: str) -> str:
    value = re.sub(r"\d+", "", value)
    parts = [p for p in re.split(r"[._+\-]+", value) if p]
    if not parts:
        return ""
    return " ".join(p.capitalize() for p in parts[:2])


def domain_company_token(domain: str) -> str:
    parts = domain.split(".")
    if len(parts) >= 3 and parts[-2] in COMMON_SECOND_LEVEL_SUFFIXES:
        return parts[-3]
    return parts[-2] if len(parts) >= 2 else parts[0]


def heuristic_recipient_from_email(email: str, position: str = "") -> dict:
    clean_email = normalize_email(email)
    local, domain = clean_email.split("@", 1)
    company_token = domain_company_token(domain)
    is_personal = company_token in PUBLIC_EMAIL_DOMAINS
    local_parts = [p for p in re.split(r"[._+\-]+", local) if p]

    if is_personal:
        hr_name = title_from_token(local_parts[0] if local_parts else local)
        company = ""
        company_needs_review = True
    else:
        hr_name = title_from_token(local)
        company = company_token.capitalize()
        company_needs_review = False

    return {
        "hr_email": clean_email,
        "hr_name": hr_name,
        "company": company,
        "position": position,
        "is_personal_domain": is_personal,
        "company_needs_review": company_needs_review,
        "confidence": "medium" if is_personal else "high",
        "source": "heuristic",
    }


def parse_recipient_smart(email: str, position: str = "") -> dict:
    fallback = heuristic_recipient_from_email(email, position)
    if not GROQ_API_KEY:
        return fallback

    try:
        ai = groq_json(f"""
You parse recruiter email addresses for a job application sender.
Return ONLY a JSON object with exactly these keys:
hr_email, hr_name, company, position, is_personal_domain, company_needs_review, confidence, source.

Rules:
- Never invent a company for public mailbox providers like gmail, outlook, yahoo, hotmail, icloud, proton, zoho, rediffmail.
- For public mailbox providers, company must be "" and company_needs_review must be true.
- For corporate domains, infer company from the registrable domain, e.g. pallavi@optum.com -> Optum.
- Infer a human recruiter name from the local part. For personal emails, prefer the first meaningful name token.
- Keep hr_email normalized lowercase.
- confidence must be one of: low, medium, high.
- source must be "groq".

Email: {fallback["hr_email"]}
Position: {position}
Heuristic hint: {json.dumps(fallback)}
""", temperature=0.1)
        ai["hr_email"] = fallback["hr_email"]
        ai["position"] = position
        ai["source"] = "groq"
        if fallback["is_personal_domain"]:
            ai["company"] = ""
            ai["is_personal_domain"] = True
            ai["company_needs_review"] = True
        return {**fallback, **ai}
    except Exception:
        return fallback


def google_drive_download_url(file_id: str) -> str:
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def download_binary(url: str, expected_prefix: Optional[bytes], label: str) -> bytes:
    try:
        response = requests.get(url, timeout=30, allow_redirects=True)
    except requests.RequestException as exc:
        raise ValueError(f"Could not download {label}: {exc}") from exc
    if response.status_code != 200 or not response.content:
        raise ValueError(f"Could not download {label}. Check sharing/export permissions.")
    if expected_prefix and not response.content.startswith(expected_prefix):
        raise ValueError(f"Downloaded {label} is not in the expected format.")
    return response.content


def today_label() -> str:
    now = datetime.now()
    return f"{now.strftime('%B')} {now.day}, {now.year}"


def replace_template_fields(text: str, replacements: dict) -> str:
    aliases = [
        ("{{Date}}", replacements["date"]),
        ("{Date}}", replacements["date"]),
        ("{Date}", replacements["date"]),
        ("<<DATE>>", replacements["date"]),
        ("{{Subject1}}", replacements["position"]),
        ("{Subject1}}", replacements["position"]),
        ("{Subject1}", replacements["position"]),
        ("{{Subject2}}", replacements["position"]),
        ("{Subject2}}", replacements["position"]),
        ("{Subject2}", replacements["position"]),
        ("{{Position}}", replacements["position"]),
        ("{Position}", replacements["position"]),
        ("<<POSITION>>", replacements["position"]),
        ("{{recruiterName}}", replacements["recruiter_name"]),
        ("{recruiterName}}", replacements["recruiter_name"]),
        ("{recruiterName}", replacements["recruiter_name"]),
        ("{{RecruiterName}}", replacements["recruiter_name"]),
        ("{RecruiterName}", replacements["recruiter_name"]),
        ("<<RECRUITER_NAME>>", replacements["recruiter_name"]),
        ("{{CompanyName}}", replacements["company_name"]),
        ("{CompanyName}}", replacements["company_name"]),
        ("{CompanyName}", replacements["company_name"]),
        ("<<COMPANY_NAME>>", replacements["company_name"]),
        ("CompanyName", replacements["company_name"]),
    ]
    for token, value in aliases:
        text = text.replace(token, value)
    return text


LATEX_ESCAPE_MAP = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def latex_escape(value: str) -> str:
    return "".join(LATEX_ESCAPE_MAP.get(ch, ch) for ch in str(value or ""))


def cover_letter_replacements(recipient: dict, position: str, company_override: Optional[str] = None) -> dict:
    company = (company_override or recipient.get("company") or "").strip()
    return {
        "date": today_label(),
        "position": position.strip() or "the open role",
        "recruiter_name": (recipient.get("hr_name") or "Hiring Team").strip(),
        "company_name": company or "your organization",
    }


def build_personalized_cover_letter_tex(
    recipient: dict,
    position: str,
    company_override: Optional[str] = None,
    cover_sections: Optional[List[dict]] = None,
) -> str:
    if not COVER_LETTER_TEX_PATH.exists():
        raise ValueError(f"Cover letter template not found: {COVER_LETTER_TEX_PATH}")

    template = COVER_LETTER_TEX_PATH.read_text(encoding="utf-8")
    raw_replacements = cover_letter_replacements(recipient, position, company_override)
    replacements = {key: latex_escape(value) for key, value in raw_replacements.items()}
    tex_source = replace_template_fields(template, replacements)

    if cover_sections:
        section_blocks = []
        for section in cover_sections[:4]:
            title = latex_escape((section.get("title") or "").strip() or "Why Me")
            body = latex_escape((section.get("body") or "").strip())
            if body:
                section_blocks.append(f"\\lettersection{{{title}}}\n{body}")
        if section_blocks:
            tailored_content = "\\begin{cvletter}\n\n" + "\n\n".join(section_blocks) + "\n\n\\end{cvletter}"
            tex_source = re.sub(
                r"\\begin\{cvletter\}.*?\\end\{cvletter\}",
                lambda _: tailored_content,
                tex_source,
                flags=re.S,
                count=1,
            )

    # Keep older templates working even if they do not expose date/title placeholders yet.
    tex_source = re.sub(
        r"\\letterdate\{\\today\}",
        lambda _: f"\\letterdate{{{replacements['date']}}}",
        tex_source,
        count=1,
    )
    tex_source = re.sub(
        r"\\lettertitle\{Job Application for Software Engineer\}",
        lambda _: f"\\lettertitle{{Job Application for {replacements['position']}}}",
        tex_source,
        count=1,
    )

    unresolved = re.findall(
        r"\{\{\s*[A-Za-z0-9_]+\s*\}\}|<<\s*[A-Z0-9_]+\s*>>|"
        r"\{(?:Date|Subject1|Subject2|Position|RecruiterName|recruiterName|CompanyName)\}",
        tex_source,
    )
    if unresolved:
        unique = ", ".join(sorted(set(unresolved))[:6])
        raise ValueError(f"Cover letter still has unresolved template fields in coverletter.tex: {unique}")
    return tex_source


def compile_cover_letter_tex(tex_source: str) -> Optional[bytes]:
    local_tectonic = BASE_DIR / "bin" / "tectonic"
    compilers = []
    if local_tectonic.exists() and os.access(local_tectonic, os.X_OK):
        compilers.append(str(local_tectonic))
    for name in ("tectonic", "xelatex", "lualatex", "pdflatex"):
        compiler = shutil.which(name)
        if compiler and compiler not in compilers:
            compilers.append(compiler)
    if not compilers:
        raise ValueError("No LaTeX compiler found. Keep backend/bin/tectonic or install xelatex.")

    errors = []
    with tempfile.TemporaryDirectory(prefix="jobmailer-cover-") as tmp_name:
        tmp_dir = Path(tmp_name)
        tex_file = tmp_dir / "coverletter.tex"
        tex_file.write_text(tex_source, encoding="utf-8")

        for pattern in ("*.cls", "*.sty"):
            for asset in COVER_LETTER_TEX_PATH.parent.glob(pattern):
                shutil.copy2(asset, tmp_dir / asset.name)
        for dirname in ("fonts", "assets"):
            source_dir = COVER_LETTER_TEX_PATH.parent / dirname
            if source_dir.is_dir():
                shutil.copytree(source_dir, tmp_dir / dirname, dirs_exist_ok=True)

        for compiler in compilers:
            compiler_name = Path(compiler).name.lower()
            if compiler_name == "tectonic":
                command = [
                    compiler,
                    "--keep-logs",
                    "--keep-intermediates",
                    "--reruns",
                    "1",
                    "--outdir",
                    str(tmp_dir),
                    str(tex_file),
                ]
                passes = 1
            else:
                command = [
                    compiler,
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-output-directory",
                    str(tmp_dir),
                    str(tex_file),
                ]
                passes = 2

            result = None
            for _ in range(passes):
                try:
                    result = subprocess.run(
                        command,
                        cwd=tmp_dir,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        timeout=90,
                        check=False,
                    )
                except (subprocess.SubprocessError, OSError) as exc:
                    errors.append(f"{compiler_name}: {exc}")
                    break
                if result.returncode != 0:
                    output = result.stdout.decode("utf-8", errors="replace")
                    errors.append(f"{compiler_name}: {output[-1200:]}")
                    break

            pdf_file = tmp_dir / "coverletter.pdf"
            if result and result.returncode == 0 and pdf_file.exists():
                pdf_bytes = pdf_file.read_bytes()
                if pdf_bytes.startswith(b"%PDF"):
                    return pdf_bytes

    detail = "\n".join(errors[-2:]).strip()
    raise ValueError(f"Could not compile Awesome-CV cover letter.{(' ' + detail) if detail else ''}")


def build_cover_letter_pdf(
    recipient: dict,
    position: str,
    company_override: Optional[str] = None,
    cover_sections: Optional[List[dict]] = None,
) -> bytes:
    tex_source = build_personalized_cover_letter_tex(recipient, position, company_override, cover_sections)
    return compile_cover_letter_tex(tex_source)


CANDIDATE_CONTEXT = """
Abhishek Das is a recent MCA graduate focused on Python, SQL, data analysis, data reporting,
Power BI dashboards, and practical data workflows. Highlights include supply-chain analysis
that identified $250,000 in annual savings, Power BI dashboards used by 30+ team members,
a churn prediction model with 87% accuracy, and a transport delay prediction system with
85% accuracy. Keep claims truthful and do not invent employer experience, certifications, or
tools that are not implied by this context.
""".strip()


def fallback_tailored_copy(position: str, company: str = "") -> dict:
    company_phrase = f" at {company}" if company else ""
    return {
        "email_body": (
            f"I am reaching out to share my application for the {position} role{company_phrase}. "
            "I have attached my resume and a tailored cover letter for your review.\n\n"
            "I would be grateful if you could consider my profile for this opportunity. "
            "Please feel free to contact me on this email for any follow-up or future reference."
        ),
        "match_summary": [],
        "cover_sections": [],
    }


def clean_tailored_copy(raw: dict, position: str, company: str = "") -> dict:
    fallback = fallback_tailored_copy(position, company)
    if not isinstance(raw, dict):
        return fallback

    email_body = str(raw.get("email_body") or "").strip()
    if not email_body:
        email_body = fallback["email_body"]

    sections = []
    for section in raw.get("cover_sections") or []:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title") or "").strip()
        body = str(section.get("body") or "").strip()
        if title and body:
            sections.append({"title": title[:80], "body": body[:1200]})

    match_summary = []
    for item in raw.get("match_summary") or []:
        value = str(item or "").strip()
        if value:
            match_summary.append(value[:180])

    return {
        "email_body": email_body[:2200],
        "match_summary": match_summary[:4],
        "cover_sections": sections[:4],
    }


def generate_tailored_application_copy(recipient: dict, position: str, job_description: str) -> dict:
    company = (recipient.get("company") or "").strip()
    if not job_description.strip() or not GROQ_API_KEY:
        return fallback_tailored_copy(position, company)

    try:
        raw = groq_json(f"""
You are writing a concise, truthful job application email and cover letter for Abhishek Das.
Use the job description to emphasize relevant fit, but do not invent facts beyond the candidate context.

Candidate context:
{CANDIDATE_CONTEXT}

Role: {position}
Company: {company or "Not specified"}
Recruiter: {recipient.get("hr_name") or "Hiring Team"}

Job description:
{job_description[:4500]}

Return ONLY a valid JSON object with exactly these keys:
{{
  "email_body": "2 short paragraphs for the email body, no greeting or sign-off",
  "match_summary": ["short match point 1", "short match point 2", "short match point 3"],
  "cover_sections": [
    {{"title": "About Me", "body": "one concise paragraph"}},
    {{"title": "Why This Role", "body": "one concise paragraph tied to the job description"}},
    {{"title": "Why Me", "body": "one concise paragraph tied to the candidate context"}}
  ]
}}
""", temperature=0.35)
        return clean_tailored_copy(raw, position, company)
    except Exception:
        return fallback_tailored_copy(position, company)


def get_resume_pdf() -> bytes:
    return download_binary(google_drive_download_url(RESUME_FILE_ID), b"%PDF", "resume PDF")


def safe_filename_part(value: str, fallback: str = "Company") -> str:
    clean = re.sub(r"[^A-Za-z0-9]+", "_", (value or fallback).strip()).strip("_")
    return clean or fallback


def discover_profiles(email: str, hr_name: str = "", company: str = "") -> List[dict]:
    query_bits = [email]
    if hr_name:
        query_bits.append(hr_name)
    if company:
        query_bits.append(company)
    query_bits.append("LinkedIn")
    url = f"https://duckduckgo.com/html/?q={quote_plus(' '.join(query_bits))}"
    try:
        response = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
    except requests.RequestException:
        return []
    if response.status_code != 200:
        return []

    found = []
    seen = set()
    for raw in re.findall(r"https?://[^\"'<> ]+", response.text):
        link = html.unescape(unquote(raw))
        if "linkedin.com/in/" not in link and "linkedin.com/pub/" not in link:
            continue
        link = link.split("&")[0].split("?")[0]
        if link in seen:
            continue
        seen.add(link)
        found.append({
            "type": "linkedin",
            "title": f"{hr_name or 'Recruiter'} LinkedIn profile",
            "url": link,
            "confidence": "low",
        })
        if len(found) >= 2:
            break
    return found


def insert_application(app_data: dict) -> dict:
    with db_conn() as conn:
        cur = conn.execute("""
            INSERT INTO applications (
                hr_email, hr_name, company, position, status, ats_score, sent_at,
                reply_summary, resume_filename, cover_filename, profile_url, profile_title, source
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_data.get("hr_email", ""),
            app_data.get("hr_name", ""),
            app_data.get("company", ""),
            app_data.get("position", ""),
            app_data.get("status", "sent"),
            app_data.get("ats_score", 0),
            app_data.get("sent_at", datetime.utcnow().isoformat()),
            app_data.get("reply_summary", ""),
            app_data.get("resume_filename", ""),
            app_data.get("cover_filename", ""),
            app_data.get("profile_url", ""),
            app_data.get("profile_title", ""),
            app_data.get("source", ""),
        ))
        app_id = cur.lastrowid
        conn.commit()
    saved = dict(app_data)
    saved["id"] = app_id
    return saved


def list_applications() -> List[dict]:
    with db_conn() as conn:
        rows = conn.execute("SELECT * FROM applications ORDER BY datetime(sent_at) DESC, id DESC").fetchall()
        apps = []
        for row in rows:
            app_row = dict(row)
            reply = conn.execute("""
                SELECT subject, summary, received_at
                FROM replies
                WHERE application_id = ?
                ORDER BY datetime(received_at) DESC, id DESC
                LIMIT 1
            """, (app_row["id"],)).fetchone()
            app_row.setdefault("hr_email", "")
            app_row.setdefault("hr_name", "")
            app_row.setdefault("company", "")
            app_row.setdefault("position", "")
            app_row.setdefault("status", "sent")
            app_row.setdefault("ats_score", 0)
            app_row.setdefault("reply_summary", "")
            app_row.setdefault("resume_filename", "")
            app_row.setdefault("cover_filename", "")
            app_row.setdefault("profile_url", "")
            app_row.setdefault("profile_title", "")
            if reply:
                app_row["has_reply"] = True
                app_row["last_reply_at"] = reply["received_at"]
                app_row["latest_reply_subject"] = reply["subject"]
                app_row["latest_reply_summary"] = reply["summary"]
            else:
                app_row["has_reply"] = False
                app_row["last_reply_at"] = ""
                app_row["latest_reply_subject"] = ""
                app_row["latest_reply_summary"] = ""
            apps.append(app_row)
    return apps


def get_application(app_id: int) -> Optional[dict]:
    with db_conn() as conn:
        row = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    return dict(row) if row else None


def list_contacts() -> List[dict]:
    contacts = {}
    for app_row in list_applications():
        email = (app_row.get("hr_email") or "").strip().lower()
        if not email:
            continue
        if email not in contacts:
            contacts[email] = {
                "hr_email": email,
                "hr_name": app_row.get("hr_name", ""),
                "company": app_row.get("company", ""),
                "latest_application_id": app_row.get("id"),
                "last_position": app_row.get("position", ""),
                "last_sent_at": app_row.get("sent_at", ""),
                "send_count": 0,
                "positions": [],
                "has_reply": False,
                "last_reply_at": "",
                "latest_reply_summary": "",
            }
        contact = contacts[email]
        contact["send_count"] += 1
        position = app_row.get("position", "")
        if position and position not in contact["positions"]:
            contact["positions"].append(position)
        if app_row.get("has_reply") and not contact["has_reply"]:
            contact["has_reply"] = True
            contact["last_reply_at"] = app_row.get("last_reply_at", "")
            contact["latest_reply_summary"] = app_row.get("latest_reply_summary", "")
    return sorted(contacts.values(), key=lambda c: c.get("last_sent_at") or "", reverse=True)


def record_streak_event(application_id: int) -> dict:
    today = date.today().isoformat()
    now = datetime.utcnow().isoformat()
    with db_conn() as conn:
        conn.execute(
            "INSERT INTO streak_events (event_date, application_id, created_at) VALUES (?, ?, ?)",
            (today, application_id, now),
        )
        conn.commit()
    return get_streak()


def get_streak() -> dict:
    with db_conn() as conn:
        rows = conn.execute("SELECT DISTINCT event_date FROM streak_events ORDER BY event_date DESC").fetchall()
        total = conn.execute("SELECT COUNT(*) AS c FROM streak_events").fetchone()["c"]
        today_count = conn.execute("SELECT COUNT(*) AS c FROM streak_events WHERE event_date = ?", (date.today().isoformat(),)).fetchone()["c"]
    dates = {date.fromisoformat(row["event_date"]) for row in rows}
    current = 0
    cursor = date.today()
    if cursor not in dates and cursor - timedelta(days=1) in dates:
        cursor = cursor - timedelta(days=1)
    while cursor in dates:
        current += 1
        cursor -= timedelta(days=1)
    best = 0
    run = 0
    previous = None
    for d in sorted(dates):
        if previous and d == previous + timedelta(days=1):
            run += 1
        else:
            run = 1
        best = max(best, run)
        previous = d
    return {
        "current_streak": current,
        "best_streak": best,
        "total_sends": total,
        "today_sends": today_count,
        "goal": 3,
        "goal_complete": today_count >= 3,
        "whatsapp_to": STREAK_WHATSAPP_TO,
        "email_to": STREAK_EMAIL_TO,
        "whatsapp_configured": bool(WHATSAPP_WEBHOOK_URL),
    }


def get_streak_history() -> dict:
    with db_conn() as conn:
        rows = conn.execute("""
            SELECT
                se.id AS event_id,
                se.event_date,
                se.created_at,
                a.id AS application_id,
                a.hr_email,
                a.hr_name,
                a.company,
                a.position,
                a.status
            FROM streak_events se
            LEFT JOIN applications a ON a.id = se.application_id
            ORDER BY date(se.event_date) DESC, datetime(se.created_at) DESC, se.id DESC
        """).fetchall()
    days = []
    by_date = {}
    for row in rows:
        event_date = row["event_date"]
        if event_date not in by_date:
            by_date[event_date] = {
                "event_date": event_date,
                "total_sends": 0,
                "sends": [],
            }
            days.append(by_date[event_date])
        day = by_date[event_date]
        day["total_sends"] += 1
        day["sends"].append({
            "event_id": row["event_id"],
            "application_id": row["application_id"],
            "hr_email": row["hr_email"] or "",
            "hr_name": row["hr_name"] or "",
            "company": row["company"] or "",
            "position": row["position"] or "",
            "status": row["status"] or "sent",
            "created_at": row["created_at"],
        })
    return {**get_streak(), "days": days}


def notify_streak(streak: dict, app_data: dict):
    message = (
        f"JobMailer streak update: {streak['current_streak']} day streak. "
        f"Sent {app_data.get('position')} application to {app_data.get('hr_email')}."
    )
    if STREAK_EMAIL_TO:
        try:
            send_via_smtp(
                STREAK_EMAIL_TO,
                "JobMailer streak update",
                message,
                f"<div style='font-family:Arial,sans-serif;text-align:left;color:#111;line-height:1.6'><p>{html.escape(message)}</p></div>",
            )
        except Exception:
            pass
    if WHATSAPP_WEBHOOK_URL:
        try:
            requests.post(WHATSAPP_WEBHOOK_URL, json={"to": STREAK_WHATSAPP_TO, "message": message}, timeout=10)
        except requests.RequestException:
            pass


def compact_text(value: str, limit: int = 220) -> str:
    clean = re.sub(r"\s+", " ", (value or "")).strip()
    if len(clean) <= limit:
        return clean
    return clean[: limit - 1].rstrip() + "..."


def summarize_reply(subject: str, body: str) -> str:
    fallback = compact_text(body, 220) or compact_text(subject, 120) or "New recruiter reply received"
    if not GROQ_API_KEY:
        return fallback
    try:
        data = groq_json(f"""
Summarize this recruiter reply in one concise sentence for a job application dashboard.
Return ONLY JSON: {{"summary": "sentence"}}

Subject: {subject}
Body: {body[:3000]}
""", temperature=0.15)
        return compact_text(data.get("summary", fallback), 220) or fallback
    except Exception:
        return fallback


def classify_reply_status(subject: str, body: str) -> str:
    text = f"{subject} {body}".lower()
    if any(token in text for token in ["interview", "schedule", "calendly", "meet", "call"]):
        return "interview_scheduled"
    if any(token in text for token in ["unfortunately", "not moving forward", "regret", "rejected"]):
        return "rejected"
    if any(token in text for token in ["received", "under review", "reviewing", "shortlist"]):
        return "application_received"
    if any(token in text for token in ["follow up", "follow-up", "additional information"]):
        return "follow_up"
    return "reply_received"


def find_application_for_reply(email: str) -> Optional[dict]:
    clean_email = email.strip().lower()
    with db_conn() as conn:
        row = conn.execute("""
            SELECT *
            FROM applications
            WHERE lower(hr_email) = ?
            ORDER BY datetime(sent_at) DESC, id DESC
            LIMIT 1
        """, (clean_email,)).fetchone()
    return dict(row) if row else None


def create_notification(message: str, app_row: Optional[dict], reply_id: Optional[int] = None) -> dict:
    now = datetime.utcnow().isoformat()
    with db_conn() as conn:
        cur = conn.execute("""
            INSERT INTO notifications (type, application_id, reply_id, message, company, hr_name, read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        """, (
            "reply",
            app_row.get("id") if app_row else None,
            reply_id,
            message,
            app_row.get("company", "") if app_row else "",
            app_row.get("hr_name", "") if app_row else "",
            now,
        ))
        conn.commit()
        row = conn.execute("SELECT * FROM notifications WHERE id = ?", (cur.lastrowid,)).fetchone()
    notif = dict(row)
    notif["read"] = bool(notif["read"])
    return notif


def insert_reply_event(req: ReplyWebhookRequest) -> dict:
    try:
        from_email = normalize_email(req.hr_email)
    except ValueError:
        from_email = req.hr_email.strip().lower()
    received_at = req.received_at or datetime.utcnow().isoformat()
    created_at = datetime.utcnow().isoformat()
    app_row = find_application_for_reply(from_email)
    summary = summarize_reply(req.subject, req.body)
    status = classify_reply_status(req.subject, req.body)

    with db_conn() as conn:
        cur = conn.execute("""
            INSERT INTO replies (
                application_id, hr_email, from_email, subject, body, summary, thread_id, received_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            app_row.get("id") if app_row else None,
            app_row.get("hr_email", from_email) if app_row else from_email,
            from_email,
            req.subject,
            req.body,
            summary,
            req.thread_id or "",
            received_at,
            created_at,
        ))
        reply_id = cur.lastrowid
        if app_row:
            conn.execute(
                "UPDATE applications SET status = ?, reply_summary = ? WHERE id = ?",
                (status, summary, app_row["id"]),
            )
        conn.commit()

    if app_row:
        app_row = get_application(app_row["id"]) or app_row
    message_target = app_row.get("position", "application") if app_row else "unknown application"
    message = f"New reply from {from_email} for {message_target}: {summary}"
    notification = create_notification(message, app_row, reply_id)
    reply = get_reply(reply_id)
    return {"reply": reply, "notification": notification, "application": app_row}


def get_reply(reply_id: int) -> Optional[dict]:
    with db_conn() as conn:
        row = conn.execute("""
            SELECT
                r.*,
                a.company,
                a.hr_name,
                a.position,
                a.status
            FROM replies r
            LEFT JOIN applications a ON a.id = r.application_id
            WHERE r.id = ?
        """, (reply_id,)).fetchone()
    return dict(row) if row else None


def list_replies(limit: int = 8) -> List[dict]:
    safe_limit = max(1, min(limit, 50))
    with db_conn() as conn:
        rows = conn.execute("""
            SELECT
                r.*,
                a.company,
                a.hr_name,
                a.position,
                a.status
            FROM replies r
            LEFT JOIN applications a ON a.id = r.application_id
            ORDER BY datetime(r.received_at) DESC, r.id DESC
            LIMIT ?
        """, (safe_limit,)).fetchall()
    return [dict(row) for row in rows]


def list_notifications() -> List[dict]:
    with db_conn() as conn:
        rows = conn.execute("""
            SELECT *
            FROM notifications
            WHERE read = 0
            ORDER BY datetime(created_at) DESC, id DESC
        """).fetchall()
    notifs = []
    for row in rows:
        notif = dict(row)
        notif["read"] = bool(notif["read"])
        notifs.append(notif)
    return notifs


# ── Health ────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status":           "ok",
        "model":            MODEL,
        "groq_configured":  bool(GROQ_API_KEY),
        "gmail_configured": bool(GMAIL_ADDRESS and GMAIL_APP_PASS),
        "sender":           SENDER_NAME,
        "timestamp":        datetime.utcnow().isoformat(),
    }


# ── Extract HR Info ───────────────────────────────────────────────

@app.post("/api/extract")
def extract_info(req: ExtractRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY missing in .env")
    try:
        return groq_json(f"""
Extract HR contact info from the text below.
Return ONLY a JSON object with these exact keys:
  hr_name  : full name of HR person (or empty string)
  hr_email : HR email address (or empty string)
  company  : company name (or empty string)
  position : job position (use hint if not found)

Text: {req.raw_email}
Position hint: {req.position}
""", temperature=0.2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extract error: {str(e)}")


@app.post("/api/parse-recipient")
def parse_recipient(req: RecipientParseRequest):
    try:
        parsed = parse_recipient_smart(req.hr_email, req.position)
        parsed["profiles"] = discover_profiles(parsed["hr_email"], parsed.get("hr_name", ""), parsed.get("company", ""))
        return parsed
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recipient parse error: {str(e)}")


@app.post("/api/profile-search")
def profile_search(req: ProfileSearchRequest):
    try:
        email = normalize_email(req.hr_email)
        return {"profiles": discover_profiles(email, req.hr_name or "", req.company or "")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Rewrite Resume + Cover Letter ─────────────────────────────────

@app.post("/api/rewrite")
def rewrite_resume(req: RewriteRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY missing in .env")

    jd_block = f"Job Description: {req.job_description}" if req.job_description else ""

    try:
        return groq_json(f"""
You are a professional resume writer and ATS optimization expert.
Rewrite for: {req.hr_name} at {req.company}, Role: {req.position}
{jd_block}

Base Resume: {req.base_resume[:3000]}
Base Cover Letter: {req.base_cover_letter[:1000] if req.base_cover_letter.strip() else "Write from scratch."}

IMPORTANT: Return ONLY a valid JSON object. Use \\n for line breaks inside strings. No raw newlines inside string values.

Return JSON with exactly these keys:
{{
  "resume": "rewritten resume text with \\n for line breaks",
  "cover_letter": "cover letter text with \\n for line breaks",
  "ats_score": 85,
  "improvements": ["improvement 1", "improvement 2", "improvement 3", "improvement 4", "improvement 5"]
}}
""", temperature=0.4)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rewrite error: {str(e)}")


# ── Send Email via Gmail SMTP ─────────────────────────────────────

@app.post("/api/send")
def send_email(req: SendRequest):
    if not GMAIL_ADDRESS or not GMAIL_APP_PASS:
        raise HTTPException(status_code=500, detail="GMAIL_ADDRESS or GMAIL_APP_PASSWORD missing in .env")

    subject = f"Application for {req.position} — {SENDER_NAME}"

    plain = f"Dear {req.hr_name},\n\n{req.cover_letter_content}\n\nBest regards,\n{SENDER_NAME}\n{GMAIL_ADDRESS}"

    cover_paragraphs = "".join(
        f"<p>{line}</p>"
        for line in req.cover_letter_content.replace("\\n", "\n").split("\n")
        if line.strip()
    )
    html = f"""
<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.75;max-width:620px;margin:0 auto">
  <p>Dear <strong>{req.hr_name}</strong>,</p>
  {cover_paragraphs}
  <br>
  <hr style="border:none;border-top:1px solid #e5e5e5">
  <p style="font-size:11px;color:#999">Resume: {req.resume_content[:200].strip()}...</p>
  <br>
  <p>Best regards,<br><strong>{SENDER_NAME}</strong><br>
  <span style="color:#666;font-size:12px">{GMAIL_ADDRESS}</span></p>
</div>"""

    try:
        send_via_smtp(req.hr_email, subject, plain, html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")

    saved = insert_application({
        "hr_email":  req.hr_email,
        "hr_name":   req.hr_name,
        "company":   req.company,
        "position":  req.position,
        "ats_score": req.ats_score,
        "sent_at":   datetime.utcnow().isoformat(),
        "status":    "sent",
        "source":    "manual",
    })
    streak = record_streak_event(saved["id"])
    notify_streak(streak, saved)

    return {
        "status": "success",
        "message": f"Email sent to {req.hr_name} <{req.hr_email}>",
        "application": saved,
        "streak": streak,
    }


@app.post("/api/direct-send")
def direct_send(req: DirectSendRequest):
    if not GMAIL_ADDRESS or not GMAIL_APP_PASS:
        raise HTTPException(status_code=500, detail="GMAIL_ADDRESS or GMAIL_APP_PASSWORD missing in .env")

    if not req.position.strip():
        raise HTTPException(status_code=400, detail="Position is required")

    try:
        recipient = parse_recipient_smart(req.hr_email, req.position)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if req.hr_name and req.hr_name.strip():
        recipient["hr_name"] = req.hr_name.strip()
    if req.company and req.company.strip():
        recipient["company"] = req.company.strip()
        recipient["company_needs_review"] = False
    profiles = discover_profiles(recipient["hr_email"], recipient.get("hr_name", ""), recipient.get("company", ""))
    primary_profile = profiles[0] if profiles else {}
    job_description = (req.job_description or "").strip()
    tailored_copy = generate_tailored_application_copy(recipient, req.position, job_description)
    cover_sections = tailored_copy.get("cover_sections") if job_description else None

    company_for_filename = recipient.get("company") or "Company"
    company_resume = safe_filename_part(company_for_filename).lower()
    company_cover = safe_filename_part(company_for_filename)
    resume_filename = f"Abhishek_{company_resume}.pdf"
    cover_filename = f"CoverLetter_{company_cover}.pdf"

    try:
        resume_pdf = get_resume_pdf()
        cover_pdf = build_cover_letter_pdf(recipient, req.position, recipient.get("company"), cover_sections)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attachment generation error: {str(e)}")

    hr_name = recipient.get("hr_name") or "Hiring Team"
    company = recipient.get("company") or ""
    subject = f"Application for {req.position} — {SENDER_NAME}"
    email_body = tailored_copy["email_body"]
    email_paragraphs = [p.strip() for p in re.split(r"\n{2,}", email_body) if p.strip()]
    email_html = "\n  ".join(f"<p>{html.escape(p)}</p>" for p in email_paragraphs)
    match_points = tailored_copy.get("match_summary") or []
    match_plain = ""
    match_html = ""
    if match_points:
        match_plain = "\nRole fit highlights:\n" + "\n".join(f"- {point}" for point in match_points) + "\n"
        match_html = """
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:18px 0;background:#fafafa">
    <p style="margin:0 0 8px"><strong>Role fit highlights</strong></p>
    <ul style="margin:0;padding-left:18px;color:#374151">
      {items}
    </ul>
  </div>""".format(items="".join(f"<li>{html.escape(point)}</li>" for point in match_points))

    plain = f"""Dear {hr_name},

I hope you are doing well.

{email_body}
{match_plain}

Application details:
- Position: {req.position}
- Recruiter email: {recipient["hr_email"]}
- Company: {company or "Not specified"}
- Job description used: {"Yes" if job_description else "No"}

Best regards,
{SENDER_NAME}
{GMAIL_ADDRESS}
"""
    html_body = f"""
<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.75;max-width:720px;margin:0;text-align:left">
  <p>Dear <strong>{html.escape(hr_name)}</strong>,</p>
  <p>I hope you are doing well.</p>
  {email_html}
  {match_html}
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:18px 0;background:#fafafa">
    <p style="margin:0 0 6px"><strong>Application details</strong></p>
    <p style="margin:0;color:#374151">Position: {html.escape(req.position)}</p>
    <p style="margin:0;color:#374151">Recruiter email: {html.escape(recipient["hr_email"])}</p>
    <p style="margin:0;color:#374151">Company: {html.escape(company or "Not specified")}</p>
    <p style="margin:0;color:#374151">Job description used: {"Yes" if job_description else "No"}</p>
  </div>
  <br>
  <p>Best regards,<br><strong>{html.escape(SENDER_NAME)}</strong><br>
  <span style="color:#666;font-size:12px">{html.escape(GMAIL_ADDRESS)}</span></p>
</div>"""

    try:
        send_via_smtp(
            recipient["hr_email"],
            subject,
            plain,
            html_body,
            attachments=[
                {"filename": resume_filename, "content": resume_pdf, "content_type": "application/pdf"},
                {"filename": cover_filename, "content": cover_pdf, "content_type": "application/pdf"},
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")

    saved = insert_application({
        "hr_email":  recipient["hr_email"],
        "hr_name":   hr_name,
        "company":   company,
        "position":  req.position,
        "ats_score": 0,
        "sent_at":   datetime.utcnow().isoformat(),
        "status":    "sent",
        "reply_summary": f"{'JD-tailored. ' if job_description else ''}Attachments: {resume_filename}, {cover_filename}",
        "resume_filename": resume_filename,
        "cover_filename": cover_filename,
        "profile_url": primary_profile.get("url", ""),
        "profile_title": primary_profile.get("title", ""),
        "source": recipient.get("source", ""),
    })
    streak = record_streak_event(saved["id"])
    notify_streak(streak, saved)

    return {
        "status": "success",
        "message": f"Application sent to {hr_name} <{recipient['hr_email']}>",
        "recipient": recipient,
        "attachments": [resume_filename, cover_filename],
        "application": saved,
        "streak": streak,
        "profiles": profiles,
    }


# ── Applications ──────────────────────────────────────────────────

@app.get("/api/applications")
def get_applications():
    return list_applications()


@app.get("/api/contacts")
def contacts():
    return list_contacts()


@app.get("/api/streak")
def streak():
    return get_streak()


@app.get("/api/streak/history")
def streak_history():
    return get_streak_history()


@app.post("/api/send-again")
def send_again(req: SendAgainRequest):
    app_row = get_application(req.application_id)
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    position = app_row["position"] if req.mode == "previous" else (req.position or "").strip()
    if not position:
        raise HTTPException(status_code=400, detail="Enter a new position")
    return direct_send(DirectSendRequest(
        hr_email=app_row["hr_email"],
        hr_name=app_row["hr_name"],
        company=app_row["company"],
        position=position,
    ))


@app.get("/api/replies")
def replies(limit: int = 8):
    return list_replies(limit)


@app.post("/api/webhook/reply")
def webhook_reply(req: ReplyWebhookRequest):
    if not req.hr_email.strip():
        raise HTTPException(status_code=400, detail="Reply sender email is required")
    return insert_reply_event(req)


# ── Notifications ─────────────────────────────────────────────────

@app.get("/api/notifications")
def get_notifications():
    return list_notifications()

@app.patch("/api/notifications/{notif_id}/read")
def mark_read(notif_id: int):
    with db_conn() as conn:
        cur = conn.execute("UPDATE notifications SET read = 1 WHERE id = ?", (notif_id,))
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}
