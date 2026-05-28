import os
import json
import re
import smtplib
import shutil
import subprocess
import tempfile
import html
import hashlib
import mimetypes
import sqlite3
from pathlib import Path
from urllib.parse import quote_plus, unquote
from email.utils import formataddr, formatdate, make_msgid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from datetime import datetime, date, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
STREAK_EMAIL_TO      = os.getenv("STREAK_EMAIL_TO", "")
WHATSAPP_WEBHOOK_URL = os.getenv("WHATSAPP_WEBHOOK_URL", "")
LINKEDIN_URL         = os.getenv("LINKEDIN_URL", "https://www.linkedin.com/in/abhishekdas009")
GITHUB_URL           = os.getenv("GITHUB_URL", "https://github.com/abhishekdas009")
PORTFOLIO_URL        = os.getenv("PORTFOLIO_URL", "https://abhishekdas009.github.io")
ATTACH_COVER_LETTER  = os.getenv("ATTACH_COVER_LETTER", "false").strip().lower() in {"1", "true", "yes", "on"}
INCLUDE_SIGNATURE_LINKS = os.getenv("INCLUDE_SIGNATURE_LINKS", "false").strip().lower() in {"1", "true", "yes", "on"}
ALLOW_SELF_APPLICATION_TESTS = os.getenv("ALLOW_SELF_APPLICATION_TESTS", "false").strip().lower() in {"1", "true", "yes", "on"}
MAX_APPLICATION_SENDS_PER_24H = int(os.getenv("MAX_APPLICATION_SENDS_PER_24H", "25"))
MIN_SECONDS_BETWEEN_APPLICATION_SENDS = int(os.getenv("MIN_SECONDS_BETWEEN_APPLICATION_SENDS", "120"))
MIN_DAYS_BETWEEN_SAME_RECIPIENT = int(os.getenv("MIN_DAYS_BETWEEN_SAME_RECIPIENT", "3"))
RESUME_TEMPLATE_DIR = Path(os.getenv("RESUME_TEMPLATE_DIR", str(BASE_DIR / "resume_templates")))
MAX_RESUME_TEMPLATE_BYTES = int(os.getenv("MAX_RESUME_TEMPLATE_BYTES", str(10 * 1024 * 1024)))
ALLOWED_RESUME_TEMPLATE_EXTENSIONS = {".pdf", ".doc", ".docx"}

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
    RESUME_TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS resume_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                content_type TEXT DEFAULT '',
                size_bytes INTEGER NOT NULL DEFAULT 0,
                file_hash TEXT NOT NULL,
                uploaded_at TEXT NOT NULL
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


def clean_subject(value: str, fallback: str = "Job application") -> str:
    subject = re.sub(r"\s+", " ", (value or "").strip())
    subject = subject.replace("—", "-").replace("–", "-")
    subject = re.sub(r"[\r\n]+", " ", subject)
    return (subject or fallback)[:120]


def same_email(left: str, right: str) -> bool:
    return left.strip().lower() == right.strip().lower() and bool(left.strip())


def application_subject(raw_subject: str, position: str, company: str = "") -> str:
    position_text = re.sub(r"\s+", " ", (position or "Open role").strip())
    company_text = re.sub(r"\s+", " ", (company or "").strip())
    subject = clean_subject(raw_subject, f"{position_text} application - {SENDER_NAME}")
    lowered = subject.lower()
    company_lower = company_text.lower()
    sender_token = SENDER_NAME.split()[0].lower() if SENDER_NAME else ""
    generic_subjects = {
        f"{position_text} application".lower(),
        f"application for {position_text}".lower(),
        f"{position_text} opportunity".lower(),
    }

    if company_text and company_lower not in lowered:
        subject = f"{position_text} application for {company_text} - {SENDER_NAME}"
    elif lowered in generic_subjects or (sender_token and sender_token not in lowered and len(subject) < 70):
        subject = f"{subject} - {SENDER_NAME}"
    return clean_subject(subject, f"{position_text} application - {SENDER_NAME}")


def normalize_attachment_language(value: str, include_cover_letter: bool = False) -> str:
    text = value or ""
    if include_cover_letter:
        attachment_line = "I have attached my resume and cover letter for context."
    else:
        attachment_line = "I have attached my resume for context."
        text = re.sub(r"\bmy resume and (?:a )?(?:tailored )?cover letter\b", "my resume", text, flags=re.I)
        text = re.sub(r"\bmy resume and (?:the )?cover letter\b", "my resume", text, flags=re.I)
        text = re.sub(r"\bresume and (?:a )?(?:tailored )?cover letter\b", "resume", text, flags=re.I)

    has_resume_attachment = re.search(r"\battach(?:ed|ing)?\b.*\bresume\b|\bresume\b.*\battach(?:ed|ing)?\b", text, flags=re.I)
    if not has_resume_attachment:
        text = f"{text.rstrip()}\n\n{attachment_line}"
    return text.strip()


