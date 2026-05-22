"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, CheckCircle2, Loader2, Mail, Search, Send, User } from "lucide-react";
import { getContacts, sendAgainApplication } from "@/lib/api";

interface Contact {
  hr_email: string;
  hr_name: string;
  company: string;
  latest_application_id: number;
  last_position: string;
  last_sent_at: string;
  send_count: number;
  positions: string[];
  has_reply: boolean;
  last_reply_at: string;
  latest_reply_summary: string;
}

type SendMode = "previous" | "new";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [mode, setMode] = useState<Record<string, SendMode>>({});
  const [newPosition, setNewPosition] = useState<Record<string, string>>({});
  const [sendingEmail, setSendingEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getContacts();
      setContacts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    getContacts()
      .then((data) => { if (active) setContacts(data); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Could not load contacts"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((contact) => [
      contact.hr_email,
      contact.hr_name,
      contact.company,
      contact.last_position,
      ...contact.positions,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [contacts, query]);

  const sendAgain = async (contact: Contact) => {
    const selectedMode = mode[contact.hr_email] || "previous";
    if (selectedMode === "new" && !newPosition[contact.hr_email]?.trim()) {
      setError("Enter the new position before sending.");
      return;
    }
    setSendingEmail(contact.hr_email);
    setError("");
    setMessage("");
    try {
      await sendAgainApplication({
        application_id: contact.latest_application_id,
        mode: selectedMode,
        position: selectedMode === "new" ? newPosition[contact.hr_email] : undefined,
      });
      setMessage(`Application sent again to ${contact.hr_email}`);
      setActiveEmail("");
      setNewPosition((value) => ({ ...value, [contact.hr_email]: "" }));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not send application again");
    } finally {
      setSendingEmail("");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0, color: "var(--text)" }}>Contacts</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Saved recruiters, emails, positions, and resend actions.</p>
        </div>
        <div style={{ width: "min(360px, 100%)", position: "relative" }}>
          <Search size={15} color="var(--muted)" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" style={{ paddingLeft: 38 }} />
        </div>
      </div>

      {(error || message) && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "11px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.045)",
          color: error ? "#D8D8D8" : "var(--text-secondary)",
          fontSize: 13,
        }}>
          {message && <CheckCircle2 size={15} />}
          <span>{error || message}</span>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "rgba(12, 12, 12, 0.94)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: 26, color: "var(--muted)", fontSize: 13 }}>Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 26, color: "var(--muted)", fontSize: 13 }}>No saved contacts yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  {["Contact", "Saved Positions", "Last Sent", "Replies", "Action"].map((heading) => (
                    <th key={heading} style={{
                      padding: "16px 18px 12px",
                      color: "var(--muted)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      textAlign: "left",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => {
                  const selectedMode = mode[contact.hr_email] || "previous";
                  const active = activeEmail === contact.hr_email;
                  return (
                    <tr key={contact.hr_email} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: 18, verticalAlign: "top", minWidth: 280 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <User size={16} color="#D8D8D8" />
                          </div>
                          <div>
                            <div style={{ color: "var(--text)", fontWeight: 760, fontSize: 14 }}>{contact.hr_name || "Hiring Team"}</div>
                            <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>{contact.company || "Company not set"}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              <Mail size={13} color="var(--muted)" />
                              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{contact.hr_email}</span>
                              <button className="btn-ghost" onClick={() => setActiveEmail(active ? "" : contact.hr_email)} style={{ padding: "5px 9px", fontSize: 11 }}>
                                Send again
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 18, verticalAlign: "top", minWidth: 260 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {(contact.positions.length ? contact.positions : [contact.last_position]).slice(0, 4).map((position) => (
                            <span key={position} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)", fontSize: 12 }}>
                              <Briefcase size={11} />
                              {position || "Position not set"}
                            </span>
                          ))}
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 9 }}>{contact.send_count} saved send{contact.send_count === 1 ? "" : "s"}</div>
                      </td>
                      <td style={{ padding: 18, verticalAlign: "top", color: "var(--text-secondary)", fontSize: 12, minWidth: 130 }}>
                        {contact.last_sent_at ? new Date(contact.last_sent_at).toLocaleDateString() : "-"}
                      </td>
                      <td style={{ padding: 18, verticalAlign: "top", minWidth: 220 }}>
                        <div style={{ color: contact.has_reply ? "var(--text-secondary)" : "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                          {contact.has_reply ? contact.latest_reply_summary : "No reply yet"}
                        </div>
                      </td>
                      <td style={{ padding: 18, verticalAlign: "top", minWidth: 310 }}>
                        {active ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <button className={selectedMode === "previous" ? "btn-primary" : "btn-ghost"} onClick={() => setMode((value) => ({ ...value, [contact.hr_email]: "previous" }))} style={{ padding: "8px 10px", fontSize: 12 }}>
                                Saved position
                              </button>
                              <button className={selectedMode === "new" ? "btn-primary" : "btn-ghost"} onClick={() => setMode((value) => ({ ...value, [contact.hr_email]: "new" }))} style={{ padding: "8px 10px", fontSize: 12 }}>
                                New position
                              </button>
                            </div>
                            {selectedMode === "new" && (
                              <input
                                value={newPosition[contact.hr_email] || ""}
                                onChange={(e) => setNewPosition((value) => ({ ...value, [contact.hr_email]: e.target.value }))}
                                placeholder="Enter new position"
                                style={{ padding: "8px 10px", fontSize: 12 }}
                              />
                            )}
                            <button className="btn-primary" disabled={sendingEmail === contact.hr_email} onClick={() => sendAgain(contact)} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "9px 12px", fontSize: 12 }}>
                              {sendingEmail === contact.hr_email ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                              Send
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 12 }}>Use the button beside the email.</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <style jsx>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
