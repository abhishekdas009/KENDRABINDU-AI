"use client";
import { useState } from "react";
import { extractInfo } from "@/lib/api";
import { Search, Loader2 } from "lucide-react";

interface Extracted { hr_name: string; company: string; hr_email: string; position: string; }

export default function ExtractForm({ onDone }: { onDone: (data: Extracted) => void }) {
  const [rawEmail, setRawEmail] = useState("");
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    if (!rawEmail.trim() || !position.trim()) { setError("Paste email and enter position"); return; }
    setLoading(true); setError("");
    try {
      const data = await extractInfo(rawEmail, position);
      onDone(data);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", letterSpacing: 0 }}>Step 1 — Extract Context</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>Paste the job description or email thread to automatically extract HR details.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Raw Email / Job Description</label>
          <textarea
            value={rawEmail} onChange={e => setRawEmail(e.target.value)}
            placeholder="Paste HR email address or full email thread here..."
            rows={5}
            style={{ minHeight: "120px" }}
          />
        </div>
        
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Target Position</label>
          <input
            value={position} onChange={e => setPosition(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
          />
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
        {loading ? <Loader2 size={16} className="icon-pulse" style={{ animation: "spin 1s linear infinite" }} /> : <Search size={16} />}
        {loading ? "Extracting Intelligence..." : "Extract HR Info"}
      </button>

      <style jsx>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
