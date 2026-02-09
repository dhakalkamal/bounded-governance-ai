from fastapi import APIRouter, Depends, HTTPException

from backend.app.auth import verify_api_key
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.schemas import ChatRequest, ChatResponse
from backend.app.rbac import get_current_user, get_accessible_filenames, check_permission

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = """You are a governance analysis assistant. You have access to the full text of uploaded governance documents and analysis findings produced by specialized AI agents.

STRICT RULES:
1. Answer ONLY from the provided documents and findings below. Do not use any outside knowledge.
2. Every factual claim MUST include a citation in the format [Source: filename, Section: X] or [Finding: title].
3. If the answer is not contained in the provided documents or findings, respond with: "I cannot find that information in the provided documents."
4. Do not make legal or compliance determinations — only summarize and cite what the documents say.
5. Be concise and direct."""


@router.post("", response_model=ChatResponse)
async def governed_chat(
    req: ChatRequest,
    _key: str = Depends(verify_api_key),
    user: dict = Depends(get_current_user),
):
    """Governed chat: answers questions grounded in uploaded documents and findings only."""
    check_permission(user, "chat")

    if not req.document_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one document_id is required for governed chat",
        )

    accessible = get_accessible_filenames(user["name"])

    db = await get_db()
    try:
        # Fetch full document content (no truncation)
        placeholders = ",".join("?" for _ in req.document_ids)
        cursor = await db.execute(
            f"SELECT id, filename, content_text FROM documents WHERE id IN ({placeholders})",
            req.document_ids,
        )
        doc_rows = await cursor.fetchall()

        # Verify all requested documents are accessible
        for row in doc_rows:
            if row["filename"] not in accessible:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied to document: {row['filename']}",
                )

        # Fetch findings only for accessible documents
        cursor = await db.execute(
            "SELECT title, description, agent_type, severity, source_document, section_reference, evidence_quote "
            "FROM findings ORDER BY created_at DESC"
        )
        finding_rows = [
            row for row in await cursor.fetchall()
            if row["source_document"] in accessible
        ]
    finally:
        await db.close()

    if not doc_rows:
        raise HTTPException(status_code=404, detail="No documents found")

    # Build document context
    doc_sections = []
    sources = []
    for row in doc_rows:
        content = row["content_text"] or ""
        doc_sections.append(f"=== Document: {row['filename']} ===\n{content}")
        sources.append({"document_id": row["id"], "filename": row["filename"]})

    documents_context = "\n\n".join(doc_sections)

    # Build findings summary
    findings_lines = []
    for fr in finding_rows:
        line = (
            f"- [{fr['agent_type']}] {fr['title']} (severity: {fr['severity']}): "
            f"{fr['description']}"
        )
        if fr["source_document"]:
            line += f" [Source: {fr['source_document']}"
            if fr["section_reference"]:
                line += f", Section: {fr['section_reference']}"
            line += "]"
        findings_lines.append(line)

    findings_context = "\n".join(findings_lines) if findings_lines else "No findings available yet."

    # Build the full prompt with system instructions + context
    context_block = f"""{SYSTEM_PROMPT}

--- DOCUMENTS ---
{documents_context}

--- ANALYSIS FINDINGS ---
{findings_context}
"""

    # Build multi-turn conversation for Gemini
    contents = [{"role": "user", "parts": [{"text": context_block}]}]
    contents.append({"role": "model", "parts": [{"text": "Understood. I will answer only from the provided documents and findings, with citations. How can I help?"}]})

    # Add conversation history
    for msg in req.conversation_history:
        role = "model" if msg.get("role") == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

    # Add current user message
    contents.append({"role": "user", "parts": [{"text": req.message}]})

    try:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
        )

        return ChatResponse(
            response=response.text,
            sources=sources,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")
