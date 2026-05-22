"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, CalendarDays, Flame, Mail, Target, Trophy, User } from "lucide-react";
import { getStreakHistory } from "@/lib/api";

interface StreakSend {
  event_id: number;
  application_id: number;
  hr_email: string;
  hr_name: string;
  company: string;
  position: string;
  status: string;
  created_at: string;
}

interface StreakDay {
  event_date: string;
  total_sends: number;
  sends: StreakSend[];
}

interface StreakHistory {
  current_streak: number;
  best_streak: number;
  total_sends: number;
  today_sends: number;
  goal: number;
  days: StreakDay[];
}

export default function StreakPage() {
  const [history, setHistory] = useState<StreakHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getStreakHistory()
      .then(setHistory)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load streak history"))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: "Current", value: `${history?.current_streak ?? 0} days`, icon: Flame },
    { label: "Best", value: `${history?.best_streak ?? 0} days`, icon: Trophy },
    { label: "Today", value: `${history?.today_sends ?? 0}/${history?.goal ?? 3}`, icon: Target },
    { label: "Total Sends", value: `${history?.total_sends ?? 0}`, icon: Mail },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0, color: "var(--text)" }}>Streak Tracker</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Daily sends, past streaks, and every recruiter counted in the streak.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
        {stats.map(({ label, value, icon: Icon }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{
              background: "rgba(12, 12, 12, 0.94)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 18,
              minHeight: 116,
            }}
          >
            <Icon size={18} color="#D8D8D8" />
            <div style={{ color: "var(--text)", fontSize: 24, fontWeight: 850, marginTop: 12 }}>{value}</div>
            <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "rgba(12, 12, 12, 0.94)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ color: "var(--text)", fontSize: 16, fontWeight: 800, letterSpacing: 0 }}>Past Streak Details</h2>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>Grouped by day with who received each application.</p>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>Loading streak history...</div>
        ) : error ? (
          <div style={{ padding: 24, color: "var(--text-secondary)", fontSize: 13 }}>{error}</div>
        ) : !history?.days.length ? (
          <div style={{ padding: 24, color: "var(--muted)", fontSize: 13 }}>No streak events yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {history.days.map((day) => (
              <div key={day.event_date} style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CalendarDays size={16} color="#D8D8D8" />
                    <div>
                      <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 800 }}>
                        {new Date(`${day.event_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 11 }}>{day.total_sends} send{day.total_sends === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <span style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>
                    {day.total_sends}/{history.goal} daily goal
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                  {day.sends.map((send) => (
                    <div key={send.event_id} style={{ padding: 13, borderRadius: 12, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                        <User size={14} color="#D8D8D8" />
                        <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 750 }}>{send.hr_name || "Hiring Team"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12, marginBottom: 5 }}>
                        <Mail size={12} color="var(--muted)" />
                        <span>{send.hr_email || "No email saved"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                        <Briefcase size={12} color="var(--muted)" />
                        <span>{send.position || "Position not set"}{send.company ? ` at ${send.company}` : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
