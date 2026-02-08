"use client";

import { useEffect, useState, useCallback } from "react";
import { FileUp, File, Play, CheckCircle, Loader2, AlertCircle, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/components/Toast";
import { DriveUploader } from "@/components/DriveUploader";

const DOC_TYPES = [
  { value: "minutes", label: "Board Minutes" },
  { value: "policy", label: "Policy Document" },
  { value: "framework", label: "Governance Framework" },
  { value: "disclosure", label: "Disclosure Document" },
  { value: "other", label: "Other" },
];

interface DriveDocument {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink?: string;
  properties?: {
    docType?: string;
    uploadedAt?: string;
    analysisComplete?: string;
  };
  analysisStatus?: 'pending' | 'analyzing' | 'complete' | 'error';
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DriveDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("minutes");
  const [dragActive, setDragActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analysisMsg, setAnalysisMsg] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState(0);
  const { showToast } = useToast();

  // Check Google Drive connection status
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/google/status');
      const data = await response.json();
      setIsConnected(data.connected);

      if (data.connected) {
        await loadDocs();
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load documents from Google Drive
  const loadDocs = useCallback(async () => {
    try {
      const response = await fetch('/api/files/list');

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const data = await response.json();
      setDocuments(data.files || []);
    } catch (e) {
      console.error('Error loading documents:', e);
      showToast('Failed to load documents', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Connect to Google Drive
  const connectToDrive = async () => {
    try {
      const response = await fetch('/api/auth/google');
      const data = await response.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      showToast('Failed to connect to Google Drive', 'error');
      console.error(error);
    }
  };

  // Upload files to Google Drive
  async function handleUpload(files: FileList | File[]) {
    if (!isConnected) {
      showToast('Please connect to Google Drive first', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const fileArray = Array.from(files);
      const uploadedFileIds: string[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setProgress(Math.round(((i + 1) / fileArray.length) * 100));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);

        const response = await fetch('/api/auth/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const data = await response.json();
        uploadedFileIds.push(data.fileId);

        showToast(`${file.name} uploaded successfully`, 'success');
      }

      // Reload documents
      await loadDocs();

      // Auto-select uploaded files
      setSelected(new Set(uploadedFileIds));

      // Prompt for analysis
      if (uploadedFileIds.length > 0) {
        setAnalysisMsg(`${uploadedFileIds.length} file(s) ready for analysis`);
      }

    } catch (e: any) {
      showToast(`Upload failed: ${e.message}`, 'error');
    } finally {
      setUploading(false);
      setProgress(0);
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Run Gemini AI analysis
  async function runAnalysis() {
    if (selected.size === 0) {
      showToast('Please select at least one document', 'error');
      return;
    }

    setAnalysisMsg("Starting AI analysis...");

    try {
      const selectedDocs = documents.filter(doc => selected.has(doc.id));
      let completed = 0;

      for (const doc of selectedDocs) {
        // Update document status to analyzing
        setDocuments(prev =>
          prev.map(d =>
            d.id === doc.id ? { ...d, analysisStatus: 'analyzing' as const } : d
          )
        );

        setAnalysisMsg(`Analyzing ${doc.name}... (${completed + 1}/${selectedDocs.length})`);

        try {
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileId: doc.id,
              fileName: doc.name,
              agents: ['minutes_analyzer', 'framework_checker', 'coi_detector', 'reviewer'],
            }),
          });

          if (!response.ok) {
            throw new Error('Analysis failed');
          }

          const result = await response.json();

          // Update document status to complete
          setDocuments(prev =>
            prev.map(d =>
              d.id === doc.id ? { ...d, analysisStatus: 'complete' as const } : d
            )
          );

          completed++;

          showToast(
            `Analysis complete for ${doc.name}: ${result.total_findings} findings`,
            'success',
            5000
          );

        } catch (error) {
          console.error(`Analysis error for ${doc.name}:`, error);

          setDocuments(prev =>
            prev.map(d =>
              d.id === doc.id ? { ...d, analysisStatus: 'error' as const } : d
            )
          );

          showToast(`Analysis failed for ${doc.name}`, 'error');
        }
      }

      setAnalysisMsg(`Analysis complete! ${completed} of ${selectedDocs.length} documents analyzed.`);

      // Clear selection after a delay
      setTimeout(() => {
        setSelected(new Set());
        setAnalysisMsg("");
      }, 5000);

    } catch (e: any) {
      setAnalysisMsg(`Error: ${e.message}`);
      showToast('Analysis failed', 'error');
    }
  }

  // Not connected view
  if (!isConnected && !loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Connect to Google Drive to upload and analyze governance documents
          </p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-12 text-center">
          <LinkIcon className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connect Google Drive</h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
            Securely connect your Google Drive to store and analyze governance documents with AI-powered agents.
          </p>
          <button
            onClick={connectToDrive}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
          >
            <LinkIcon className="w-5 h-5" />
            Connect to Google Drive
          </button>

          <div className="mt-8 pt-8 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] max-w-2xl mx-auto">
              🔒 Secure OAuth 2.0 authentication • Files stored in your Drive • AI analysis with Gemini 1.5 Pro • No database required
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Upload, manage, and analyze governance documents
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          Connected to Drive
        </div>
      </div>

      {/* Upload Zone */}
      {/* Upload Zone */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            disabled={uploading}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm w-full max-w-xs"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <DriveUploader
          onUploadSuccess={() => {
            loadDocs();
            // We can't easily auto-select the file here without changing DriveUploader to return the full file object
            // But loadDocs will refresh the list.
          }}
          docType={docType}
        />
      </div>

      {/* Analysis Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm">
          <Play className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm">
            {selected.size} document{selected.size > 1 ? "s" : ""} selected
          </span>

          <button
            onClick={runAnalysis}
            className="ml-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Run AI Analysis
          </button>

          {analysisMsg && (
            <span className="text-xs text-[var(--text-muted)] animate-pulse">{analysisMsg}</span>
          )}
        </div>
      )}

      {/* Document List */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            No documents uploaded yet. Upload your first governance document above.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {documents.map((doc) => (
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
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    {doc.analysisStatus && <AnalysisStatusBadge status={doc.analysisStatus} />}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {doc.properties?.docType || 'other'} •{" "}
                    {doc.size ? `${(parseInt(doc.size) / 1024).toFixed(1)} KB` : "Unknown size"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(doc.createdTime).toLocaleDateString()}
                  </span>

                  {doc.webViewLink && (
                    <a
                      href={doc.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      View in Drive
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Analysis status badge component
function AnalysisStatusBadge({ status }: { status: string }) {
  const configs = {
    pending: {
      icon: null,
      label: 'Pending',
      className: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    },
    analyzing: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: 'Analyzing',
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    },
    complete: {
      icon: <CheckCircle className="w-3 h-3" />,
      label: 'Analyzed',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Error',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
    },
  };

  const config = configs[status as keyof typeof configs] || configs.pending;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
