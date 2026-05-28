const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function errorMessage(res: Response) {
    const fallback = `Request failed (${res.status})`;
    let text = "";

    try {
        text = await res.text();
    } catch {
        return fallback;
    }

    if (!text) return fallback;

    try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.detail === "string") return parsed.detail;
        if (Array.isArray(parsed?.detail)) {
            return parsed.detail
                .map((item: { msg?: string } | string) => (typeof item === "string" ? item : item?.msg))
                .filter(Boolean)
                .join(". ");
        }
        if (typeof parsed?.message === "string") return parsed.message;
    } catch {
        return text;
    }

    return text;
}

export function simpleFailureReason(error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") return "Send was cancelled.";

    let message = error instanceof Error ? error.message : String(error || "");
    try {
        const parsed = JSON.parse(message);
        if (typeof parsed?.detail === "string") message = parsed.detail;
    } catch {}

    const lower = message.toLowerCase();
    const waitMatch = message.match(/wait\s+(\d+)\s+seconds/i);

    if (waitMatch) return `Please wait ${waitMatch[1]} seconds, then send again.`;
    if (lower.includes("daily send limit")) return "Daily send limit reached. Try again tomorrow.";
    if (lower.includes("emailed recently") || lower.includes("same recruiter")) return "You already emailed this recruiter recently. Try again later.";
    if (lower.includes("same gmail") || lower.includes("same gmail account") || lower.includes("own gmail")) return "Use a different test email. Do not send to your own Gmail.";
    if (lower.includes("gmail_address") || lower.includes("gmail_app_password") || lower.includes("app password")) return "Gmail is not connected. Check your app password.";
    if (lower.includes("authentication") || lower.includes("login")) return "Gmail login failed. Check your app password.";
    if (lower.includes("resume pdf") || lower.includes("download")) return "Could not get your resume PDF.";
    if (lower.includes("attachment") || lower.includes("cover letter") || lower.includes("latex")) return "Could not prepare the attachment.";
    if (lower.includes("position is required")) return "Enter the position and try again.";
    if (lower.includes("valid recruiter email")) return "Enter a valid recruiter email.";
    if (lower.includes("failed to fetch") || lower.includes("network")) return "Backend is not reachable. Check the server.";
    if (lower.includes("smtp")) return "Gmail could not send the email.";

    return message && message.length < 120 ? message : "Something went wrong while sending.";
}

export async function extractInfo(raw_email: string, position: string) {
    const res = await fetch(`${BASE}/api/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_email, position }),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function parseRecipient(hr_email: string, position: string) {
    const res = await fetch(`${BASE}/api/parse-recipient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hr_email, position }),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function rewriteResume(data: {
    hr_name: string; company: string; position: string;
    job_description?: string; base_resume: string; base_cover_letter: string;
}) {
    const res = await fetch(`${BASE}/api/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function sendEmail(data: {
    hr_email: string; hr_name: string; company: string; position: string;
    resume_content: string; cover_letter_content: string; ats_score: number;
}) {
    const res = await fetch(`${BASE}/api/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function directSendApplication(data: {
    hr_email: string; position: string; hr_name?: string; company?: string; job_description?: string;
}, options?: { signal?: AbortSignal }) {
    const res = await fetch(`${BASE}/api/direct-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: options?.signal,
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function sendAgainApplication(data: {
    application_id: number; mode: "previous" | "new"; position?: string;
}) {
    const res = await fetch(`${BASE}/api/send-again`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function getStreak() {
    const res = await fetch(`${BASE}/api/streak`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function getStreakHistory() {
    const res = await fetch(`${BASE}/api/streak/history`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function getApplications() {
    const res = await fetch(`${BASE}/api/applications`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function getContacts() {
    const res = await fetch(`${BASE}/api/contacts`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export interface ResumeTemplate {
    id: number;
    original_filename: string;
    stored_filename: string;
    content_type: string;
    size_bytes: number;
    file_hash: string;
    uploaded_at: string;
    preview_url: string;
    download_url: string;
    is_pdf: boolean;
}

export interface ResumeTemplateStats {
    total_unique_resumes: number;
    this_week_uploads: number;
    template_versions: number;
    storage_used_bytes: number;
}

export async function getResumeTemplates(): Promise<{ templates: ResumeTemplate[]; stats: ResumeTemplateStats }> {
    const res = await fetch(`${BASE}/api/resume-templates`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function uploadResumeTemplate(file: File): Promise<{ template: ResumeTemplate; stats: ResumeTemplateStats }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE}/api/resume-templates`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export function resumeTemplatePreviewUrl(template: Pick<ResumeTemplate, "preview_url">) {
    return `${BASE}${template.preview_url}`;
}

export function resumeTemplateDownloadUrl(template: Pick<ResumeTemplate, "download_url">) {
    return `${BASE}${template.download_url}`;
}

export async function getReplies(limit = 8) {
    const res = await fetch(`${BASE}/api/replies?limit=${limit}`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function getNotifications() {
    const res = await fetch(`${BASE}/api/notifications`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}

export async function markNotificationRead(id: number) {
    const res = await fetch(`${BASE}/api/notifications/${id}/read`, { method: "PATCH" });
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.json();
}
