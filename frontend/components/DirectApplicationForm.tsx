"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { directSendApplication, getApplications, parseRecipient, simpleFailureReason } from "@/lib/api";
import {
  AlertCircle,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  List,
  Loader2,
  Mail,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface ParsedRecipient {
  hr_email: string;
  hr_name: string;
  company: string;
  position: string;
  is_personal_domain: boolean;
  company_needs_review: boolean;
  confidence: string;
  source: string;
  profiles?: Array<{ type: string; title: string; url: string; confidence: string }>;
}

type JobStatus = "running" | "sent" | "error";

interface SendJob {
  id: string;
  hrEmail: string;
  hrName: string;
  company: string;
  position: string;
  jobDescription: string;
  stage: number;
  progress: number;
  status: JobStatus;
  message: string;
  attachments: string[];
  startedAt: number;
  completedAt?: number;
}

interface ApplicationRecord {
  id: number;
  sent_at?: string;
  status?: string;
}

interface MailInsights {
  today: number;
  week: number;
  month: number;
  successRate: number;
  failureRate: number;
  totalSent: number;
  totalFailed: number;
}

const FLOW_STAGES: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Preparing Email", icon: FileCheck2 },
  { label: "Sending Email", icon: Send },
  { label: "Email Sent", icon: CheckCircle2 },
];

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail",
  "googlemail",
  "yahoo",
  "ymail",
  "hotmail",
  "outlook",
  "live",
  "icloud",
  "proton",
  "protonmail",
  "zoho",
  "rediffmail",
  "fastmail",
]);

function emailParts(value: string) {
  const clean = value.trim().toLowerCase().replace(/\s/g, "");
  const match = clean.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (!match) return null;
  const [, local, domain] = match;
  const bits = domain.split(".");
  const companyToken = bits.length >= 2 ? bits[bits.length - 2] : bits[0];
  return { clean, local, domain, companyToken };
}

