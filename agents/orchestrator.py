"""Agent Orchestrator — coordinates agents sequentially, runs self-correction reviewer loop."""

import asyncio
import json
import uuid
from datetime import datetime, timezone

from google import genai

from agents.minutes_agent import MinutesAnalyzerAgent
from agents.framework_agent import FrameworkCheckerAgent
from agents.coi_agent import COIDetectorAgent
from backend.app.config import settings
from shared.schemas import AgentType

REVIEWER_SYSTEM_PROMPT = """You are a Findings Reviewer Agent. Your role is to review findings
produced by other governance analysis agents and assess their quality.

For each finding, evaluate:
1. Is the evidence quote actually supporting the finding? (evidence_quality: high/medium/low)
2. Is the confidence score reasonable given the evidence? (confidence_appropriate: true/false)
3. Is the finding clearly stated and actionable? (clarity: high/medium/low)
4. For COI findings: Is the language appropriately non-accusatory? (tone_appropriate: true/false/na)

Return a JSON array where each item corresponds to a finding (by index) with this structure:
{
    "finding_index": 0,
    "evidence_quality": "high" | "medium" | "low",
    "confidence_appropriate": true | false,
    "suggested_confidence": 0.0 to 1.0,
    "clarity": "high" | "medium" | "low",
    "tone_appropriate": true | false,
    "flag_for_review": true | false,
    "review_note": "Brief explanation if flagged"
}

Set flag_for_review to true if:
- Evidence quality is low
- Confidence seems too high for the evidence provided
- The finding is unclear or not actionable
- COI language is accusatory

Return ONLY the JSON array, no other text."""

CROSS_DOCUMENT_SYSTEM_PROMPT = """You are a Cross-Document Analysis Agent. Your role is to look ACROSS
multiple governance documents to identify patterns over time that individual document analysis would miss.

Analyze the provided documents and per-document findings to detect:

1. **recurring_risk** — Risks or concerns mentioned across multiple meetings/documents.
   Look for the same risk appearing in different documents, even if worded differently.

2. **unresolved_action_item** — Action items assigned in earlier documents that are never
   marked as resolved or addressed in later documents.

3. **escalating_theme** — Issues that grow in severity or urgency over time across documents.
   Look for topics that start as minor notes and become major agenda items.

4. **persistent_governance_gap** — Framework or procedural gaps that repeat across multiple
   meetings without being addressed. Patterns of non-compliance or missing procedures.

For each finding, return a JSON object with:
{
    "finding_type": "recurring_risk" | "unresolved_action_item" | "escalating_theme" | "persistent_governance_gap",
    "title": "Brief title",
    "description": "Detailed description of the cross-document pattern",
    "severity": "high" | "medium" | "low" | "info",
    "confidence": 0.0 to 1.0,
    "source_documents": ["filename1.pdf", "filename2.pdf"],
    "evidence_quotes": {
        "filename1.pdf": "relevant quote from first document",
        "filename2.pdf": "relevant quote from second document"
    }
}

Return a JSON array of findings. If no cross-document patterns are found, return an empty array [].
Return ONLY the JSON array, no other text."""