def email_paragraphs(value: str) -> List[str]:
    normalized = value.replace("\\n", "\n")
    chunks = [p.strip() for p in re.split(r"\n{2,}", normalized) if p.strip()]
    if chunks:
        return chunks
    return [line.strip() for line in normalized.splitlines() if line.strip()]


def simple_email_html(greeting: str, body_text: str) -> str:
    body = "\n  ".join(
        f'<p style="margin:0 0 14px">{html.escape(paragraph)}</p>'
        for paragraph in email_paragraphs(body_text)
    )
    return f"""
<div style="font-family:Arial,sans-serif;font-size:14px;color:#111111;line-height:1.6;margin:0;text-align:left">
  <p style="margin:0 0 14px">{html.escape(greeting)}</p>
  {body}
  {social_signature_html()}
</div>"""


def application_send_stats(recipient_email: str) -> dict:
    now = datetime.utcnow()
    day_ago = (now - timedelta(hours=24)).isoformat()
    recipient = recipient_email.strip().lower()
    with db_conn() as conn:
        day_count = conn.execute(
            "SELECT COUNT(*) AS c FROM applications WHERE datetime(sent_at) >= datetime(?)",
            (day_ago,),
        ).fetchone()["c"]
        last_send = conn.execute(
            "SELECT sent_at FROM applications ORDER BY datetime(sent_at) DESC, id DESC LIMIT 1"
        ).fetchone()
        last_recipient_send = conn.execute(
            """
            SELECT sent_at
            FROM applications
            WHERE lower(hr_email) = ?
            ORDER BY datetime(sent_at) DESC, id DESC
            LIMIT 1
            """,
            (recipient,),
        ).fetchone()
    return {
        "day_count": day_count,
        "last_sent_at": last_send["sent_at"] if last_send else "",
        "last_recipient_sent_at": last_recipient_send["sent_at"] if last_recipient_send else "",
    }


def parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def enforce_application_send_limits(recipient_email: str):
    if same_email(recipient_email, GMAIL_ADDRESS) and not ALLOW_SELF_APPLICATION_TESTS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Do not send application tests to the same Gmail account you send from. "
                "Use a separate inbox for testing so Gmail does not learn these messages as self-sent spam."
            ),
        )

    stats = application_send_stats(recipient_email)
    now = datetime.utcnow()

    if MAX_APPLICATION_SENDS_PER_24H > 0 and stats["day_count"] >= MAX_APPLICATION_SENDS_PER_24H:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily send limit reached ({MAX_APPLICATION_SENDS_PER_24H}/24h). "
                "Slow sending helps rebuild Gmail sender reputation."
            ),
        )

    last_sent_at = parse_iso_datetime(stats["last_sent_at"])
    if last_sent_at and MIN_SECONDS_BETWEEN_APPLICATION_SENDS > 0:
        wait_seconds = MIN_SECONDS_BETWEEN_APPLICATION_SENDS - int((now - last_sent_at).total_seconds())
        if wait_seconds > 0:
            raise HTTPException(
                status_code=429,
                detail=f"Wait {wait_seconds} seconds before sending the next application email.",
            )

    last_recipient_sent_at = parse_iso_datetime(stats["last_recipient_sent_at"])
    if last_recipient_sent_at and MIN_DAYS_BETWEEN_SAME_RECIPIENT > 0:
        next_allowed = last_recipient_sent_at + timedelta(days=MIN_DAYS_BETWEEN_SAME_RECIPIENT)
        if now < next_allowed:
            remaining = next_allowed - now
            days = max(1, remaining.days + (1 if remaining.seconds else 0))
            raise HTTPException(
                status_code=429,
                detail=(
                    f"This recruiter was emailed recently. Wait about {days} day(s) before another send "
                    "to avoid duplicate-looking outreach."
                ),
            )