function titleFromEmailLocal(local: string) {
  const tokens = local
    .replace(/\d+/g, "")
    .split(/[._+\-]+/)
    .filter(Boolean)
    .filter((token) => !["hr", "jobs", "careers", "recruiting", "recruitment"].includes(token));
  const useful = tokens.length ? tokens.slice(-2) : [local.replace(/\d+/g, "")];
  return useful
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ")
    .trim();
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek() {
  const value = startOfToday();
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value;
}

function startOfMonth() {
  const value = startOfToday();
  value.setDate(1);
  return value;
}

function sentDate(app: ApplicationRecord) {
  if (!app.sent_at) return null;
  const value = new Date(app.sent_at);
  return Number.isNaN(value.getTime()) ? null : value;
}

function buildInsights(apps: ApplicationRecord[], failedCount: number): MailInsights {
  const todayStart = startOfToday();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();
  const sentDates = apps.map(sentDate).filter((value): value is Date => Boolean(value));
  const totalSent = apps.length;
  const total = totalSent + failedCount;

  return {
    today: sentDates.filter((value) => value >= todayStart).length,
    week: sentDates.filter((value) => value >= weekStart).length,
    month: sentDates.filter((value) => value >= monthStart).length,
    successRate: total ? Math.round((totalSent / total) * 1000) / 10 : 0,
    failureRate: total ? Math.round((failedCount / total) * 1000) / 10 : 0,
    totalSent,
    totalFailed: failedCount,
  };
}

export default function DirectApplicationForm() {
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipient | null>(null);
  const [hrName, setHrName] = useState("");
  const [company, setCompany] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<SendJob[]>([]);
  const [totals, setTotals] = useState({ sent: 0, failed: 0 });
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const controllersRef = useRef<Record<string, AbortController>>({});
  const companyInputRef = useRef<HTMLInputElement | null>(null);
  const successTimersRef = useRef<Record<string, number>>({});

  const loadApplications = async () => {
    try {
      const data = await getApplications();
      setApplications(Array.isArray(data) ? data : []);
    } catch {
      setApplications([]);
    }
  };

  useEffect(() => {
    let mounted = true;
    const timers = successTimersRef.current;

    getApplications()
      .then((data) => {
        if (mounted) setApplications(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (mounted) setApplications([]);
      });

    return () => {
      mounted = false;
      Object.values(timers).forEach(window.clearTimeout);
    };
  }, []);

  const insights = useMemo(() => buildInsights(applications, totals.failed), [applications, totals.failed]);

  const updateJob = (id: string, patch: Partial<SendJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  };

  const removeJob = (id: string) => {
    setJobs((current) => current.filter((job) => job.id !== id));
  };

  const openPublicEmailReview = (value: string, nextPosition = position, resetCompany = false) => {
    const parts = emailParts(value);
    if (!parts || !PUBLIC_EMAIL_DOMAINS.has(parts.companyToken)) {
      setParsed((current) => (current?.source === "public-domain-auto" ? null : current));
      return false;
    }

    const inferredName = titleFromEmailLocal(parts.local) || "Hiring Team";
    setParsed({
      hr_email: parts.clean,
      hr_name: inferredName,
      company: "",
      position: nextPosition,
      is_personal_domain: true,
      company_needs_review: true,
      confidence: "medium",
      source: "public-domain-auto",
    });
    setHrName((current) => (resetCompany ? inferredName : current || inferredName));
    if (resetCompany) {
      setCompany("");
      window.setTimeout(() => companyInputRef.current?.focus(), 0);
    }
    return true;
  };

  const preview = async () => {
    if (!email.trim() || !position.trim()) {
      setError("Enter recruiter email and position");
      return;
    }
    setLoadingPreview(true);
    setError("");
    try {
      const data = await parseRecipient(email, position);
      setParsed(data);
      setHrName(data.hr_name || "");
      setCompany(data.company || "");
    } catch (e: unknown) {
      setError(simpleFailureReason(e));
    } finally {
      setLoadingPreview(false);
    }
  };

  const clearComposer = () => {
    setEmail("");
    setPosition("");
    setJobDescription("");
    setParsed(null);
    setHrName("");
    setCompany("");
  };

  const runSendJob = async (
    id: string,
    payload: {
      hr_email: string;
      position: string;
      hr_name?: string;
      company?: string;
      job_description?: string;
    },
  ) => {
    const controller = new AbortController();
    controllersRef.current[id] = controller;

    const progressTimer = window.setInterval(() => {
      setJobs((current) =>
        current.map((job) =>
          job.id === id && job.status === "running"
            ? { ...job, progress: Math.min(job.progress + (job.progress < 70 ? 9 : 3), 94) }
            : job,
        ),
      );
    }, 430);
    const stageTimers = [
      window.setTimeout(() => updateJob(id, { stage: 1, message: "Sending email" }), 850),
      window.setTimeout(() => updateJob(id, { stage: 2, message: "Waiting for SMTP confirmation" }), 2600),
    ];

    try {
      await directSendApplication(payload, { signal: controller.signal });
      setTotals((current) => ({ ...current, sent: current.sent + 1 }));
      updateJob(id, {
        stage: 2,
        progress: 100,
        status: "sent",
        message: "Application sent successfully.",
        completedAt: Date.now(),
      });
      void loadApplications();
      successTimersRef.current[id] = window.setTimeout(() => {
        removeJob(id);
        delete successTimersRef.current[id];
      }, 5000);
    } catch (e: unknown) {
      const reason = simpleFailureReason(e);
      setTotals((current) => ({ ...current, failed: current.failed + 1 }));
      updateJob(id, {
        stage: 1,
        progress: 100,
        status: "error",
        message: reason,
        completedAt: Date.now(),
      });
    } finally {
      window.clearInterval(progressTimer);
      stageTimers.forEach(window.clearTimeout);
      delete controllersRef.current[id];
    }
  };

  const send = () => {
    if (!email.trim() || !position.trim()) {
      setError("Enter recruiter email and position");
      return;
    }
    if (parsed?.company_needs_review && !company.trim()) {
      setError("Enter the company name for public email domains like Gmail.");
      companyInputRef.current?.focus();
      return;
    }

    const payload = {
      hr_email: (parsed?.hr_email || email).trim(),
      position: position.trim(),
      hr_name: hrName.trim() || undefined,
      company: company.trim() || undefined,
      job_description: jobDescription.trim() || undefined,
    };
    const job: SendJob = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      hrEmail: payload.hr_email,
      hrName: payload.hr_name || parsed?.hr_name || "Hiring Team",
      company: payload.company || parsed?.company || "",
      position: payload.position,
      jobDescription: payload.job_description || "",
      stage: 0,
      progress: 12,
      status: "running",
      message: "Preparing email",
      attachments: [],
      startedAt: Date.now(),
    };

    setError("");
    setJobs((current) => [job, ...current]);
    clearComposer();
    void runSendJob(job.id, payload);
  };

  const cancelSend = (id: string) => {
    controllersRef.current[id]?.abort();
  };

  const canPreview = Boolean(email.trim() && position.trim());
  const needsCompany = Boolean(parsed?.company_needs_review);
  const canSend = canPreview && (!needsCompany || Boolean(company.trim()));
  const activeCount = jobs.filter((job) => job.status === "running").length;

  return (
    <div className="mail-flow mail-flow-compose">
      <div className="compose-screen">
        <div className="compose-hero">
          <div className="compose-hero-main">
            <span className="compose-hero-icon">
              <Sparkles size={25} />
            </span>
            <div>
              <h1>AI Application Engine</h1>
              <p>Streamline hiring with AI-powered application sending.</p>
            </div>
          </div>
        </div>

        <div className="send-workspace">
          <section className="composer-panel">
            <div className="composer-kicker">
              <Sparkles size={13} />
              Parallel sender ready
            </div>

            <div className="composer-head">
              <div className="composer-title-row">
                <span className="composer-icon">
                  <Send size={21} />
                </span>
                <div>
                  <h2>Direct Application Sender</h2>
                  <p>
                    Add a recruiter, role, and optional job description. Every send moves into the
                    live rail while this composer resets for the next application.
                  </p>
                </div>
              </div>
              <div className="composer-count">
                <strong>{activeCount}</strong>
                <span>active</span>
              </div>
            </div>

            <div className="composer-grid">
              <label className="field-shell">
                <span>Recruiter Email</span>
                <div className="input-with-icon">
                  <Mail size={15} />
                  <input
                    value={email}
                    onChange={(event) => {
                      const nextEmail = event.target.value;
                      setEmail(nextEmail);
                      setError("");
                      const opened = openPublicEmailReview(nextEmail, position, true);
                      if (!opened) setParsed(null);
                    }}
                    placeholder="pallavi@optum.com"
                  />
                </div>
              </label>

              <label className="field-shell">
                <span>Position</span>
                <div className="input-with-icon">
                  <Briefcase size={15} />
                  <input
                    value={position}
                    onChange={(event) => {
                      const nextPosition = event.target.value;
                      setPosition(nextPosition);
                      setError("");
                      const parts = emailParts(email);
                      if (parts && PUBLIC_EMAIL_DOMAINS.has(parts.companyToken)) {
                        openPublicEmailReview(email, nextPosition);
                      } else {
                        setParsed(null);
                      }
                    }}
                    placeholder="Data Engineer"
                  />
                </div>
              </label>
            </div>

            <label className="field-shell">
              <span>
                Job Description <em>optional</em>
              </span>
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Looking for a Data Engineer with 3+ years of experience in building scalable data pipelines, strong SQL, Python, and cloud experience."
                rows={7}
              />
            </label>

            <div className="composer-actions">
              <button
                type="button"
                onClick={preview}
                disabled={loadingPreview || !canPreview}
                className="btn-ghost composer-preview"
              >
                {loadingPreview ? (
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <User size={16} />
                )}
                Preview Recipient
              </button>
              <button type="button" onClick={send} disabled={!canSend} className="btn-primary composer-send">
                <Send size={17} />
                Send Application
              </button>
            </div>

            <AnimatePresence>
              {parsed && (
                <motion.div
                  className="recipient-review"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <div className="review-card">
                    <User size={16} />
                    <label>
                      <span>Recruiter Name</span>
                      <input value={hrName} onChange={(event) => setHrName(event.target.value)} />
                    </label>
                  </div>
                  <div className="review-card">
                    <Building2 size={16} />
                    <label>
                      <span>Company {parsed.company_needs_review ? "(enter if known)" : ""}</span>
                      <input
                        ref={companyInputRef}
                        value={company}
                        onChange={(event) => {
                          setCompany(event.target.value);
                          setError("");
                        }}
                        placeholder={parsed.company_needs_review ? "Company name" : ""}
                      />
                    </label>
                  </div>
                  <div className="review-card">
                    <Mail size={16} />
                    <div>
                      <span>Email</span>
                      <strong>{parsed.hr_email}</strong>
                    </div>
                  </div>
                  <div className="review-card">
                    <Briefcase size={16} />
                    <div>
                      <span>Position</span>
                      <strong>{position}</strong>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {parsed?.company_needs_review && (
              <div className="composer-note">
                Public email domain detected. Enter the actual company name before sending so the mail is tailored correctly.
              </div>
            )}

            {error && <div className="composer-error">{error}</div>}
          </section>

          <DispatchRail jobs={jobs} totals={totals} insights={insights} onCancel={cancelSend} />
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function DispatchRail({
  jobs,
  totals,
  insights,
  onCancel,
}: {
  jobs: SendJob[];
  totals: { sent: number; failed: number };
  insights: MailInsights;
  onCancel: (id: string) => void;
}) {
  const activeJobs = jobs.filter((job) => job.status === "running");
  const sentJobs = jobs.filter((job) => job.status === "sent");
  const failedJobs = jobs.filter((job) => job.status === "error");
  const visibleJobs = [...activeJobs, ...sentJobs, ...failedJobs].slice(0, 4);
  const active = activeJobs.length;
  const sent = totals.sent;
  const failed = totals.failed;
  const latest = visibleJobs[0];
  const secondaryJobs = visibleJobs.slice(1, 4);
  const hiddenJobs = Math.max(activeJobs.length + sentJobs.length + failedJobs.length - 4, 0);

  return (
    <aside className="send-rail dispatch-rail">
      <QueueHeader
        count={active || sentJobs.length || failedJobs.length}
        label="Live Dispatch"
        status={active ? "active" : sentJobs.length ? "sent" : failedJobs.length ? "failed" : "insights"}
      />

      <div className="queue-insights">
        <InsightTile label="Active" value={active} icon={Clock3} />
        <InsightTile label="Completed" value={sent} icon={CheckCircle2} />
        <InsightTile label="Failed" value={failed} icon={AlertCircle} />
      </div>

      {visibleJobs.length === 0 ? (
        <InsightsPanel insights={insights} />
      ) : (
        <div className="dispatch-stack">
          <AnimatePresence mode="popLayout">
            {latest && <FeaturedDispatch key={latest.id} job={latest} onCancel={onCancel} />}
          </AnimatePresence>

          {secondaryJobs.length > 0 && (
            <div className="queue-list queue-list-compact">
              <AnimatePresence initial={false}>
                {secondaryJobs.map((job) => (
                  <QueueJobCard key={job.id} job={job} onCancel={onCancel} />
                ))}
              </AnimatePresence>
              {hiddenJobs > 0 && <div className="queue-more">+{hiddenJobs} more send{hiddenJobs === 1 ? "" : "s"}</div>}
            </div>
          )}

          <Link className="btn-ghost dispatch-history dispatch-history-inline" href="/tracker">
            <List size={16} />
            View Sent History
          </Link>
        </div>
      )}
    </aside>
  );
}

function InsightsPanel({ insights }: { insights: MailInsights }) {
  return (
    <motion.div
      className="mail-insights-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="insights-panel-head">
        <span>
          <Gauge size={16} />
        </span>
        <div>
          <h4>Sending Insights</h4>
          <p>Live overview of your application activity.</p>
        </div>
      </div>

      <div className="insights-kpi-grid">
        <KpiTile label="Today" value={insights.today.toString()} caption="emails sent" icon={Mail} />
        <KpiTile label="This Week" value={insights.week.toString()} caption="emails sent" icon={Clock3} />
        <KpiTile label="This Month" value={insights.month.toString()} caption="emails sent" icon={CheckCircle2} />
        <KpiTile label="Success Rate" value={`${insights.successRate}%`} caption={`${insights.totalSent} sent`} icon={CheckCircle2} />
        <KpiTile label="Failure Rate" value={`${insights.failureRate}%`} caption={`${insights.totalFailed} failed`} icon={AlertCircle} />
      </div>

      <div className="queue-empty insights-empty-state">
        <div className="queue-empty-orbit">
          <Send size={30} />
        </div>
        <h4>Your sending queue is empty</h4>
        <p>Send animations will appear here while the form stays open for your next application.</p>
      </div>
    </motion.div>
  );
}

function KpiTile({ label, value, caption, icon: Icon }: { label: string; value: string; caption: string; icon: LucideIcon }) {
  return (
    <div className="mail-kpi-card">
      <span>
        <Icon size={15} />
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
      <em>{caption}</em>
    </div>
  );
}

function QueueHeader({ count, label, status }: { count: number; label: string; status: string }) {
  return (
    <div className="send-rail-head">
      <div>
        <span>
          <i />
          {label}
        </span>
        <h3>Sending Queue</h3>
      </div>
      <div className="queue-total">
        <strong>{count}</strong>
        {status && <em>{status}</em>}
      </div>
    </div>
  );
}

function InsightTile({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="insight-tile">
      <Icon size={15} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function FeaturedDispatch({ job, onCancel }: { job: SendJob; onCancel: (id: string) => void }) {
  const isRunning = job.status === "running";
  const isSent = job.status === "sent";

  return (
    <motion.div
      layout
      className={`featured-dispatch ${job.status}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="featured-summary">
        <span className="dispatch-avatar">
          <Send size={22} />
        </span>
        <div>
          <h4>Direct Application Sender</h4>
          <p>{isRunning ? "Sending to" : isSent ? "Sent to" : "Failed for"}: {job.hrEmail}</p>
          <p>Position: {job.position}</p>
        </div>
        <StatusPill status={job.status} />
      </div>

      <div className="featured-body">
        <DispatchMark status={job.status} />
        <h5>
          {isRunning ? "Sending your application..." : isSent ? "Application sent successfully!" : "Application could not be sent"}
        </h5>
        <p>{isRunning ? job.message : isSent ? `Delivered for the ${job.position} role.` : job.message}</p>
      </div>

      <StageRail job={job} />
      <ProgressBar job={job} />

      {isRunning && (
        <button type="button" className="btn-ghost dispatch-cancel dispatch-cancel-small" onClick={() => onCancel(job.id)}>
          <X size={15} />
          Cancel Send
        </button>
      )}
    </motion.div>
  );
}

function QueueJobCard({ job, onCancel }: { job: SendJob; onCancel: (id: string) => void }) {
  return (
    <motion.div
      layout
      className={`queue-card compact ${job.status}`}
      initial={{ opacity: 0, x: 18, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 18, scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="queue-card-top">
        <span className="queue-orb">
          {job.status === "sent" ? <Check size={16} /> : job.status === "error" ? <AlertCircle size={16} /> : <Send size={16} />}
        </span>
        <div>
          <h4>{job.position}</h4>
          <p>{job.hrEmail}</p>
        </div>
        <StatusPill status={job.status} />
      </div>
      <ProgressBar job={job} />
      {job.status === "running" && (
        <button type="button" className="queue-cancel" onClick={() => onCancel(job.id)} aria-label="Cancel send">
          <X size={13} />
        </button>
      )}
    </motion.div>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span className={`dispatch-pill ${status === "sent" ? "sent" : status === "error" ? "error" : "sending"}`}>
      {status === "sent" ? (
        <>
          Sent <Check size={14} />
        </>
      ) : status === "error" ? (
        <>
          Failed <AlertCircle size={14} />
        </>
      ) : (
        "Sending"
      )}
    </span>
  );
}

function DispatchMark({ status }: { status: JobStatus }) {
  if (status === "sent") {
    return (
      <div className="dispatch-mark mini dispatch-mark-sent">
        <Check size={34} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="dispatch-mark mini dispatch-mark-error">
        <AlertCircle size={34} />
      </div>
    );
  }

  return (
    <div className="dispatch-mark mini">
      <motion.span
        className="orbit-ring orbit-ring-one"
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className="orbit-ring orbit-ring-two"
        animate={{ rotate: -360 }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className="dispatch-plane mini-plane"
        animate={{ y: [0, -5, 0], rotate: [-10, 4, -10] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Send size={31} />
      </motion.span>
    </div>
  );
}

function StageRail({ job }: { job: SendJob }) {
  return (
    <div className="dispatch-steps compact">
      {FLOW_STAGES.map((stage, index) => {
        const Icon = stage.icon;
        const complete = job.status === "sent" || index < job.stage;
        const active = job.status === "running" && index === job.stage;
        return (
          <div key={stage.label} className={`dispatch-step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}>
            <span>{complete ? <Check size={13} /> : <Icon size={13} />}</span>
            <strong>{stage.label}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ job }: { job: SendJob }) {
  return (
    <>
      <div className="dispatch-progress-label compact">
        <span>{job.status === "running" ? `Sending to ${job.hrEmail}` : job.message}</span>
        <strong>{Math.round(job.progress)}%</strong>
      </div>
      <div className="dispatch-progress">
        <motion.div animate={{ width: `${job.progress}%` }} transition={{ duration: 0.3 }} />
      </div>
    </>
  );
}
