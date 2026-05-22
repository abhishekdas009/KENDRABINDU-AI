"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: number;
  suffix?: string;
  trend: number;
  icon: LucideIcon;
  accent: string;
  delay?: number;
}

function useCountUp(target: number, duration = 1600, enabled = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, enabled]);
  return count;
}

export default function KPICard({ label, value, suffix = "", trend, icon: Icon, accent, delay = 0 }: KPICardProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = useCountUp(value, 1400, visible);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  const trendUp = trend >= 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      style={{
        position: "relative",
        background: "rgba(12, 12, 12, 0.94)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        padding: "18px",
        overflow: "hidden",
        cursor: "default",
        boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
        transition: "box-shadow 0.3s ease, border-color 0.3s ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 48px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.08)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 32px rgba(0,0,0,0.3)";
      }}
    >
      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "-30px", right: "-30px",
        width: "140px", height: "140px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.045) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Shimmer sweep */}
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }}
        style={{
          position: "absolute", top: 0, bottom: 0,
          width: "40%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)",
          transform: "skewX(-15deg)",
          pointerEvents: "none",
        }}
      />

      {/* Icon */}
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "44px", height: "44px",
          borderRadius: "13px",
          background: "linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 100%)",
          border: "1px solid rgba(255,255,255,0.14)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "14px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        }}
      >
        <Icon size={20} color={accent} strokeWidth={1.75} />
      </motion.div>

      {/* Value */}
      <div style={{ marginBottom: "6px" }}>
        <motion.span
          key={count}
          style={{
            fontSize: "34px",
            fontWeight: 800,
            letterSpacing: 0,
            color: "var(--text)",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count.toLocaleString()}{suffix}
        </motion.span>
      </div>

      {/* Label */}
      <div style={{ fontSize: "12.5px", color: "var(--muted)", fontWeight: 600, letterSpacing: "0.02em", marginBottom: "10px" }}>
        {label}
      </div>

      {/* Trend */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "4px",
          padding: "3px 8px", borderRadius: "99px",
          background: trendUp ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
          color: trendUp ? "var(--text)" : "var(--text-secondary)",
          fontSize: "11.5px", fontWeight: 700,
        }}>
          {trendUp ? "↑" : "↓"} {Math.abs(trend)}%
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>vs last period</span>
      </div>
    </motion.div>
  );
}
