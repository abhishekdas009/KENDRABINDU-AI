"use client";
import { useState } from "react";
import { sendEmail, simpleFailureReason } from "@/lib/api";
import { Send, Loader2, CheckCircle2, Building2, User, Mail, Briefcase } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  hrEmail: string; hrName: string; company: string; position: string;
  resumeContent: string; coverLetterContent: string; atsScore: number;
  onDone: () => void;
}

export default function SendForm({ hrEmail, hrName, company, position, resumeContent, coverLetterContent, atsScore, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handle = async () => {
    setLoading(true); setError("");
    try {
      await sendEmail({ hr_email: hrEmail, hr_name: hrName, company, position, resume_content: resumeContent, cover_letter_content: coverLetterContent, ats_score: atsScore });
      setSent(true);
      setTimeout(onDone, 3000);
    } catch (e: unknown) { setError(simpleFailureReason(e)); }
    finally { setLoading(false); }
  };

  if (sent) return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
        style={{ width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px", boxShadow: "0 0 40px rgba(255,255,255,0.08)" }}
      >
        <CheckCircle2 size={40} color="#D8D8D8" />
      </motion.div>
      <h2 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)", letterSpacing: 0, marginBottom: "8px" }}>Successfully Dispatched</h2>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Application delivered to {hrName} at {company}. Check the tracker for updates.</p>
    </motion.div>
  );

  const INFO = [
    { label: "Company", value: company, icon: Building2 },
    { label: "Position", value: position, icon: Briefcase },
    { label: "Recipient", value: hrName, icon: User },
    { label: "Email", value: hrEmail, icon: Mail },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", letterSpacing: 0 }}>Step 3 — Final Review & Send</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>Verify the payload details before dispatching the application.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {INFO.map((item) => (
          <div key={item.label} style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <item.icon size={16} color="#D8D8D8" />
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</div>
              <div style={{ fontSize: "14px", color: "var(--text)", fontWeight: 600 }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "20px", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "14px", color: "var(--text)", fontWeight: 600 }}>Final ATS Score</div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Based on optimized resume</div>
        </div>
        <div style={{ fontSize: "28px", fontWeight: 800, color: "#F0F0F0" }}>{atsScore}<span style={{ fontSize: "14px", color: "#A8A8A8" }}>/100</span></div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "var(--text-secondary)", fontSize: "13px" }}>
          {error}
        </div>
      )}

      <button
        onClick={handle} disabled={loading}
        className="btn-primary"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", padding: "16px", fontSize: "15px" }}
      >
        {loading ? <Loader2 size={18} className="icon-pulse" style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} />}
        {loading ? "Dispatching Payload..." : `Send Application to ${hrName}`}
      </button>

      <style jsx>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
