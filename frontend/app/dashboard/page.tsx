"use client";
import { motion } from "framer-motion";
import KPICard from "@/components/KPICard";
import DashboardCharts from "@/components/DashboardCharts";
import RecentSendsTable from "@/components/RecentSendsTable";
import RecentReplies from "@/components/RecentReplies";
import StreakPanel from "@/components/StreakPanel";
import { Send, Eye, MousePointerClick, AlertTriangle, PlayCircle } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="dashboard-page">
      {/* Header */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <h1 style={{
            fontSize: "26px", fontWeight: 800, letterSpacing: 0,
            color: "var(--text)", marginBottom: "3px",
          }}>
            Dashboard
          </h1>
          <p style={{ fontSize: "14px", color: "var(--muted)" }}>
            Welcome back. Here is your intelligence overview.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "linear-gradient(135deg, #1A1A1A 0%, #090909 100%)",
            color: "var(--text)", border: "1px solid rgba(255,255,255,0.14)",
            padding: "9px 14px", borderRadius: "8px",
            fontSize: "13.5px", fontWeight: 600,
            boxShadow: "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
            cursor: "pointer",
          }}
        >
          <PlayCircle size={16} />
          New Campaign
        </motion.button>
      </motion.div>

      {/* KPI Cards Grid */}
      <div className="dashboard-kpi-grid">
        <KPICard label="Total Sent"    value={12405} trend={12.5} icon={Send} accent="#D8D8D8" delay={0.1} />
        <KPICard label="Avg Open Rate" value={48.2}  trend={5.4}  icon={Eye} accent="#D8D8D8" delay={0.15} suffix="%" />
        <KPICard label="Click Rate"    value={14.6}  trend={2.1}  icon={MousePointerClick} accent="#D8D8D8" delay={0.2} suffix="%" />
        <KPICard label="Bounced"       value={3.1}   trend={-1.2} icon={AlertTriangle} accent="#D8D8D8" delay={0.25} suffix="%" />
      </div>

      {/* Charts & Insights */}
      <div className="dashboard-main-grid">
        <DashboardCharts />
        <div className="dashboard-side-stack">
          <StreakPanel />
          <RecentReplies />
        </div>
      </div>

      {/* Recent Activity Table */}
      <RecentSendsTable />
    </div>
  );
}