def send_via_smtp(to: str, subject: str, plain_text: str, html_body: str, attachments: Optional[List[dict]] = None):
    if not GMAIL_ADDRESS or not GMAIL_APP_PASS:
        raise ValueError("GMAIL_ADDRESS or GMAIL_APP_PASSWORD missing in .env")
    to_email = to.strip()
    sender_domain = GMAIL_ADDRESS.split("@")[-1] if "@" in GMAIL_ADDRESS else "gmail.com"
    msg = MIMEMultipart("mixed")
    msg["From"] = formataddr((SENDER_NAME, GMAIL_ADDRESS))
    msg["To"] = to_email
    msg["Reply-To"] = formataddr((SENDER_NAME, GMAIL_ADDRESS))
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=sender_domain)
    msg["Subject"] = clean_subject(subject)

    body = MIMEMultipart("alternative")
    body.attach(MIMEText(plain_text, "plain", "utf-8"))
    body.attach(MIMEText(html_body, "html", "utf-8"))
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
        server.ehlo()
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
        server.sendmail(GMAIL_ADDRESS, [to_email], msg.as_string())


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
Power BI dashboards, ETL/data cleaning, and practical data workflows. Resume-backed highlights:
- Supply-chain analysis at Sukoon Unlimited that identified $250,000 in annual savings and improved profitability by 20%.
- Power BI dashboards and automated ETL/reporting workflows at Unified Mentor for 30+ stakeholders.
- Churn prediction model with 87% accuracy.
- Transport delay prediction system with 85% accuracy.
- Comfortable with Python, SQL, Pandas, Scikit-learn, Power BI, Tableau, and AWS/Azure cloud basics.
Keep claims truthful and do not invent employer experience, certifications, or tools that are
not implied by this context.
""".strip()


def strip_latex_to_text(value: str) -> str:
    text = re.sub(r"%.*", "", value)
    text = re.sub(r"\\lettersection\{([^}]*)\}", r"\n\1\n", text)
    text = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^{}]*)\})?", lambda m: m.group(1) or " ", text)
    text = re.sub(r"[{}]", " ", text)
    text = text.replace(r"\$", "$").replace(r"\%", "%").replace(r"\&", "&")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def cover_letter_context_text() -> str:
    try:
        source = COVER_LETTER_TEX_PATH.read_text(encoding="utf-8")
    except OSError:
        return ""
    match = re.search(r"\\begin\{cvletter\}(.*?)\\end\{cvletter\}", source, flags=re.S)
    return strip_latex_to_text(match.group(1) if match else source)


def candidate_links() -> List[dict]:
    if not INCLUDE_SIGNATURE_LINKS:
        return []
    links = [
        {"label": "LinkedIn", "icon": "in", "url": LINKEDIN_URL},
        {"label": "GitHub", "icon": "GH", "url": GITHUB_URL},
        {"label": "Portfolio", "icon": "P", "url": PORTFOLIO_URL},
    ]
    return [link for link in links if link["url"].strip()]


def social_signature_plain() -> str:
    lines = [
        "Best regards,",
        SENDER_NAME,
        GMAIL_ADDRESS,
    ]
    for link in candidate_links():
        lines.append(f"{link['label']}: {link['url']}")
    return "\n".join(lines)


def social_signature_html() -> str:
    link_html = []
    for link in candidate_links():
        url = html.escape(link["url"], quote=True)
        label = html.escape(link["label"])
        link_html.append(
            f'{label}: <a href="{url}" style="color:#111111;text-decoration:underline">{url}</a>'
        )
    links = "<br>".join(link_html)
    links_block = f'\n  <p style="margin:8px 0 0;font-size:13px;line-height:1.5">{links}</p>' if links else ""
    return f"""
  <p style="margin:22px 0 0">Best regards,<br>
    <strong>{html.escape(SENDER_NAME)}</strong><br>
    <a href="mailto:{html.escape(GMAIL_ADDRESS, quote=True)}" style="color:#111111;text-decoration:underline">{html.escape(GMAIL_ADDRESS)}</a>
  </p>
  {links_block}"""


def clean_email_body(value: str) -> str:
    lines = []
    for line in value.replace("\\n", "\n").splitlines():
        stripped = line.strip()
        if not stripped:
            lines.append("")
            continue
        if re.match(r"^(dear|hi|hello)\b", stripped, flags=re.I):
            continue
        if re.match(r"^(best regards|regards|sincerely|cheers|thank you)[,!.]?$", stripped, flags=re.I):
            continue
        if stripped.lower() in {SENDER_NAME.lower(), GMAIL_ADDRESS.lower()}:
            continue
        lines.append(stripped)
    cleaned = "\n".join(lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def fallback_tailored_copy(position: str, company: str = "", hr_name: str = "", include_cover_letter: bool = False) -> dict:
    company_phrase = f" at {company}" if company else ""
    recruiter_phrase = hr_name or "the hiring team"
    attachment_line = (
        "I have attached my resume and cover letter for context."
        if include_cover_letter
        else "I have attached my resume for context."
    )
    return {
        "subject": application_subject(f"{position} application{company_phrase}", position, company),
        "greeting": f"Hi {hr_name}," if hr_name and hr_name != "Hiring Team" else "Dear Hiring Team,",
        "email_body": (
            f"I am writing about the {position} role{company_phrase} and wanted to share my profile with {recruiter_phrase}. "
            "My work has been centered on Python, SQL, Power BI, data cleaning, and practical analytics projects.\n\n"
            "Relevant examples include supply-chain analysis that identified $250,000 in annual savings, "
            "Power BI dashboards for 30+ stakeholders, and predictive models for churn and transport delays. "
            f"{attachment_line}\n\n"
            "If my background looks useful for the role, I would be glad to speak further."
        ),
        "match_summary": [],
        "cover_sections": [],
    }


def clean_tailored_copy(raw: dict, position: str, company: str = "", hr_name: str = "", include_cover_letter: bool = False) -> dict:
    fallback = fallback_tailored_copy(position, company, hr_name, include_cover_letter)
    if not isinstance(raw, dict):
        return fallback

    subject = application_subject(str(raw.get("subject") or "").strip() or fallback["subject"], position, company)
    greeting = str(raw.get("greeting") or "").strip() or fallback["greeting"]
    email_body = clean_email_body(str(raw.get("email_body") or "").strip())
    if not email_body:
        email_body = fallback["email_body"]
    email_body = normalize_attachment_language(email_body, include_cover_letter)

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
        "subject": subject[:120],
        "greeting": greeting[:80],
        "email_body": email_body[:2200],
        "match_summary": match_summary[:4],
        "cover_sections": sections[:4],
    }


def generate_tailored_application_copy(
    recipient: dict,
    position: str,
    job_description: str,
    profiles: Optional[List[dict]] = None,
) -> dict:
    company = (recipient.get("company") or "").strip()
    hr_name = (recipient.get("hr_name") or "Hiring Team").strip()
    if not GROQ_API_KEY:
        return fallback_tailored_copy(position, company, hr_name, ATTACH_COVER_LETTER)

    profile_context = ""
    if profiles:
        profile_context = json.dumps(profiles[:2], ensure_ascii=False)
    cover_context = cover_letter_context_text()[:3200]
    jd_context = job_description.strip()[:4500] or "No job description was provided. Tailor using the role title, company/domain, recruiter hints, and candidate resume facts."

    try:
        raw = groq_json(f"""
