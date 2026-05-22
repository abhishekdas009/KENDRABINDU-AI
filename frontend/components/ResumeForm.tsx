"use client";
import { useState } from "react";
import { rewriteResume } from "@/lib/api";
import { Sparkles, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  hrName: string; company: string; position: string;
  onDone: (data: { resume: string; cover_letter: string; ats_score: number; improvements: string[] }) => void;
}

function AtsScore({ score }: { score: number }) {
  const color = score >= 80 ? "#F0F0F0" : score >= 65 ? "#C8C8C8" : "#9A9A9A";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div style={{
        width: "80px", height: "80px", borderRadius: "50%",
        background: `conic-gradient(${color} ${score}%, rgba(255,255,255,0.06) 0%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        boxShadow: `0 0 20px ${color}20`,
      }}>
        <div style={{
          width: "66px", height: "66px", borderRadius: "50%",
          background: "rgba(8,8,8,0.94)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "24px", fontWeight: 800, color,
        }}>{score}</div>
      </div>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em" }}>ATS MATCH</span>
    </div>
  );
}

export default function ResumeForm({ hrName, company, position, onDone }: Props) {
  const [resume, setResume] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ resume: string; cover_letter: string; ats_score: number; improvements: string[] } | null>(null);
  const [error, setError] = useState("");

  const handle = async () => {
    if (!resume.trim()) { setError("Paste your base resume"); return; }
    setLoading(true); setError("");
    try {
      const data = await rewriteResume({
        hr_name: hrName, company, position,
        job_description: jd || undefined,
        base_resume: resume,
        base_cover_letter: coverLetter,
      });
      setResult(data);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  if (result) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", gap: "32px", alignItems: "center", padding: "24px", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px" }}>
        <AtsScore score={result.ats_score} />
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} color="#D8D8D8" /> AI Improvements Applied:
          </h3>
          <ul style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {result.improvements.map((imp, i) => (
              <li key={i} style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <CheckCircle2 size={16} color="#D8D8D8" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Optimized Resume</label>
          <textarea value={result.resume} onChange={e => setResult({ ...result, resume: e.target.value })} rows={12} style={{ fontFamily: "monospace", fontSize: "12px" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Optimized Cover Letter</label>
          <textarea value={result.cover_letter} onChange={e => setResult({ ...result, cover_letter: e.target.value })} rows={8} style={{ fontFamily: "monospace", fontSize: "12px" }} />
        </div>
      </div>

      <button onClick={() => onDone(result)} className="btn-primary" style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "8px" }}>
        Use & Proceed <ArrowRight size={16} />
      </button>
    </motion.div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", letterSpacing: 0 }}>Step 2 — AI Rewrite for {company}</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>Provide your base materials. Our AI will optimize them against the job description for maximum ATS match.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Job Description (Optional, highly recommended)</label>
          <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste Job Description here to optimize ATS score..." rows={4} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Base Resume</label>
          <textarea value={resume} onChange={e => setResume(e.target.value)} placeholder="Paste your base resume here..." rows={8} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Base Cover Letter</label>
          <textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value)} placeholder="Paste your base cover letter here..." rows={4} />
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
          {error}
        </div>
      )}

      <button
        onClick={handle} disabled={loading}
        className="btn-primary"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", alignSelf: "flex-start" }}
      >
        {loading ? <Loader2 size={16} className="icon-pulse" style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={16} />}
        {loading ? "Optimizing with AI (30-60s)..." : "Rewrite & Score"}
      </button>

      <style jsx>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
