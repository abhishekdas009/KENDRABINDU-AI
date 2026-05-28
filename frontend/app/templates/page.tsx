"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  BadgeCheck,
  Clock3,
  CloudUpload,
  Eye,
  FileText,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  getResumeTemplates,
  resumeTemplateDownloadUrl,
  resumeTemplatePreviewUrl,
  simpleFailureReason,
  type ResumeTemplate,
  type ResumeTemplateStats,
  uploadResumeTemplate,
} from "@/lib/api";

const EMPTY_STATS: ResumeTemplateStats = {
  total_unique_resumes: 0,
  this_week_uploads: 0,
  template_versions: 0,
  storage_used_bytes: 0,
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toUpperCase() || "FILE";
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [stats, setStats] = useState<ResumeTemplateStats>(EMPTY_STATS);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async (nextActiveId?: number) => {
    try {
      const data = await getResumeTemplates();
      setTemplates(data.templates);
      setStats(data.stats);
      setActiveId(nextActiveId ?? data.templates[0]?.id ?? null);
      setError("");
    } catch (e: unknown) {
      setError(simpleFailureReason(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    getResumeTemplates()
      .then((data) => {
        if (!mounted) return;
        setTemplates(data.templates);
        setStats(data.stats);
        setActiveId(data.templates[0]?.id ?? null);
        setError("");
      })
      .catch((e: unknown) => {
        if (mounted) setError(simpleFailureReason(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((template) => template.original_filename.toLowerCase().includes(term));
  }, [query, templates]);

  const activeTemplate = useMemo(() => {
    return templates.find((template) => template.id === activeId) || filtered[0] || templates[0] || null;
  }, [activeId, filtered, templates]);

  const handleFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files).filter(Boolean);
    if (!selected.length) return;
    setUploading(true);
    setError("");
    let lastUploaded: ResumeTemplate | null = null;

    try {
      for (const file of selected) {
        const uploaded = await uploadResumeTemplate(file);
        lastUploaded = uploaded.template;
      }
      await load(lastUploaded?.id);
    } catch (e: unknown) {
      setError(simpleFailureReason(e));
    } finally {
      setUploading(false);
      setDragging(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void handleFiles(event.target.files);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void handleFiles(event.dataTransfer.files);
  };

  return (
    <div className="templates-page">
      <section className="templates-header">
        <div>
          <div className="templates-kicker">
            <Sparkles size={14} />
            AI powered
          </div>
          <h1>Resume Templates</h1>
          <p>Upload, manage, preview, and download your resume templates in one place.</p>
        </div>

        <div className="templates-header-actions">
          <button type="button" className="btn-primary templates-upload-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload size={17} />
            {uploading ? "Uploading..." : "Upload Resume"}
          </button>
        </div>
      </section>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        hidden
        onChange={onInputChange}
      />

      <section className="template-stat-grid">
        <StatCard label="Total Unique Resumes" value={stats.total_unique_resumes.toString()} caption="Across uploaded templates" icon={FileText} tone="violet" delay={0.02} />
        <StatCard label="This Week Uploads" value={stats.this_week_uploads.toString()} caption="Recently added files" icon={CloudUpload} tone="blue" delay={0.07} />
        <StatCard label="Template Versions" value={stats.template_versions.toString()} caption="Saved variations" icon={Layers3} tone="green" delay={0.12} />
        <StatCard label="Storage Used" value={formatBytes(stats.storage_used_bytes)} caption="Local template storage" icon={ShieldCheck} tone="amber" delay={0.17} />
      </section>

      {error && <div className="mobile-alert template-error">{error}</div>}

      <section className="templates-workspace">
        <motion.div className="resume-list-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div className="templates-panel-head">
            <div>
              <h2>Your Resumes</h2>
              <p>{templates.length} uploaded template{templates.length === 1 ? "" : "s"}</p>
            </div>
            <span>{filtered.length}</span>
          </div>

          <div className="resume-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resumes..." />
          </div>

          <div className="resume-list">
            {loading ? (
              [1, 2, 3].map((item) => <div key={item} className="skeleton resume-skeleton" />)
            ) : filtered.length === 0 ? (
              <div className="resume-empty">
                <FileText size={24} />
                <strong>No resumes found</strong>
                <span>{templates.length ? "Try a different search." : "Upload a resume to get started."}</span>
              </div>
            ) : (
              filtered.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`resume-row ${activeTemplate?.id === template.id ? "is-active" : ""}`}
                  onClick={() => setActiveId(template.id)}
                >
                  <span className="resume-thumb">
                    <FileText size={22} />
                  </span>
                  <span className="resume-row-main">
                    <strong>{template.original_filename}</strong>
                    <small>{formatDate(template.uploaded_at)} - {formatBytes(template.size_bytes)}</small>
                  </span>
                  <span className="resume-chip">{extensionOf(template.original_filename)}</span>
                  <span className="resume-eye">
                    <Eye size={15} />
                  </span>
                </button>
              ))
            )}
          </div>

          <div
            className={`resume-dropzone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span>
              <CloudUpload size={26} />
            </span>
            <div>
              <strong>Drop resume files here</strong>
              <p>PDF, DOC, DOCX - up to 10 MB each</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={uploading}>
              Browse
            </button>
          </div>
        </motion.div>

        <motion.div className="resume-preview-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="templates-panel-head preview-head">
            <div>
              <h2>Resume Preview</h2>
              <p>{activeTemplate ? activeTemplate.original_filename : "No resume selected"}</p>
            </div>
            {activeTemplate && (
              <a className="btn-ghost template-download-small" href={resumeTemplateDownloadUrl(activeTemplate)}>
                <ArrowDownToLine size={16} />
                Download
              </a>
            )}
          </div>

          <div className="resume-preview-stage">
            {activeTemplate?.is_pdf ? (
              <iframe
                title={`Preview ${activeTemplate.original_filename}`}
                src={`${resumeTemplatePreviewUrl(activeTemplate)}#toolbar=0&navpanes=0`}
              />
            ) : activeTemplate ? (
              <div className="resume-preview-fallback">
                <FileText size={44} />
                <strong>{activeTemplate.original_filename}</strong>
                <span>{extensionOf(activeTemplate.original_filename)} template - {formatBytes(activeTemplate.size_bytes)}</span>
                <a className="btn-primary" href={resumeTemplateDownloadUrl(activeTemplate)}>
                  <ArrowDownToLine size={16} />
                  Download File
                </a>
              </div>
            ) : (
              <div className="resume-preview-fallback">
                <FileText size={44} />
                <strong>No resume selected</strong>
                <span>Upload a resume template to preview it here.</span>
              </div>
            )}
          </div>

          {activeTemplate && (
            <div className="resume-preview-actions">
              <div>
                <BadgeCheck size={16} />
                <span>Uploaded {formatDate(activeTemplate.uploaded_at)}</span>
              </div>
              <div>
                <Clock3 size={16} />
                <span>{formatBytes(activeTemplate.size_bytes)}</span>
              </div>
              <a className="btn-primary" href={resumeTemplateDownloadUrl(activeTemplate)}>
                <ArrowDownToLine size={17} />
                Download Resume
              </a>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
  delay,
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof FileText;
  tone: "violet" | "blue" | "green" | "amber";
  delay: number;
}) {
  return (
    <motion.div className={`template-stat-card tone-${tone}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <span>
        <Icon size={22} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
    </motion.div>
  );
}
