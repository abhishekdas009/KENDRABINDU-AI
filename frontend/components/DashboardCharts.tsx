"use client";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const areaData = [
  { day: "Mon", sent: 42, opened: 31, clicked: 14 },
  { day: "Tue", sent: 67, opened: 48, clicked: 22 },
  { day: "Wed", sent: 55, opened: 39, clicked: 18 },
  { day: "Thu", sent: 88, opened: 65, clicked: 32 },
  { day: "Fri", sent: 74, opened: 54, clicked: 27 },
  { day: "Sat", sent: 35, opened: 23, clicked: 10 },
  { day: "Sun", sent: 50, opened: 36, clicked: 17 },
];

const donutData = [
  { name: "Opened",     value: 54, color: "#4D7CFE" },
  { name: "Clicked",    value: 23, color: "#8B5CF6" },
  { name: "Bounced",    value: 8,  color: "#EF4444" },
  { name: "Pending",    value: 15, color: "#F59E0B" },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{name: string; value: number; color: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(8, 8, 8, 0.96)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "12px 16px",
      backdropFilter: "blur(20px)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
    }}>
      <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px" }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", textTransform: "capitalize" }}>{p.name}:</span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomDonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{name: string; value: number; payload: {color: string}}> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{
      background: "rgba(8, 8, 8, 0.96)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px", padding: "10px 14px", backdropFilter: "blur(20px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text)" }}>{p.name}: </span>
      <span style={{ fontSize: "12.5px", color: p.payload.color }}>{p.value}%</span>
    </div>
  );
}

const RADIAN = Math.PI / 180;
function CustomLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number;
}) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.08) return null;
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function DashboardCharts() {
  return (
    <div className="dashboard-charts-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)", gap: "14px", minWidth: 0, alignItems: "start" }}>
      {/* Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "rgba(12, 12, 12, 0.94)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          padding: "18px",
          height: "fit-content",
        }}
      >
        <div style={{ marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, letterSpacing: 0, color: "var(--text)", marginBottom: "4px" }}>
              Email Activity
            </h3>
            <p style={{ fontSize: "12px", color: "var(--muted)" }}>7-day performance overview</p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {[
              { label: "Sent", color: "#4D7CFE" },
              { label: "Opened", color: "#8B5CF6" },
              { label: "Clicked", color: "#22D3EE" },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                <span style={{ fontSize: "11.5px", color: "var(--muted)", fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={areaData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4D7CFE" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4D7CFE" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOpened" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradClicked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
              </linearGradient>
              <filter id="glow-blue">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#5B6478", fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#5B6478", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />
            <Area type="monotone" dataKey="sent" stroke="#4D7CFE" strokeWidth={2.5} fill="url(#gradSent)" dot={false} />
            <Area type="monotone" dataKey="opened" stroke="#8B5CF6" strokeWidth={2} fill="url(#gradOpened)" dot={false} />
            <Area type="monotone" dataKey="clicked" stroke="#22D3EE" strokeWidth={2} fill="url(#gradClicked)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Donut Chart */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "rgba(12, 12, 12, 0.94)",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          minHeight: 342,
        }}
      >
        <div style={{ marginBottom: "10px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, letterSpacing: 0, color: "var(--text)", marginBottom: "4px" }}>
            Delivery Breakdown
          </h3>
          <p style={{ fontSize: "12px", color: "var(--muted)" }}>Campaign performance split</p>
        </div>

        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Ambient glow behind donut */}
          <div style={{
            position: "absolute", width: "160px", height: "160px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(77,124,254,0.12) 0%, transparent 70%)",
            animation: "rotate-slow 12s linear infinite",
          }} />

          <PieChart width={200} height={200}>
            <defs>
              {donutData.map((d) => (
                <radialGradient key={d.name} id={`rg-${d.name}`} cx="50%" cy="50%">
                  <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={d.color} stopOpacity={0.7} />
                </radialGradient>
              ))}
            </defs>
            <Pie
              data={donutData}
              cx={100} cy={100}
              innerRadius={58}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              labelLine={false}
              label={CustomLabel}
              animationBegin={300}
              animationDuration={1200}
            >
              {donutData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={`url(#rg-${entry.name})`}
                  stroke={entry.color}
                  strokeWidth={1}
                  style={{ filter: `drop-shadow(0 0 8px ${entry.color}44)`, cursor: "pointer" }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomDonutTooltip />} />
          </PieChart>

          {/* Center label */}
          <div style={{
            position: "absolute",
            textAlign: "center",
            pointerEvents: "none",
          }}>
            <div style={{ fontSize: "22px", fontWeight: 800, letterSpacing: 0, color: "var(--text)" }}>77%</div>
            <div style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 600, letterSpacing: "0.04em" }}>DELIVERED</div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
          {donutData.map(({ name, value, color }) => (
            <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{name}</span>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color }}>{value}%</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
