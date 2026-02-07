import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from backend.app.auth import verify_api_key
from backend.app.database import get_db
from backend.app.models.schemas import Finding, FindingsResponse, FindingStatusUpdate

router = APIRouter(prefix="/api/findings", tags=["findings"])


def _extract_review_status(metadata_json: Optional[str]) -> Optional[str]:
    """Extract review_status from metadata_json if present."""
    if not metadata_json:
        return None
    try:
        meta = json.loads(metadata_json)
        return meta.get("review_status")
    except (json.JSONDecodeError, TypeError):
        return None


def _row_to_finding(row) -> Finding:
    return Finding(
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
        review_status=_extract_review_status(row["metadata_json"]),
        created_at=row["created_at"],
    )


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

    findings = [_row_to_finding(row) for row in rows]
    return FindingsResponse(findings=findings, total=len(findings))


@router.patch("/{finding_id}/status", response_model=Finding)
async def update_finding_status(
    finding_id: str,
    body: FindingStatusUpdate,
    _key: str = Depends(verify_api_key),
):
    """Update the review status of a finding (verify, dispute, or flag)."""
    db = await get_db()
    try:
        # Fetch existing finding
        cursor = await db.execute(
            "SELECT * FROM findings WHERE id = ?", [finding_id]
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Finding not found")

        # Merge review_status into metadata_json
        existing_meta = {}
        if row["metadata_json"]:
            try:
                existing_meta = json.loads(row["metadata_json"])
            except (json.JSONDecodeError, TypeError):
                existing_meta = {}

        now = datetime.now(timezone.utc).isoformat()
        existing_meta["review_status"] = body.status
        existing_meta["reviewed_at"] = now

        # Set flagged_for_review based on status
        flagged = 1 if body.status in ("flagged", "disputed") else 0

        await db.execute(
            "UPDATE findings SET metadata_json = ?, flagged_for_review = ? WHERE id = ?",
            [json.dumps(existing_meta), flagged, finding_id],
        )

        # Log to audit_log
        await db.execute(
            "INSERT INTO audit_log (timestamp, agent_type, action, job_id, output_summary) VALUES (?, ?, ?, ?, ?)",
            [
                now,
                "human_reviewer",
                f"finding_{body.status}",
                row["job_id"],
                f"Finding '{row['title']}' marked as {body.status}",
            ],
        )

        await db.commit()

        # Re-fetch updated row
        cursor = await db.execute(
            "SELECT * FROM findings WHERE id = ?", [finding_id]
        )
        updated_row = await cursor.fetchone()
    finally:
        await db.close()

    return _row_to_finding(updated_row)
