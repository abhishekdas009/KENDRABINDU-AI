"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MailCheck, MessageSquareReply } from "lucide-react";
import { getReplies } from "@/lib/api";

interface Reply {
  id: number;
  from_email: string;
  subject: string;
  summary: string;
  received_at: string;
  company?: string;
  hr_name?: string;
  position?: string;
}

export default function RecentReplies() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReplies(4)
      .then(setReplies)
      .catch(() => setReplies([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "rgba(12, 12, 12, 0.94)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h3 style={{ color: "var(--text)", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Recent Replies</h3>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>Latest recruiter responses</p>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MessageSquareReply size={17} color="#F4F4F4" />
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>Checking replies...</div>
      ) : replies.length === 0 ? (
        <div style={{ padding: "8px 0", color: "var(--muted)", fontSize: 12 }}>No replies yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {replies.map((reply) => (
            <div key={reply.id} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <MailCheck size={15} color="#D8D8D8" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--text)", fontSize: 12.5, fontWeight: 760, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {reply.hr_name || reply.from_email}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {reply.position || reply.company || reply.subject || "Application reply"}
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
                  {reply.summary || reply.subject}
                </p>
                <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 6 }}>
                  {reply.received_at ? new Date(reply.received_at).toLocaleString() : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
