import uuid
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException

from backend.app.auth import verify_api_key
from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.schemas import DocumentOut, DocumentListResponse
from backend.app.rbac import get_current_user, get_accessible_filenames, check_permission

router = APIRouter(prefix="/api/documents", tags=["documents"])


def extract_text(file_path: str, filename: str) -> str:
    """Extract text from uploaded file based on extension."""
    ext = os.path.splitext(filename)[1].lower()

    if ext in (".txt", ".md"):
        with open(file_path, "r", errors="replace") as f:
            return f.read()

    if ext == ".pdf":
        try:
            from PyPDF2 import PdfReader

            reader = PdfReader(file_path)
            pages = []
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                pages.append(f"[Page {i + 1}]\n{text}")
            return "\n\n".join(pages)
        except Exception:
            return "[PDF text extraction failed]"

    if ext == ".docx":
        try:
            from docx import Document

            doc = Document(file_path)
            return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception:
            return "[DOCX text extraction failed]"

    return "[Unsupported file type]"


@router.post("", response_model=DocumentOut)
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(default="other"),
    _key: str = Depends(verify_api_key),
    user: dict = Depends(get_current_user),
):
    check_permission(user, "uploadDocuments")
    doc_id = str(uuid.uuid4())
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_path = os.path.join(settings.upload_dir, f"{doc_id}_{file.filename}")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    text = extract_text(file_path, file.filename)
    now = datetime.now(timezone.utc).isoformat()

    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO documents (id, filename, doc_type, content_text, file_path, file_size, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (doc_id, file.filename, doc_type, text, file_path, len(content), now),
        )
        await db.commit()
    finally:
        await db.close()

    return DocumentOut(
        id=doc_id,
        filename=file.filename,
        doc_type=doc_type,
        file_size=len(content),
        uploaded_at=now,
        content_preview=text[:200] if text else None,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    _key: str = Depends(verify_api_key),
    user: dict = Depends(get_current_user),
):
    accessible = get_accessible_filenames(user["name"])

    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, filename, doc_type, file_size, uploaded_at, content_text FROM documents ORDER BY uploaded_at DESC"
        )
        rows = await cursor.fetchall()
    finally:
        await db.close()

    docs = [
        DocumentOut(
            id=row["id"],
            filename=row["filename"],
            doc_type=row["doc_type"],
            file_size=row["file_size"],
            uploaded_at=row["uploaded_at"],
            content_preview=(row["content_text"] or "")[:200] or None,
        )
        for row in rows
        if row["filename"] in accessible
    ]
    return DocumentListResponse(documents=docs, total=len(docs))


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: str,
    _key: str = Depends(verify_api_key),
    user: dict = Depends(get_current_user),
):
    accessible = get_accessible_filenames(user["name"])

    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = await cursor.fetchone()
    finally:
        await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    if row["filename"] not in accessible:
        raise HTTPException(status_code=403, detail="Access denied to this document")

    return DocumentOut(
        id=row["id"],
        filename=row["filename"],
        doc_type=row["doc_type"],
        file_size=row["file_size"],
        uploaded_at=row["uploaded_at"],
        content_preview=(row["content_text"] or "")[:500] or None,
    )
