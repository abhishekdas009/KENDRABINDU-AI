"use client";
import { useEffect, useState } from "react";
import { getApplications, sendAgainApplication } from "@/lib/api";

interface App {
    id: number; hr_email: string; hr_name: string; company: string; position: string;
    status: string; ats_score: number; sent_at: string; reply_summary: string;
    has_reply?: boolean; last_reply_at?: string; latest_reply_summary?: string;
}

const statusColor: Record<string, string> = {
    sent: "#D8D8D8", interview_scheduled: "#F0F0F0",
    rejected: "#A8A8A8", application_received: "#C8C8C8",
    follow_up: "#B8B8B8", reply_received: "#F0F0F0", other: "#888",
};

export default function TrackerTable() {
    const [apps, setApps] = useState<App[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<number | null>(null);
    const [newPosition, setNewPosition] = useState<Record<number, string>>({});
    const [error, setError] = useState("");

    const load = () => getApplications().then(setApps).finally(() => setLoading(false));

    useEffect(() => { load(); }, []);

    const sendAgain = async (app: App, mode: "previous" | "new") => {
        setSendingId(app.id);
        setError("");
        try {
            await sendAgainApplication({
                application_id: app.id,
                mode,
                position: mode === "new" ? newPosition[app.id] : undefined,
            });
            setNewPosition(v => ({ ...v, [app.id]: "" }));
            await load();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Could not send again");
        } finally {
            setSendingId(null);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)", fontSize: "14px" }}>Loading applications...</p>;
    if (!apps.length) return <p style={{ color: "var(--muted)", fontSize: "14px" }}>No applications sent yet.</p>;

    return (
        <div style={{ overflowX: "auto" }}>
            {error && <div style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>{error}</div>}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Company", "Position", "Recruiter", "Status", "Reply", "Sent", "Send again"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", color: "var(--muted)", fontWeight: 500, textAlign: "left" }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {apps.map(a => (
                        <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{a.company}</td>
                            <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{a.position}</td>
                            <td style={{ padding: "10px 12px" }}>
                                <div style={{ fontWeight: 650 }}>{a.hr_name}</div>
                                <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.hr_email}</div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                                <span style={{ background: (statusColor[a.status] || statusColor.other) + "22", color: statusColor[a.status] || statusColor.other, padding: "2px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 600 }}>
                                    {a.status?.replace(/_/g, " ")}
                                </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "var(--muted)", minWidth: 220 }}>
                                {a.has_reply ? (
                                    <div>
                                        <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.45 }}>{a.latest_reply_summary || a.reply_summary}</div>
                                        {a.last_reply_at && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{new Date(a.last_reply_at).toLocaleString()}</div>}
                                    </div>
                                ) : (
                                    <span>No reply yet</span>
                                )}
                            </td>
                            <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{a.sent_at ? new Date(a.sent_at).toLocaleDateString() : "—"}</td>
                            <td style={{ padding: "10px 12px", minWidth: 300 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <button className="btn-ghost" disabled={sendingId === a.id} onClick={() => sendAgain(a, "previous")} style={{ padding: "7px 10px", fontSize: 12 }}>
                                        Previous position
                                    </button>
                                    <input
                                        value={newPosition[a.id] || ""}
                                        onChange={(e) => setNewPosition(v => ({ ...v, [a.id]: e.target.value }))}
                                        placeholder="New position"
                                        style={{ width: 130, padding: "7px 9px", fontSize: 12 }}
                                    />
                                    <button className="btn-primary" disabled={sendingId === a.id} onClick={() => sendAgain(a, "new")} style={{ padding: "7px 10px", fontSize: 12 }}>
                                        Send
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
