import json
from fastapi import APIRouter, Depends, HTTPException

from backend.app.auth import verify_api_key
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def governed_chat(
    req: ChatRequest,
    _key: str = Depends(verify_api_key),
):
    """Governed chat: answers questions grounded in uploaded documents only.

    The chat agent can only access retrieved snippets — never raw docs directly
    (per the agent access matrix).
    """
    if not req.document_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one document_id is required for governed chat",
        )

    db = await get_db()
    try:
        placeholders = ",".join("?" for _ in req.document_ids)
        cursor = await db.execute(
            f"SELECT id, filename, content_text FROM documents WHERE id IN ({placeholders})",
            req.document_ids,
        )
        rows = await cursor.fetchall()
    finally:
        await db.close()

    if not rows:
        raise HTTPException(status_code=404, detail="No documents found")

    # Build context snippets (chat agent gets snippets, not raw docs per access matrix)
    snippets = []
    sources = []
    for row in rows:
        content = row["content_text"] or ""
        # Take first 3000 chars as snippet for MVP
        snippet = content[:3000]
        snippets.append(f"[Source: {row['filename']}]\n{snippet}")
        sources.append({"document_id": row["id"], "filename": row["filename"]})

    context = "\n\n---\n\n".join(snippets)

    try:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=f"""You are a governance assistant. Answer the user's question based ONLY on the
provided document snippets. If the answer is not in the documents, say so.
Always cite which document your answer comes from.
Do not make legal or compliance determinations.

DOCUMENT SNIPPETS:
{context}

USER QUESTION: {req.message}

Provide a clear, concise answer with citations to specific documents.""",
        )

        return ChatResponse(
            response=response.text,
            sources=sources,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")
