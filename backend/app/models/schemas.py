from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --- Auth ---
class AuthHeader(BaseModel):
    x_api_key: str


# --- Documents ---
class DocumentOut(BaseModel):
    id: str
    filename: str
    doc_type: str
    file_size: Optional[int] = None
    uploaded_at: str
    content_preview: Optional[str] = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentOut]
    total: int


# --- Analysis ---
class AnalyzeRequest(BaseModel):
    document_ids: list[str] = Field(..., min_length=1)


class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    created_at: str
    updated_at: str
    result_summary: Optional[str] = None
    error: Optional[str] = None


# --- Findings ---
class Finding(BaseModel):
    id: str
    job_id: str
    agent_type: str
    finding_type: str
    title: str
    description: str
    evidence_quote: Optional[str] = None
    source_document: Optional[str] = None
    section_reference: Optional[str] = None
    confidence: float
    severity: str
    flagged_for_review: bool = False
    created_at: str


class FindingsResponse(BaseModel):
    findings: list[Finding]
    total: int


# --- Chat ---
class ChatRequest(BaseModel):
    message: str
    document_ids: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] = Field(default_factory=list)


# --- Audit ---
class AuditEntry(BaseModel):
    id: int
    timestamp: str
    agent_type: Optional[str] = None
    action: str
    job_id: Optional[str] = None
    document_id: Optional[str] = None
    input_hash: Optional[str] = None
    output_summary: Optional[str] = None


class AuditLogResponse(BaseModel):
    entries: list[AuditEntry]
    total: int
