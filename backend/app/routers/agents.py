import uuid
import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

from backend.app.auth import verify_api_key
from backend.app.database import get_db
from backend.app.models.schemas import AnalyzeRequest, AnalyzeResponse, JobStatusResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])


async def run_analysis(job_id: str, document_ids: list[str]):
    """Background task: runs the agent orchestrator."""
    from agents.orchestrator import Orchestrator

    db = await get_db()
    try:
        # Update job to running
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?",
            (now, job_id),
        )
        await db.commit()

        # Gather document data
        placeholders = ",".join("?" for _ in document_ids)
        cursor = await db.execute(
            f"SELECT id, filename, doc_type, content_text FROM documents WHERE id IN ({placeholders})",
            document_ids,
        )
        rows = await cursor.fetchall()
        documents = [
            {
                "id": row["id"],
                "filename": row["filename"],
                "doc_type": row["doc_type"],
                "content": row["content_text"] or "",
            }
            for row in rows
        ]

        if not documents:
            raise ValueError("No documents found for the given IDs")

        # Run orchestrator
        orchestrator = Orchestrator(job_id=job_id, db=db)
        result = await orchestrator.run(documents)

        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE jobs SET status = 'completed', updated_at = ?, result_summary = ? WHERE id = ?",
            (now, json.dumps(result.get("summary", {})), job_id),
        )
        await db.commit()

    except Exception as e:
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE jobs SET status = 'failed', updated_at = ?, error = ? WHERE id = ?",
            (now, str(e), job_id),
        )
        await db.commit()
    finally:
        await db.close()


@router.post("/analyze", response_model=AnalyzeResponse)
async def trigger_analysis(
    req: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    _key: str = Depends(verify_api_key),
):
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO jobs (id, status, document_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (job_id, "pending", json.dumps(req.document_ids), now, now),
        )
        await db.commit()
    finally:
        await db.close()

    background_tasks.add_task(run_analysis, job_id, req.document_ids)

    return AnalyzeResponse(
        job_id=job_id,
        status="pending",
        message="Analysis job queued",
    )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, _key: str = Depends(verify_api_key)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
        row = await cursor.fetchone()
    finally:
        await db.close()

    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=row["id"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        result_summary=row["result_summary"],
        error=row["error"],
    )