class Orchestrator:
    """Coordinates the three analysis agents and the reviewer self-correction loop."""

    def __init__(self, job_id: str, db):
        self.job_id = job_id
        self.db = db
        self.client = genai.Client(api_key=settings.gemini_api_key)

    async def log_audit(self, action: str, output_summary: str, agent_type: str = "orchestrator"):
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT INTO audit_log (timestamp, agent_type, action, job_id, output_summary)
               VALUES (?, ?, ?, ?, ?)""",
            (now, agent_type, action, self.job_id, output_summary),
        )
        await self.db.commit()

    async def save_finding(self, finding: dict, agent_type: str, flagged: bool = False):
        finding_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT INTO findings
               (id, job_id, agent_type, finding_type, title, description,
                evidence_quote, source_document, section_reference,
                confidence, severity, flagged_for_review, created_at, metadata_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                finding_id,
                self.job_id,
                agent_type,
                finding.get("finding_type", "unknown"),
                finding.get("title", "Untitled Finding"),
                finding.get("description", ""),
                finding.get("evidence_quote"),
                finding.get("source_document"),
                finding.get("section_reference"),
                finding.get("confidence", 0.5),
                finding.get("severity", "info"),
                1 if flagged else 0,
                now,
                json.dumps({
                    k: v
                    for k, v in finding.items()
                    if k
                    not in (
                        "finding_type", "title", "description", "evidence_quote",
                        "source_document", "section_reference", "confidence",
                        "severity", "document_id",
                    )
                }),
            ),
        )
        await self.db.commit()
        return finding_id

    async def run_cross_document_analysis(
        self, documents: list[dict], all_findings: list[dict]
    ) -> list[dict]:
        """Analyze patterns across all documents using prior agent findings as context."""
        if len(documents) < 2:
            return []

        # Build document content section
        doc_sections = []
        for doc in documents:
            filename = doc.get("filename", "unknown")
            content = doc.get("content", "")
            doc_sections.append(
                f"=== DOCUMENT: {filename} ===\n{content}\n=== END: {filename} ==="
            )
        documents_text = "\n\n".join(doc_sections)

        # Build per-document findings summary
        findings_by_doc = {}
        for f in all_findings:
            src = f.get("source_document", "unknown")
            findings_by_doc.setdefault(src, []).append(
                {
                    "agent": f.get("agent_type", "unknown"),
                    "type": f.get("finding_type"),
                    "title": f.get("title"),
                    "description": f.get("description"),
                    "severity": f.get("severity"),
                    "confidence": f.get("confidence"),
                }
            )
        findings_text = json.dumps(findings_by_doc, indent=2)

        user_content = (
            f"{CROSS_DOCUMENT_SYSTEM_PROMPT}\n\n---\n\n"
            f"DOCUMENTS:\n{documents_text}\n\n---\n\n"
            f"PER-DOCUMENT FINDINGS:\n{findings_text}"
        )

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_content,
        )

        # Parse response (same markdown-fence stripping as run_reviewer)
        result_text = response.text.strip()
        if result_text.startswith("```"):
            lines = result_text.split("\n")[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            result_text = "\n".join(lines)

        findings = json.loads(result_text) if result_text else []

        # Normalize each finding for save_finding compatibility
        for f in findings:
            f["agent_type"] = "cross_document"
            # Store source_documents list and evidence_quotes in metadata
            # Pick first source_document for the DB column
            source_docs = f.get("source_documents", [])
            f["source_document"] = source_docs[0] if source_docs else None
            # evidence_quotes will flow into metadata_json via save_finding

        return findings

    async def run_reviewer(self, all_findings: list[dict]) -> list[dict]:
        """Self-correction loop: review findings and flag low-quality ones."""
        if not all_findings:
            return []

        await self.log_audit(
            action="reviewer_started",
            output_summary=f"Reviewing {len(all_findings)} findings",
            agent_type="reviewer",
        )

        # Prepare findings summary for reviewer
        findings_text = json.dumps(
            [
                {
                    "index": i,
                    "agent": f.get("agent_type", "unknown"),
                    "type": f.get("finding_type"),
                    "title": f.get("title"),
                    "description": f.get("description"),
                    "evidence_quote": f.get("evidence_quote"),
                    "confidence": f.get("confidence"),
                    "severity": f.get("severity"),
                }
                for i, f in enumerate(all_findings)
            ],
            indent=2,
        )

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{REVIEWER_SYSTEM_PROMPT}\n\n---\n\nFINDINGS TO REVIEW:\n{findings_text}",
            )

            # Parse reviewer output
            review_text = response.text.strip()
            if review_text.startswith("```"):
                lines = review_text.split("\n")[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                review_text = "\n".join(lines)

            reviews = json.loads(review_text) if review_text else []

            # Apply reviewer adjustments
            review_map = {r.get("finding_index", -1): r for r in reviews if isinstance(r, dict)}

            for i, finding in enumerate(all_findings):
                review = review_map.get(i)
                if review:
                    # Adjust confidence if reviewer suggests different value
                    if not review.get("confidence_appropriate", True) and "suggested_confidence" in review:
                        finding["original_confidence"] = finding.get("confidence")
                        finding["confidence"] = review["suggested_confidence"]

                    # Flag for review if needed
                    if review.get("flag_for_review", False):
                        finding["flagged_for_review"] = True
                        finding["review_note"] = review.get("review_note", "")

            await self.log_audit(
                action="reviewer_completed",
                output_summary=f"Reviewed {len(all_findings)} findings, flagged {sum(1 for f in all_findings if f.get('flagged_for_review'))}",
                agent_type="reviewer",
            )

        except Exception as e:
            await self.log_audit(
                action="reviewer_error",
                output_summary=f"Reviewer failed: {str(e):.200}",
                agent_type="reviewer",
            )
            # Don't fail the whole pipeline if reviewer fails

        return all_findings

    async def run(self, documents: list[dict]) -> dict:
        """Run the full analysis pipeline: 3 agents -> reviewer -> save findings."""
        await self.log_audit(
            action="orchestration_started",
            output_summary=f"Starting analysis of {len(documents)} documents",
        )

        # Update job status to running
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            "UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?",
            (now, self.job_id),
        )
        await self.db.commit()

        all_findings = []
        agent_results: dict[str, int | str] = {}

        # Run agents sequentially (as specified in architecture)
        agents = [
            (MinutesAnalyzerAgent, "minutes_analyzer"),
            (FrameworkCheckerAgent, "framework_checker"),
            (COIDetectorAgent, "coi_detector"),
        ]

        for i, (agent_cls, agent_name) in enumerate(agents):
            if i > 0:
                await asyncio.sleep(15)

            try:
                await self.log_audit(
                    action=f"{agent_name}_starting",
                    output_summary=f"Starting {agent_name}",
                )

                agent = agent_cls(job_id=self.job_id, db=self.db)
                findings = await agent.run(documents)

                # Tag findings with agent type
                for f in findings:
                    f["agent_type"] = agent_name

                agent_results[agent_name] = len(findings)
                all_findings.extend(findings)

            except Exception as e:
                await self.log_audit(
                    action=f"{agent_name}_failed",
                    output_summary=f"{agent_name} failed: {str(e):.200}",
                )
                agent_results[agent_name] = f"error: {str(e):.100}"

        # Cross-document analysis step
        await asyncio.sleep(15)
        try:
            await self.log_audit(
                action="cross_document_starting",
                output_summary="Starting cross-document pattern analysis",
            )

            cross_findings = await self.run_cross_document_analysis(
                documents, all_findings
            )

            agent_results["cross_document"] = len(cross_findings)
            all_findings.extend(cross_findings)

            await self.log_audit(
                action="cross_document_completed",
                output_summary=f"Found {len(cross_findings)} cross-document patterns",
            )

        except Exception as e:
            await self.log_audit(
                action="cross_document_failed",
                output_summary=f"Cross-document analysis failed: {str(e)[:200]}",
            )
            agent_results["cross_document"] = f"error: {str(e)[:100]}"

        # Self-correction reviewer loop
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            "UPDATE jobs SET status = 'reviewing', updated_at = ? WHERE id = ?",
            (now, self.job_id),
        )
        await self.db.commit()

        all_findings = await self.run_reviewer(all_findings)

        # Save all findings to database
        saved_count = 0
        for finding in all_findings:
            try:
                await self.save_finding(
                    finding,
                    agent_type=finding.get("agent_type", "unknown"),
                    flagged=finding.get("flagged_for_review", False),
                )
                saved_count += 1
            except Exception as e:
                await self.log_audit(
                    action="save_finding_error",
                    output_summary=f"Failed to save finding: {str(e):.200}",
                )

        summary = {
            "total_findings": saved_count,
            "by_agent": agent_results,
            "flagged_for_review": sum(
                1 for f in all_findings if f.get("flagged_for_review")
            ),
        }

        await self.log_audit(
            action="orchestration_completed",
            output_summary=json.dumps(summary),
        )

        return {"summary": summary, "findings": all_findings}
