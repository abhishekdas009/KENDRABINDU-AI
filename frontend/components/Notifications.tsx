"use client";
import { useState, useEffect } from "react";
import { getNotifications, markNotificationRead } from "@/lib/api";

interface Notif { id: number; message: string; company: string; hr_name: string; created_at: string; }

export default function Notifications() {
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try { const data = await getNotifications(); setNotifs(data); } catch { }
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
            <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: "8px", color: "var(--text)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                {notifs.length > 0 && (
                    <span style={{ position: "absolute", top: "4px", right: "4px", background: "#D8D8D8", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#050505", fontWeight: 700 }}>
                        {notifs.length}
                    </span>
                )}
            </button>
            {open && (
                <div style={{ position: "absolute", right: 0, top: "44px", width: "340px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 200, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "13px" }}>Notifications</div>
                    {notifs.length === 0
                        ? <p style={{ padding: "20px 16px", color: "var(--muted)", fontSize: "13px" }}>No new notifications</p>
                        : notifs.map(n => (
                            <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                                <p style={{ fontSize: "13px", lineHeight: 1.5 }}>{n.message}</p>
                                <button onClick={() => dismiss(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "16px", flexShrink: 0 }}>×</button>
                            </div>
                        ))
                    }
                </div>
            )}
        </div>
    );
}
