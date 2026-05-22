"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { directSendApplication, parseRecipient } from "@/lib/api";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Mail,
  Search,
  Send,
  Sparkles,
  User,
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
  status: JobStatus;
  message: string;
  attachments: string[];
}

const SEND_STAGES: Array<{ label: string; detail: string; icon: LucideIcon }> = [
  { label: "Extracting relation info", detail: "Recipient, company and profile signals", icon: Search },
  { label: "Crafting JD match", detail: "Tailoring the cover letter and email body", icon: Sparkles },
  { label: "Compiling PDFs", detail: "Preparing resume and cover letter files", icon: FileCheck2 },
  { label: "Sending email", detail: "Delivering through Gmail SMTP", icon: Send },
];

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

  const updateJob = (id: string, patch: Partial<SendJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  };

  const advanceJob = (id: string, stage: number) => {
    setJobs((current) =>
      current.map((job) =>
        job.id === id && job.status === "running" ? { ...job, stage: Math.max(job.stage, stage) } : job,
      ),
    );
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
      setError(e instanceof Error ? e.message : "Could not parse recipient");
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
    const timers = [
      window.setTimeout(() => advanceJob(id, 1), 750),
      window.setTimeout(() => advanceJob(id, 2), 1900),
      window.setTimeout(() => advanceJob(id, 3), 3200),
    ];

    try {
      const data = await directSendApplication(payload);
      updateJob(id, {
        stage: SEND_STAGES.length - 1,
        status: "sent",
        message: data.message || "Application sent successfully",
        attachments: data.attachments || [],
      });
    } catch (e: unknown) {
      updateJob(id, {
        status: "error",
        message: e instanceof Error ? e.message : "Could not send application",
      });
    } finally {
      timers.forEach(window.clearTimeout);
    }
  };

  const send = async () => {
    if (!email.trim() || !position.trim()) {
      setError("Enter recruiter email and position");
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
      status: "running",
      message: "Queued for dispatch",
      attachments: [],
    };

    setError("");
    setJobs((current) => [job, ...current].slice(0, 8));
    clearComposer();
    void runSendJob(job.id, payload);
  };

  const canSend = Boolean(email.trim() && position.trim());

  return (
    <div className="send-workspace">
      <section className="composer-panel">
        <div className="composer-kicker">
          <span className="live-dot" />
          Parallel sender ready
        </div>

        <div className="composer-head">
          <div>
            <h2>Direct Application Sender</h2>
            <p>
              Add a recruiter, role, and optional job description. Each send runs in the side queue
              while this composer resets for the next mail.
            </p>
          </div>
          <div className="composer-count">
            <strong>{jobs.filter((job) => job.status === "running").length}</strong>
            <span>active</span>
          </div>
        </div>

        <div className="composer-grid">
          <label className="field-shell">
            <span>Recruiter Email</span>
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setParsed(null);
              }}
              placeholder="pallavi@optum.com"
            />
          </label>

          <label className="field-shell">
            <span>Position</span>
            <input
              value={position}
              onChange={(event) => {
                setPosition(event.target.value);
                setParsed(null);
              }}
              placeholder="Data Engineer"
            />
          </label>
        </div>

        <label className="field-shell">
          <span>Job Description <em>optional</em></span>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the job description when you have it. The email body and attached cover letter will be tailored to this role."
            rows={7}
          />
        </label>

        <div className="composer-actions">
          <button type="button" onClick={preview} disabled={loadingPreview || !canSend} className="btn-ghost composer-preview">
            {loadingPreview ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <User size={16} />}
            Preview Recipient
          </button>
          <button type="button" onClick={send} disabled={!canSend} className="btn-primary composer-send">
            <Send size={17} />
            Send Resume + Cover Letter
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
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
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
            Public email domain detected. Add the company if you want cleaner filenames and a sharper cover letter.
          </div>
        )}

        {error && <div className="composer-error">{error}</div>}
      </section>

      <aside className="send-rail">
        <div className="send-rail-head">
          <div>
            <span>Live Dispatch</span>
            <h3>Sending Queue</h3>
          </div>
          <div className="queue-total">{jobs.length}</div>
        </div>

        {jobs.length === 0 ? (
          <div className="queue-empty">
            <Send size={20} />
            <p>Send animations will appear here while the form stays open for your next application.</p>
          </div>
        ) : (
          <div className="queue-list">
            <AnimatePresence initial={false}>
              {jobs.map((job) => (
                <SendJobCard key={job.id} job={job} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </aside>

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

function SendJobCard({ job }: { job: SendJob }) {
  const isDone = job.status === "sent";
  const isError = job.status === "error";
  const ActiveIcon = isDone ? CheckCircle2 : isError ? AlertCircle : SEND_STAGES[job.stage]?.icon || Send;
  const progress = isDone ? 100 : isError ? 100 : ((job.stage + 1) / SEND_STAGES.length) * 100;

  return (
    <motion.div
      layout
      className={`queue-card ${isDone ? "is-done" : ""} ${isError ? "is-error" : ""}`}
      initial={{ opacity: 0, x: 28, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.96 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="queue-card-top">
        <motion.div
          className="queue-orb"
          animate={job.status === "running" ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 3, repeat: job.status === "running" ? Infinity : 0, ease: "linear" }}
        >
          <ActiveIcon size={18} />
        </motion.div>
        <div>
          <h4>{job.position}</h4>
          <p>{job.company || job.hrName} - {job.hrEmail}</p>
        </div>
      </div>

      <div className="queue-progress">
        <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.35 }} />
      </div>

      <div className="queue-stages">
        {SEND_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const active = job.status === "running" && index === job.stage;
          const complete = isDone || index < job.stage;
          return (
            <div key={stage.label} className={`stage-row ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}>
              <span>
                <Icon size={14} />
              </span>
              <div>
                <strong>{stage.label}</strong>
                <em>{stage.detail}</em>
              </div>
            </div>
          );
        })}
      </div>

      {job.jobDescription && <div className="job-desc-chip">JD optimized cover letter</div>}

      {isDone && (
        <div className="queue-result">
          <CheckCircle2 size={15} />
          <span>{job.message}</span>
        </div>
      )}

      {isError && (
        <div className="queue-result queue-result-error">
          <AlertCircle size={15} />
          <span>{job.message}</span>
        </div>
      )}

      {job.attachments.length > 0 && (
        <div className="attachment-row">
          {job.attachments.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
