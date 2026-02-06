from fastapi import APIRouter, Depends, Query
from typing import Optional

from backend.app.auth import verify_api_key
from backend.app.database import get_db
from backend.app.models.schemas import Finding, FindingsResponse

router = APIRouter(prefix="/api/findings", tags=["findings"])


@router.get("", response_model=FindingsResponse)
async def get_findings(
    job_id: Optional[str] = Query(None),
    agent_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
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
    if severity:
        conditions.append("severity = ?")
        params.append(severity)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    db = await get_db()
    try:
        cursor = await db.execute(
            f"SELECT * FROM findings {where} ORDER BY created_at DESC", params
        )
        rows = await cursor.fetchall()
    finally:
        await db.close()

    findings = [
        Finding(
            id=row["id"],
            job_id=row["job_id"],
            agent_type=row["agent_type"],
            finding_type=row["finding_type"],
            title=row["title"],
            description=row["description"],
            evidence_quote=row["evidence_quote"],
            source_document=row["source_document"],
            section_reference=row["section_reference"],
            confidence=row["confidence"],
            severity=row["severity"],
            flagged_for_review=bool(row["flagged_for_review"]),
            created_at=row["created_at"],
        )
        for row in rows
    ]
    return FindingsResponse(findings=findings, total=len(findings))