You are an expert job-application copywriter. Write one fresh, concise cold email and cover-letter sections for Abhishek Das.
The output must be personalized to this exact recruiter, company, and position. Do not reuse generic wording.

Hard rules:
- Return ONLY valid JSON.
- Do not invent facts, employers, degrees, links, interviews, referrals, or recruiter relationship.
- Do not say "I hope you are doing well".
- Do not include a signature, candidate name, email address, phone number, or social links in email_body.
- Do not include an "Application details" section.
- Keep the email natural, direct, and human: 3 short paragraphs, 90-150 words total.
- Make it read like a one-to-one note, not a campaign or marketing email.
- Avoid generic phrases such as "excited to apply", "utilize my skills", "drive insights", "high accuracy", and "I am confident".
- Mention the target position and company if company is known.
- If recruiter name looks like a real person, use it in greeting. Otherwise use "Dear Hiring Team,".
- Pick only the strongest 2-3 resume facts for this role.
- End with a light call to action, not a pushy sales line.
- Attachment policy for this send: {"resume and cover letter" if ATTACH_COVER_LETTER else "resume only"}.

Resume/candidate facts:
{CANDIDATE_CONTEXT}

Current cover-letter source to learn tone and facts from:
{cover_context}

Recipient and role:
Recruiter name: {hr_name}
Recruiter email: {recipient.get("hr_email") or ""}
Role: {position}
Company: {company or "Not specified"}
Company needs review: {recipient.get("company_needs_review")}
Profile/search hints: {profile_context or "None"}

Job description:
{jd_context}

