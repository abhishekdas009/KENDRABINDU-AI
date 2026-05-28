"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Send, FileText, Users,
  ScrollText, ChevronLeft,
  ChevronRight, Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FireStreakLogo from "@/components/FireStreakLogo";

const NAV = [
  { href: "/dashboard",   label: "Dashboard",  icon: LayoutDashboard, accent: "#D8D8D8" },
  { href: "/",            label: "Send Mail",   icon: Send,            accent: "#D8D8D8" },
  { href: "/streak",      label: "Streak",      icon: Flame,           accent: "#D8D8D8" },
  { href: "/templates",   label: "Templates",   icon: FileText,        accent: "#D8D8D8" },
  { href: "/contacts",    label: "Contacts",    icon: Users,           accent: "#D8D8D8" },
  { href: "/tracker",     label: "Mail Logs",   icon: ScrollText,      accent: "#D8D8D8" },
];

export default function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      className="app-sidebar"
      animate={{ width: collapsed ? 88 : 240 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        top: 0, left: 0,
        height: "100dvh",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Glass Panel */}
      <div
        className="app-sidebar-panel"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(7, 7, 7, 0.94)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "4px 0 40px rgba(0,0,0,0.5), inset -1px 0 0 rgba(255,255,255,0.04)",
        }}
      />

      {/* Gradient Edge Light */}
      <div style={{
        position: "absolute",
        top: 0, right: 0,
        width: "1px",
        height: "100%",
        background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.20) 35%, rgba(255,255,255,0.08) 70%, transparent)",
      }} className="app-sidebar-edge" />

      {/* Content */}
      <div className="app-sidebar-content" style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", padding: "20px 0" }}>

        {/* Logo */}
        <div className="app-sidebar-logo" style={{
          padding: collapsed ? "0 0 28px" : "0 20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: "12px",
          transition: "padding 0.35s ease",
        }}>
          <motion.div
            whileHover={{ scale: 1.06, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            style={{ flexShrink: 0 }}
          >
            <FireStreakLogo size="nav" label="KendraBindu AI streak logo" />
          </motion.div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <div style={{ fontWeight: 800, fontSize: "15px", letterSpacing: 0, color: "var(--text)", lineHeight: 1 }}>
                  KendraBindu AI
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "2px", letterSpacing: "0.03em", fontWeight: 500 }}>
                  AI ENGINE v3
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="app-sidebar-nav" style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV.map(({ href, label, icon: Icon, accent }) => {
            const active = path === href;
            return (
              <Link key={href} href={href} className="app-sidebar-link" style={{ textDecoration: "none" }}>
                <motion.div
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "11px",
                    padding: collapsed ? "11px 0" : "10px 13px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: "12px",
                    position: "relative",
                    cursor: "pointer",
                    background: active
                      ? `linear-gradient(135deg, ${accent}22 0%, ${accent}0f 100%)`
                      : "transparent",
                    border: active ? `1px solid ${accent}33` : "1px solid transparent",
                    boxShadow: active ? `0 0 20px ${accent}22, inset 0 1px 0 ${accent}18` : "none",
                    transition: "background 0.25s ease, border 0.25s ease, box-shadow 0.25s ease",
                  }}
                  className={!active ? "sidebar-nav-item" : ""}
                >
                  {/* Active sweep shine */}
                  {active && (
                    <motion.div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "12px",
                        overflow: "hidden",
                        pointerEvents: "none",
                      }}
                    >
                      <motion.div
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
                        style={{
                          position: "absolute",
                          top: 0, bottom: 0,
                          width: "40%",
                          background: `linear-gradient(90deg, transparent, ${accent}20, transparent)`,
                          transform: "skewX(-15deg)",
                        }}
                      />
                    </motion.div>
                  )}

                  {/* Icon */}
                  <motion.div
                    animate={active ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                    color: active ? accent : "var(--muted)",
                      display: "flex", alignItems: "center",
                      filter: active ? `drop-shadow(0 0 6px ${accent}88)` : "none",
                      flexShrink: 0,
                      transition: "color 0.25s, filter 0.25s",
                    }}
                  >
                    <Icon size={16} strokeWidth={active ? 2 : 1.75} />
                  </motion.div>

                  {/* Label */}
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          fontSize: "13.5px",
                          fontWeight: active ? 600 : 450,
                          color: active ? "var(--text)" : "var(--muted)",
                          letterSpacing: 0,
                          whiteSpace: "nowrap",
                          transition: "color 0.25s",
                        }}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Active dot when collapsed */}
                  {active && collapsed && (
                    <motion.div
                      layoutId="active-dot"
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 4, height: 4,
                        borderRadius: "50%",
                        background: accent,
                        boxShadow: `0 0 8px ${accent}`,
                      }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Status + Collapse */}
        <div className="app-sidebar-footer" style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Status */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 13px",
                  background: "rgba(255, 255, 255, 0.045)",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.10)",
                }}
              >
                <div style={{
                  width: 7, height: 7,
                  borderRadius: "50%",
                  background: "#D8D8D8",
                  boxShadow: "0 0 8px rgba(255,255,255,0.28)",
                  animation: "pulse-dot 2s ease-in-out infinite",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: "11.5px", color: "#D8D8D8", fontWeight: 600, letterSpacing: "0.01em" }}>
                  Backend connected
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse Toggle */}
          <motion.button
            className="sidebar-collapse"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setCollapsed(c => !c)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 13px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              color: "var(--muted)",
              cursor: "pointer",
              width: "100%",
              transition: "all 0.2s ease",
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : (
              <>
                <ChevronLeft size={14} />
                <span style={{ fontSize: "12px", fontWeight: 500 }}>Collapse</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      <style jsx global>{`
        .sidebar-nav-item:hover {
          background: rgba(255,255,255,0.03) !important;
          border-color: rgba(255,255,255,0.05) !important;
        }
        .sidebar-nav-item:hover > div {
          color: var(--text-secondary) !important;
        }
        .sidebar-nav-item:hover > span {
          color: var(--text-secondary) !important;
        }
      `}</style>
    </motion.aside>
  );
}
