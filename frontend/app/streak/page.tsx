"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, CalendarDays, Flame, Mail, Target, Trophy, User } from "lucide-react";
import { getStreakHistory } from "@/lib/api";
import FireStreakLogo from "@/components/FireStreakLogo";

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
  const currentStreak = history?.current_streak ?? 0;
  const todaySends = history?.today_sends ?? 0;
  const goal = history?.goal ?? 3;
  const progress = Math.min(100, Math.round((todaySends / Math.max(goal, 1)) * 100));

  return (
    <div className="streak-page">
      <motion.section
        className="streak-hero"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="streak-hero-copy">
          <div className="streak-kicker">
            <Flame size={14} />
            Streak tracker
          </div>
          <h1>Application Streak</h1>
          <p>Daily sends, past streaks, and every recruiter counted in your momentum.</p>

          <div className="streak-hero-metrics">
            <div>
              <span>Current run</span>
              <strong>{currentStreak} days</strong>
            </div>
            <div>
              <span>Today</span>
              <strong>{todaySends}/{goal}</strong>
            </div>
          </div>
        </div>

        <div className="streak-hero-visual">
          <FireStreakLogo size="hero" />
          <div className="streak-goal-card">
            <span>Daily goal</span>
            <strong>{progress}%</strong>
            <div className="streak-goal-track">
              <div className="streak-goal-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </motion.section>

      <div className="streak-stats-grid">
        {stats.map(({ label, value, icon: Icon }, index) => (
          <motion.div
            key={label}
            className="streak-stat-card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <span>
              <Icon size={18} />
            </span>
            <strong>{value}</strong>
            <small>{label}</small>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="streak-history-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="streak-history-head">
          <h2>Past Streak Details</h2>
          <p>Grouped by day with who received each application.</p>
        </div>

        {loading ? (
          <div className="streak-empty">Loading streak history...</div>
        ) : error ? (
          <div className="streak-empty">{error}</div>
        ) : !history?.days.length ? (
          <div className="streak-empty">No streak events yet.</div>
        ) : (
          <div className="streak-day-list">
            {history.days.map((day) => (
              <div key={day.event_date} className="streak-day">
                <div className="streak-day-head">
                  <div className="streak-day-title">
                    <CalendarDays size={16} />
                    <div>
                      <strong>
                        {new Date(`${day.event_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </strong>
                      <small>{day.total_sends} send{day.total_sends === 1 ? "" : "s"}</small>
                    </div>
                  </div>
                  <span className="streak-goal-pill">
                    {day.total_sends}/{history.goal} daily goal
                  </span>
                </div>

                <div className="streak-send-grid">
                  {day.sends.map((send) => (
                    <div key={send.event_id} className="streak-send-card">
                      <div className="streak-row streak-row-strong">
                        <User size={14} />
                        <span>{send.hr_name || "Hiring Team"}</span>
                      </div>
                      <div className="streak-row">
                        <Mail size={12} />
                        <span>{send.hr_email || "No email saved"}</span>
                      </div>
                      <div className="streak-row">
                        <Briefcase size={12} />
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
