"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getApplications } from "@/lib/api";
import { Building2, User, Briefcase, ChevronRight } from "lucide-react";

interface App {
  id: number; hr_email?: string; hr_name: string; company: string;
  position: string; status: string; ats_score: number;
  sent_at: string; reply_summary: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sent:                 { label: "Sent",          color: "#D8D8D8", bg: "rgba(255,255,255,0.07)" },
  interview_scheduled:  { label: "Interview",     color: "#F0F0F0", bg: "rgba(255,255,255,0.08)" },
  rejected:             { label: "Rejected",      color: "#A8A8A8", bg: "rgba(255,255,255,0.05)" },
  application_received: { label: "Received",      color: "#C8C8C8", bg: "rgba(255,255,255,0.06)" },
  reply_received:       { label: "Reply",         color: "#F0F0F0", bg: "rgba(255,255,255,0.08)" },
  follow_up:            { label: "Follow-up",     color: "#D8D8D8", bg: "rgba(255,255,255,0.07)" },
  other:                { label: "Other",         color: "#777777", bg: "rgba(255,255,255,0.05)" },
};

const DEMO: App[] = [
  { id: 1, company: "Google DeepMind", position: "ML Engineer", hr_name: "Sarah Chen", status: "interview_scheduled", ats_score: 92, sent_at: new Date(Date.now() - 86400000).toISOString(), reply_summary: "Interview scheduled for next week" },
  { id: 2, company: "Stripe", position: "Backend Engineer", hr_name: "James Liu", status: "sent", ats_score: 87, sent_at: new Date(Date.now() - 172800000).toISOString(), reply_summary: "" },
  { id: 3, company: "Vercel", position: "Frontend Engineer", hr_name: "Emma Walsh", status: "application_received", ats_score: 79, sent_at: new Date(Date.now() - 259200000).toISOString(), reply_summary: "Application under review" },
  { id: 4, company: "Linear", position: "Product Engineer", hr_name: "Alex Park", status: "follow_up", ats_score: 83, sent_at: new Date(Date.now() - 345600000).toISOString(), reply_summary: "Sent follow-up email" },
  { id: 5, company: "Notion", position: "Full-stack Dev", hr_name: "Maya Singh", status: "rejected", ats_score: 64, sent_at: new Date(Date.now() - 432000000).toISOString(), reply_summary: "Not moving forward" },
];

export default function RecentSendsTable() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApplications()
      .then(d => setApps(d?.length ? d : DEMO))
      .catch(() => setApps(DEMO))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(12, 12, 12, 0.94)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 18px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: 700, letterSpacing: 0, color: "var(--text)", marginBottom: "3px" }}>
            Recent Sends
          </h3>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>Latest application activity</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03, x: 2 }} whileTap={{ scale: 0.97 }}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "7px 11px",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px", color: "var(--text)", fontSize: "12.5px", fontWeight: 600, cursor: "pointer",
          }}
        >
          View all <ChevronRight size={13} />
        </motion.button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "48px", borderRadius: "10px" }} />)}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                {["Company", "Position", "Contact", "Status", "Sent"].map(h => (
                  <th key={h} style={{
                    padding: "0 18px 9px",
                    fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.07em",
                    color: "var(--text-dim)", textAlign: "left", textTransform: "uppercase",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>{h}</th>
                ))}
                <th style={{ padding: "0 18px 9px", borderBottom: "1px solid rgba(255,255,255,0.04)" }} />
              </tr>
            </thead>
            <tbody>
              {apps.slice(0, 6).map((a, i) => {
                const st = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.other;
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.65 + i * 0.07, duration: 0.4 }}
                    style={{ cursor: "pointer" }}
                    className="premium-row"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.035)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    {/* Company */}
                    <td style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                          width: "30px", height: "30px", borderRadius: "8px",
                          background: "linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))",
                          border: "1px solid rgba(255,255,255,0.07)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <Building2 size={14} color="#D8D8D8" />
                        </div>
                        <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text)", letterSpacing: 0 }}>
                          {a.company}
                        </span>
                      </div>
                    </td>
                    {/* Position */}
                    <td style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Briefcase size={12} color="var(--muted)" />
                        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{a.position}</span>
                      </div>
                    </td>
                    {/* Contact */}
                    <td style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <User size={12} color="var(--muted)" />
                        <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{a.hr_name}</span>
                      </div>
                      {a.hr_email && <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: 3 }}>{a.hr_email}</div>}
                    </td>
                    {/* Status */}
                    <td style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "4px 10px", borderRadius: "99px",
                        background: st.bg, color: st.color,
                        fontSize: "11.5px", fontWeight: 700,
                        border: `1px solid ${st.color}30`,
                      }}>
                        <span style={{
                          width: "5px", height: "5px", borderRadius: "50%",
                          background: st.color, boxShadow: `0 0 6px ${st.color}`,
                          animation: "pulse-dot 2s ease-in-out infinite",
                        }} />
                        {st.label}
                      </span>
                    </td>
                    {/* Date */}
                    <td style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                        {a.sent_at ? new Date(a.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                    </td>
                    {/* Arrow */}
                    <td style={{ padding: "12px 18px 12px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <ChevronRight size={14} color="var(--text-dim)" />
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}
