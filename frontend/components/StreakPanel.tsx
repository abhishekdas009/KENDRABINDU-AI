"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Flame, Mail, Trophy, type LucideIcon } from "lucide-react";
import { getStreak } from "@/lib/api";

interface Streak {
  current_streak: number;
  best_streak: number;
  total_sends: number;
  today_sends: number;
  goal: number;
  goal_complete: boolean;
  whatsapp_to: string;
  email_to: string;
  whatsapp_configured: boolean;
}

export default function StreakPanel() {
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    getStreak().then(setStreak).catch(() => {});
  }, []);

  const progress = streak ? Math.min(100, Math.round((streak.today_sends / streak.goal) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(12, 12, 12, 0.94)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Application Streak</h3>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>Daily send momentum</p>
        </div>
        <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Flame size={20} color="#F4F4F4" />
        </motion.div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat icon={Flame} label="Current" value={`${streak?.current_streak ?? 0} days`} />
        <Stat icon={Trophy} label="Best" value={`${streak?.best_streak ?? 0} days`} />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          <span>Today</span>
          <span>{streak?.today_sends ?? 0}/{streak?.goal ?? 3} sends</span>
        </div>
        <div style={{ height: 10, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8 }} style={{ height: "100%", background: "linear-gradient(90deg, #BDBDBD, #FFFFFF)", borderRadius: 99 }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 2 }}>
        <Notice icon={Mail} text={`Email streak alerts: ${streak?.email_to || "not configured"}`} />
        <Notice icon={Bell} text={streak?.whatsapp_configured ? `WhatsApp alerts: ${streak.whatsapp_to}` : "WhatsApp alerts need provider webhook"} />
      </div>
    </motion.div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div style={{ padding: 11, borderRadius: 8, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <Icon size={15} color="#D8D8D8" />
      <div style={{ color: "var(--text)", fontSize: 17, fontWeight: 850, marginTop: 6 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function Notice({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 11.5 }}>
      <Icon size={13} color="#A8A8A8" />
      <span>{text}</span>
    </div>
  );
}
