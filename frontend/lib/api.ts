const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function extractInfo(raw_email: string, position: string) {
    const res = await fetch(`${BASE}/api/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_email, position }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function parseRecipient(hr_email: string, position: string) {
    const res = await fetch(`${BASE}/api/parse-recipient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hr_email, position }),
    });
    if (!res.ok) throw new Error(await res.text());
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
    if (!res.ok) throw new Error(await res.text());
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function directSendApplication(data: {
    hr_email: string; position: string; hr_name?: string; company?: string; job_description?: string;
}) {
    const res = await fetch(`${BASE}/api/direct-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
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
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getStreak() {
    const res = await fetch(`${BASE}/api/streak`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getStreakHistory() {
    const res = await fetch(`${BASE}/api/streak/history`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getApplications() {
    const res = await fetch(`${BASE}/api/applications`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getContacts() {
    const res = await fetch(`${BASE}/api/contacts`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getReplies(limit = 8) {
    const res = await fetch(`${BASE}/api/replies?limit=${limit}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getNotifications() {
    const res = await fetch(`${BASE}/api/notifications`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function markNotificationRead(id: number) {
    const res = await fetch(`${BASE}/api/notifications/${id}/read`, { method: "PATCH" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
