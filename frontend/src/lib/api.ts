const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "dev-api-key-123";

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "x-api-key": API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export async function listDocuments() {
  return apiFetch("/api/documents");
}

export async function uploadDocument(file: File, docType: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("doc_type", docType);
  return apiFetch("/api/documents", {
    method: "POST",
    body: form,
  });
}

export async function triggerAnalysis(documentIds: string[]) {
  return apiFetch("/api/agents/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_ids: documentIds }),
  });
}

export async function getJobStatus(jobId: string) {
  return apiFetch(`/api/agents/status/${jobId}`);
}

export async function getFindings(params?: {
  job_id?: string;
  agent_type?: string;
  severity?: string;
}) {
  const query = new URLSearchParams();
  if (params?.job_id) query.set("job_id", params.job_id);
  if (params?.agent_type) query.set("agent_type", params.agent_type);
  if (params?.severity) query.set("severity", params.severity);
  const qs = query.toString();
  return apiFetch(`/api/findings${qs ? `?${qs}` : ""}`);
}

export async function sendChat(
  message: string,
  documentIds: string[],
  conversationHistory: { role: string; content: string }[] = []
) {
  return apiFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      document_ids: documentIds,
      conversation_history: conversationHistory,
    }),
  });
}

export async function updateFindingStatus(
  findingId: string,
  status: string
) {
  return apiFetch(`/api/findings/${findingId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function getAuditLog(params?: {
  job_id?: string;
  agent_type?: string;
}) {
  const query = new URLSearchParams();
  if (params?.job_id) query.set("job_id", params.job_id);
  if (params?.agent_type) query.set("agent_type", params.agent_type);
  const qs = query.toString();
  return apiFetch(`/api/audit${qs ? `?${qs}` : ""}`);
}
