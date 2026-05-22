"use client";
import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { getNotifications, markNotificationRead } from "@/lib/api";

interface Notif { id: number; message: string; company: string; hr_name: string; created_at: string; }

export default function NotifBadge() {
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try { const d = await getNotifications(); setNotifs(d); } catch { }
        };
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, []);

    const dismiss = async (id: number) => {
        await markNotificationRead(id);
        setNotifs(n => n.filter(x => x.id !== id));
    };

    return (
        <div style={{ position: "relative" }}>
            <button onClick={() => setOpen(o => !o)} style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%",
                padding: "9px 12px", borderRadius: "8px", background: "transparent",
                color: "var(--muted)", fontSize: "13px",
            }}>
                <div style={{ position: "relative" }}>
                    <Bell size={15} />
                    {notifs.length > 0 && (
                        <span style={{
                            position: "absolute", top: "-6px", right: "-6px",
                            background: "#D8D8D8", borderRadius: "99px",
                            width: "15px", height: "15px", fontSize: "9px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#050505", fontWeight: 700,
                        }}>{notifs.length}</span>
                    )}
                </div>
                Notifications
            </button>
            {open && (
                <div style={{
                    position: "fixed", bottom: "80px", left: "228px",
                    width: "300px", background: "var(--surface2)",
                    border: "1px solid var(--border)", borderRadius: "12px",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 300, overflow: "hidden",
                }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "13px" }}>
                        HR Replies
                    </div>
                    {notifs.length === 0
                        ? <p style={{ padding: "20px 16px", color: "var(--muted)", fontSize: "13px" }}>No replies yet</p>
                        : notifs.map(n => (
                            <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: "8px" }}>
                                <p style={{ fontSize: "12px", lineHeight: 1.5 }}>{n.message}</p>
                                <button onClick={() => dismiss(n.id)} style={{ background: "none", color: "var(--muted)", fontSize: "16px" }}>×</button>
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
}
