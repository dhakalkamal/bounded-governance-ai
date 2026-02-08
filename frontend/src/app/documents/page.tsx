"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { FileUp, File, Play, Search } from "lucide-react";
import { listDocuments, uploadDocument, triggerAnalysis } from "@/lib/api";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";

const DOC_TYPES = [
  { value: "minutes", label: "Board Minutes" },
  { value: "policy", label: "Policy Document" },
  { value: "framework", label: "Governance Framework" },
  { value: "disclosure", label: "Disclosure Document" },
  { value: "other", label: "Other" },
];

const DOC_TYPE_BADGE: Record<string, { label: string; classes: string }> = {
  minutes: { label: "Board Minutes", classes: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  policy: { label: "Policy", classes: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  framework: { label: "Framework", classes: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  disclosure: { label: "Disclosure", classes: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  other: { label: "Other", classes: "text-slate-400 bg-slate-400/10 border-slate-400/30" },
};

const FILTER_TABS = [
  { value: "", label: "All" },
  { value: "minutes", label: "Board Minutes" },
  { value: "policy", label: "Policy" },
  { value: "framework", label: "Framework" },
  { value: "disclosure", label: "Disclosure" },
];

export default function DocumentsPage() {
  const { currentUser } = useUser();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("minutes");
  const [dragActive, setDragActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analysisMsg, setAnalysisMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");

  const canUpload = currentUser.permissions.uploadDocuments;
  const canAnalyze = currentUser.permissions.runAnalysis;

  const loadDocs = useCallback(async () => {
    try {
      const res = await listDocuments();
      setDocuments(res.documents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    loadDocs();
  }, [loadDocs, currentUser.name]);

  const filteredDocs = useMemo(() => {
    let docs = documents;
    if (filterType) {
      docs = docs.filter((d) => d.doc_type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter((d) => d.filename.toLowerCase().includes(q));
    }
    return docs;
  }, [documents, filterType, searchQuery]);

  // Count docs by type for summary
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      counts[doc.doc_type] = (counts[doc.doc_type] || 0) + 1;
    }
    return counts;
  }, [documents]);

  const summaryParts = useMemo(() => {
    return Object.entries(typeCounts)
      .map(([type, count]) => {
        const badge = DOC_TYPE_BADGE[type];
        const label = badge ? badge.label : type;
        return `${count} ${label}`;
      })
      .join(", ");
  }, [typeCounts]);

  async function handleUpload(files: FileList | File[]) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file, docType);
      }
      await loadDocs();
    } catch (e: any) {
      alert(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) {
      handleUpload(e.dataTransfer.files);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAnalysis() {
    if (selected.size === 0) return;
    setAnalysisMsg("Starting analysis...");
    try {
      const res = await triggerAnalysis(Array.from(selected));
      setAnalysisMsg(
        `Analysis job created: ${res.job_id.slice(0, 8)}... Status: ${res.status}`
      );
    } catch (e: any) {
      setAnalysisMsg(`Error: ${e.message}`);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Upload and manage governance documents
        </p>
      </div>

      {/* Upload zone */}
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive
              ? "border-[var(--accent)] bg-[var(--accent)]/5"
              : "border-[var(--border)] bg-[var(--bg-card)]"
          }`}
        >
          <FileUp className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Drag & drop files here, or click to browse
          </p>
          <div className="flex items-center justify-center gap-3">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="cursor-pointer bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {uploading ? "Uploading..." : "Browse Files"}
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => e.target.files && handleUpload(e.target.files)}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Supports PDF, DOCX, TXT
          </p>
        </div>
      )}

      {/* Analysis trigger */}
      {canAnalyze && selected.size > 0 && (
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <Play className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm">
            {selected.size} document{selected.size > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={runAnalysis}
            className="ml-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Run Analysis
          </button>
          {analysisMsg && (
            <span className="text-xs text-[var(--text-muted)]">
              {analysisMsg}
            </span>
          )}
        </div>
      )}

      {/* Search and filters */}
      {!loading && documents.length > 0 && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by name..."
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Type filter buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterType(tab.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  filterType === tab.value
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                )}
              >
                {tab.label}
                {tab.value && typeCounts[tab.value]
                  ? ` (${typeCounts[tab.value]})`
                  : tab.value === ""
                    ? ` (${documents.length})`
                    : ""}
              </button>
            ))}
          </div>

          {/* Summary line */}
          {summaryParts && (
            <p className="text-xs text-[var(--text-muted)]">
              {documents.length} document{documents.length !== 1 ? "s" : ""}: {summaryParts}
            </p>
          )}
        </div>
      )}

      {/* Document list */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            Loading documents...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            {documents.length === 0
              ? "No documents uploaded yet."
              : "No documents match your search."}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredDocs.map((doc) => {
              const badge = DOC_TYPE_BADGE[doc.doc_type] || DOC_TYPE_BADGE.other;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                    className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  />
                  <File className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {doc.file_size
                        ? `${(doc.file_size / 1024).toFixed(1)} KB`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