Return ONLY a valid JSON object with exactly these keys:
{{
  "subject": "short customized subject line, under 85 characters",
  "greeting": "Hi FirstName, or Dear Hiring Team,",
  "email_body": "3 short paragraphs for the email body, no greeting and no sign-off",
  "match_summary": ["short match point 1", "short match point 2", "short match point 3"],
  "cover_sections": [
    {{"title": "About Me", "body": "one concise paragraph"}},
    {{"title": "Why This Role", "body": "one concise paragraph tied to the role/company/JD"}},
    {{"title": "Why Me", "body": "one concise paragraph tied to the best resume facts"}}
  ]
}}
""", temperature=0.62)
        return clean_tailored_copy(raw, position, company, hr_name, ATTACH_COVER_LETTER)
    except Exception:
        return fallback_tailored_copy(position, company, hr_name, ATTACH_COVER_LETTER)


def get_resume_pdf() -> bytes:
    return download_binary(google_drive_download_url(RESUME_FILE_ID), b"%PDF", "resume PDF")


def safe_filename_part(value: str, fallback: str = "Company") -> str:
    clean = re.sub(r"[^A-Za-z0-9]+", "_", (value or fallback).strip()).strip("_")
    return clean or fallback


def resume_template_path(stored_filename: str) -> Path:
    safe_name = Path(stored_filename).name
    return RESUME_TEMPLATE_DIR / safe_name


def resume_template_to_dict(row: sqlite3.Row) -> dict:
    item = dict(row)
    uploaded_at = item.get("uploaded_at") or ""
    size_bytes = int(item.get("size_bytes") or 0)
    item["size_bytes"] = size_bytes
    item["uploaded_at"] = uploaded_at
    item["preview_url"] = f"/api/resume-templates/{item['id']}/file"
    item["download_url"] = f"/api/resume-templates/{item['id']}/download"
    item["is_pdf"] = Path(item.get("original_filename", "")).suffix.lower() == ".pdf"
    return item


def list_resume_templates() -> List[dict]:
    with db_conn() as conn:
        rows = conn.execute("""
            SELECT *
            FROM resume_templates
            ORDER BY datetime(uploaded_at) DESC, id DESC
        """).fetchall()
    return [resume_template_to_dict(row) for row in rows]


def get_resume_template(template_id: int) -> Optional[dict]:
    with db_conn() as conn:
        row = conn.execute("SELECT * FROM resume_templates WHERE id = ?", (template_id,)).fetchone()
    return resume_template_to_dict(row) if row else None


def resume_template_stats() -> dict:
    week_start = (datetime.utcnow() - timedelta(days=7)).isoformat()
    with db_conn() as conn:
        row = conn.execute("""
            SELECT
                COUNT(DISTINCT file_hash) AS unique_count,
                COUNT(*) AS version_count,
                COALESCE(SUM(size_bytes), 0) AS storage_used
            FROM resume_templates
        """).fetchone()
        week = conn.execute(
            "SELECT COUNT(*) AS c FROM resume_templates WHERE datetime(uploaded_at) >= datetime(?)",
            (week_start,),
        ).fetchone()["c"]
    return {
        "total_unique_resumes": row["unique_count"] or 0,
        "this_week_uploads": week or 0,
        "template_versions": row["version_count"] or 0,
        "storage_used_bytes": row["storage_used"] or 0,
    }


def insert_resume_template(original_filename: str, stored_filename: str, content_type: str, size_bytes: int, file_hash: str) -> dict:
    uploaded_at = datetime.utcnow().isoformat()
    with db_conn() as conn:
        cur = conn.execute("""
            INSERT INTO resume_templates (
                original_filename, stored_filename, content_type, size_bytes, file_hash, uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (original_filename, stored_filename, content_type, size_bytes, file_hash, uploaded_at))
        conn.commit()
        row = conn.execute("SELECT * FROM resume_templates WHERE id = ?", (cur.lastrowid,)).fetchone()
    return resume_template_to_dict(row)


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
        f"KendraBindu AI streak update: {streak['current_streak']} day streak. "
        f"Sent {app_data.get('position')} application to {app_data.get('hr_email')}."
    )
    if STREAK_EMAIL_TO:
        try:
            send_via_smtp(
                STREAK_EMAIL_TO,
                "KendraBindu AI streak update",
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

    try:
        recipient_email = normalize_email(req.hr_email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    enforce_application_send_limits(recipient_email)

    subject = application_subject(f"Application for {req.position}", req.position, req.company)

    greeting = f"Hi {req.hr_name}," if req.hr_name and req.hr_name != "Hiring Team" else "Dear Hiring Team,"
    body_text = clean_email_body(req.cover_letter_content) or req.cover_letter_content.strip()
    plain = f"{greeting}\n\n{body_text}\n\n{social_signature_plain()}"
    html = simple_email_html(greeting, body_text)

    try:
        send_via_smtp(recipient_email, subject, plain, html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)}")

    saved = insert_application({
        "hr_email":  recipient_email,
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
    enforce_application_send_limits(recipient["hr_email"])

    profiles = discover_profiles(recipient["hr_email"], recipient.get("hr_name", ""), recipient.get("company", ""))
    primary_profile = profiles[0] if profiles else {}
    job_description = (req.job_description or "").strip()
    tailored_copy = generate_tailored_application_copy(recipient, req.position, job_description, profiles)
    cover_sections = tailored_copy.get("cover_sections") or None

    company_for_filename = recipient.get("company") or "Company"
    company_cover = safe_filename_part(company_for_filename)
    position_file = safe_filename_part(req.position, "Role")
    resume_filename = f"Abhishek_Das_Resume_{position_file}.pdf"
    cover_filename = f"Abhishek_Das_Cover_Letter_{company_cover}.pdf" if ATTACH_COVER_LETTER else ""

    try:
        resume_pdf = get_resume_pdf()
        cover_pdf = (
            build_cover_letter_pdf(recipient, req.position, recipient.get("company"), cover_sections)
            if ATTACH_COVER_LETTER
            else None
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attachment generation error: {str(e)}")

    hr_name = recipient.get("hr_name") or "Hiring Team"
    company = recipient.get("company") or ""
    subject = application_subject(tailored_copy.get("subject") or "", req.position, company)
    email_body = tailored_copy["email_body"]
    greeting = tailored_copy.get("greeting") or (
        f"Hi {hr_name}," if hr_name and hr_name != "Hiring Team" else "Dear Hiring Team,"
    )

    plain = f"""{greeting}

{email_body}

{social_signature_plain()}
"""
    html_body = simple_email_html(greeting, email_body)

    attachments = [
        {"filename": resume_filename, "content": resume_pdf, "content_type": "application/pdf"},
    ]
    if ATTACH_COVER_LETTER and cover_pdf and cover_filename:
        attachments.append({"filename": cover_filename, "content": cover_pdf, "content_type": "application/pdf"})

    try:
        send_via_smtp(
            recipient["hr_email"],
            subject,
            plain,
            html_body,
            attachments=attachments,
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
        "reply_summary": f"AI-tailored cold mail. Attachments: {', '.join(item['filename'] for item in attachments)}",
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
        "attachments": [item["filename"] for item in attachments],
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


@app.get("/api/resume-templates")
def get_resume_templates():
    return {
        "templates": list_resume_templates(),
        "stats": resume_template_stats(),
    }


@app.post("/api/resume-templates")
async def upload_resume_template(file: UploadFile = File(...)):
    original_filename = Path(file.filename or "resume.pdf").name
    extension = Path(original_filename).suffix.lower()
    if extension not in ALLOWED_RESUME_TEMPLATE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Upload a PDF, DOC, or DOCX resume template.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Resume file is empty.")
    if len(content) > MAX_RESUME_TEMPLATE_BYTES:
        max_mb = MAX_RESUME_TEMPLATE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"Resume file must be {max_mb} MB or smaller.")

    file_hash = hashlib.sha256(content).hexdigest()
    base_name = safe_filename_part(Path(original_filename).stem, "resume")
    stored_filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file_hash[:12]}_{base_name}{extension}"
    destination = resume_template_path(stored_filename)
    destination.write_bytes(content)

    content_type = file.content_type or mimetypes.guess_type(original_filename)[0] or "application/octet-stream"
    template = insert_resume_template(original_filename, stored_filename, content_type, len(content), file_hash)
    return {
        "template": template,
        "stats": resume_template_stats(),
    }


@app.get("/api/resume-templates/{template_id}/file")
def preview_resume_template(template_id: int):
    template = get_resume_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Resume template not found")
    path = resume_template_path(template["stored_filename"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Resume template file is missing")
    filename = template["original_filename"].replace('"', "")
    return FileResponse(
        path,
        media_type=template.get("content_type") or mimetypes.guess_type(filename)[0] or "application/octet-stream",
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@app.get("/api/resume-templates/{template_id}/download")
def download_resume_template(template_id: int):
    template = get_resume_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Resume template not found")
    path = resume_template_path(template["stored_filename"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Resume template file is missing")
    return FileResponse(
        path,
        media_type=template.get("content_type") or "application/octet-stream",
        filename=template["original_filename"],
    )


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
