"use client";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, MousePointerClick, Sparkles, ArrowRight } from "lucide-react";

const INSIGHTS = [
  {
    icon: TrendingUp,
    title: "High Open Rate",
    desc: "Tuesday sends have 34% higher open rates. Schedule more campaigns on Tue.",
    accent: "#D8D8D8",
    tag: "Trend Detected",
  },
  {
    icon: AlertTriangle,
    title: "Bounce Warning",
    desc: "8 emails bounced this week. Clean your contact list to protect sender reputation.",
    accent: "#D8D8D8",
    tag: "Action Required",
  },
  {
    icon: MousePointerClick,
    title: "CTR Opportunity",
    desc: "Campaigns with personalized subject lines achieve 2.4× higher click rates.",
    accent: "#D8D8D8",
    tag: "AI Insight",
  },
  {
    icon: Sparkles,
    title: "AI Recommendation",
    desc: "Try follow-up sequences 3 days after initial send. Increases replies by 67%.",
    accent: "#D8D8D8",
    tag: "Recommended",
  },
];

export default function InsightsPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(12, 12, 12, 0.94)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px", gap: 10 }}>
        <div>
          <h3 style={{ fontSize: "15px", fontWeight: 700, letterSpacing: 0, color: "var(--text)", marginBottom: "3px" }}>
            AI Insights
          </h3>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>Powered by intelligence</p>
        </div>
        <div style={{
          padding: "4px 10px", borderRadius: "99px",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          <Sparkles size={11} color="#D8D8D8" />
          <span style={{ fontSize: "10.5px", color: "#D8D8D8", fontWeight: 700 }}>Live</span>
        </div>
      </div>

      {INSIGHTS.map((item, i) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.55 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ x: 4 }}
          style={{
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.025)",
            border: `1px solid rgba(255,255,255,0.055)`,
            cursor: "default",
            position: "relative",
            overflow: "hidden",
            transition: "border-color 0.25s ease, background 0.25s ease",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.16)";
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.055)";
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)";
          }}
        >
          {/* Glow */}
          <div style={{
            position: "absolute", top: "-20px", right: "-20px",
            width: "80px", height: "80px", borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            {/* Icon */}
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
              }}
            >
              <item.icon size={15} color={item.accent} strokeWidth={2} />
            </motion.div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", letterSpacing: 0 }}>
                  {item.title}
                </span>
                <span style={{
                  padding: "1.5px 7px", borderRadius: "99px",
                  background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)",
                  fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.03em",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}>
                  {item.tag}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.55 }}>{item.desc}</p>
            </div>
          </div>

          {/* Arrow hint */}
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            whileHover={{ opacity: 1, x: 0 }}
            style={{
              position: "absolute", right: "14px", top: "50%",
              transform: "translateY(-50%)",
              color: item.accent,
            }}
          >
            <ArrowRight size={13} />
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}
