from fastapi import APIRouter, Depends, Query
from typing import Optional

from backend.app.auth import verify_api_key
from backend.app.database import get_db
from backend.app.models.schemas import AuditEntry, AuditLogResponse

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=AuditLogResponse)
async def get_audit_log(
    job_id: Optional[str] = Query(None),
    agent_type: Optional[str] = Query(None),
    limit: int = Query(default=100, le=500),
    _key: str = Depends(verify_api_key),
):
    conditions = []
    params = []

    if job_id:
        conditions.append("job_id = ?")
        params.append(job_id)
    if agent_type:
        conditions.append("agent_type = ?")
        params.append(agent_type)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    db = await get_db()
    try:
        cursor = await db.execute(
            f"SELECT * FROM audit_log {where} ORDER BY timestamp DESC LIMIT ?",
            params + [limit],
        )
        rows = await cursor.fetchall()
    finally:
        await db.close()

    entries = [
        AuditEntry(
            id=row["id"],
            timestamp=row["timestamp"],
            agent_type=row["agent_type"],
            action=row["action"],
            job_id=row["job_id"],
            document_id=row["document_id"],
            input_hash=row["input_hash"],
            output_summary=row["output_summary"],
        )
        for row in rows
    ]
    return AuditLogResponse(entries=entries, total=len(entries))
