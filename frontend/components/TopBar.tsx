"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CalendarDays, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getNotifications, markNotificationRead } from "@/lib/api";

interface Notif {
  id: number;
  message: string;
  company: string;
  hr_name: string;
  created_at: string;
}

const DATE_RANGES = ["Today", "Last 7 days", "Last 30 days", "Last 90 days"];

export default function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [dateRange, setDateRange] = useState("Last 30 days");
  const [dateOpen, setDateOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getNotifications();
        setNotifs(data);
      } catch {}
    };
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) setDateOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const dismiss = async (id: number) => {
    try {
      await markNotificationRead(id);
    } catch {}
    setNotifs((current) => current.filter((item) => item.id !== id));
  };

  return (
    <motion.header
      className="topbar"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div ref={dateRef} className="topbar-date">
        <button type="button" className="topbar-control" onClick={() => setDateOpen((open) => !open)}>
          <CalendarDays size={15} />
          <span>{dateRange}</span>
          <ChevronDown size={14} />
        </button>

        <AnimatePresence>
          {dateOpen && (
            <motion.div
              className="topbar-menu"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
            >
              {DATE_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={dateRange === range ? "is-selected" : ""}
                  onClick={() => {
                    setDateRange(range);
                    setDateOpen(false);
                  }}
                >
                  {range}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`topbar-search ${searchOpen ? "is-open" : ""}`}>
        <button
          type="button"
          aria-label="Search"
          className="topbar-search-icon"
          onClick={() => {
            setSearchOpen(true);
            searchRef.current?.focus();
          }}
        >
          <Search size={15} />
        </button>
        <input
          ref={searchRef}
          value={searchVal}
          onChange={(event) => setSearchVal(event.target.value)}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search contacts..."
        />
        {searchVal && (
          <button type="button" aria-label="Clear search" className="topbar-clear" onClick={() => setSearchVal("")}>
            <X size={14} />
          </button>
        )}
      </div>

      <div ref={notifRef} className="topbar-notifs">
        <button
          type="button"
          className={`topbar-icon-button ${notifOpen ? "is-open" : ""}`}
          onClick={() => setNotifOpen((open) => !open)}
          aria-label="Notifications"
        >
          <motion.span
            animate={notifs.length > 0 ? { rotate: [0, -8, 8, -4, 0] } : {}}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 6 }}
          >
            <Bell size={15} />
          </motion.span>
          {notifs.length > 0 && <span className="notif-count">{notifs.length}</span>}
        </button>

        <AnimatePresence>
          {notifOpen && (
            <motion.div
              className="notif-menu"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="notif-menu-head">
                <strong>Notifications</strong>
                {notifs.length > 0 && <span>{notifs.length} new</span>}
              </div>
              <div className="notif-list">
                {notifs.length === 0 ? (
                  <div className="notif-empty">No new notifications</div>
                ) : (
                  notifs.map((notif, index) => (
                    <motion.div
                      key={notif.id}
                      className="notif-item"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <div>
                        <p>{notif.message}</p>
                        <span>{notif.company} - {notif.hr_name}</span>
                      </div>
                      <button type="button" onClick={() => dismiss(notif.id)} aria-label="Dismiss notification">
                        <X size={13} />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
