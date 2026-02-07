"""Framework Checker Agent — identifies governance gaps by comparing minutes against framework docs."""

from .base import BaseAgent
from shared.schemas import AgentType

SYSTEM_PROMPT = """You are a Governance Framework Checker Agent. Your role is to analyze board meeting
minutes against governance framework documents and policies to identify gaps.

IMPORTANT CONSTRAINTS:
- You can read meeting minutes, policy documents, and governance framework references
- You may NOT issue compliance verdicts or legal conclusions
- All findings must include direct evidence quotes
- Use objective, analytical language

You will be given one or more meeting minutes documents and optionally governance framework/policy
documents, each clearly separated. Compare ALL meeting minutes against the framework documents and identify:

1. **Procedural Gaps**: Required procedures that were not followed (e.g., quorum not verified,
   required approvals missing, notification requirements not met)
2. **Documentation Gaps**: Required information that is missing from the minutes
   (e.g., no record of vote counts, missing attendee list, undocumented conflicts)
3. **Policy Deviations**: Actions taken that appear to deviate from stated policies
4. **Best Practice Gaps**: Areas where governance best practices suggest improvement

Return your findings as a JSON array. Each finding must have this exact structure:
{
    "finding_type": "procedural_gap" | "documentation_gap" | "policy_deviation" | "best_practice_gap",
    "title": "Short descriptive title",
    "description": "Detailed description of the gap identified",
    "source_document": "the exact filename of the minutes document this finding applies to",
    "evidence_quote": "Exact quote from minutes or framework doc supporting this finding",
    "section_reference": "Page/section reference in the source document",
    "framework_reference": "The specific policy or framework clause that is relevant",
    "confidence": 0.0 to 1.0,
    "severity": "high" | "medium" | "low" | "info"
}

For severity:
- high = Clear procedural violation, missing mandatory requirement
- medium = Significant documentation gap, potential policy concern
- low = Minor deviation, best practice suggestion
- info = Observation, no action needed

Return ONLY the JSON array, no other text."""


class FrameworkCheckerAgent(BaseAgent):
    agent_type = AgentType.FRAMEWORK_CHECKER

    async def analyze(self, documents: list[dict]) -> list[dict]:
        # Separate minutes from framework/policy docs
        minutes_docs = [
            d
            for d in documents
            if d.get("doc_type") in ("minutes", "other")
        ]
        framework_docs = [
            d
            for d in documents
            if d.get("doc_type") in ("policy", "framework", "other")
        ]

        if not minutes_docs:
            return []

        # Build framework context
        framework_sections = []
        for doc in framework_docs:
            if doc.get("content", "").strip():
                framework_sections.append(
                    f"=== FRAMEWORK/POLICY: {doc['filename']} ===\n{doc['content']}\n=== END: {doc['filename']} ==="
                )

        # Build batched minutes content
        minutes_sections = []
        doc_map = {}  # filename -> doc metadata
        for doc in minutes_docs:
            content = doc.get("content", "")
            if not content.strip():
                continue
            filename = doc["filename"]
            doc_map[filename] = doc
            minutes_sections.append(
                f"=== MEETING MINUTES: {filename} ===\n{content}\n=== END: {filename} ==="
            )

        if not minutes_sections:
            return []

        combined_input = self.compute_input_hash(
            "\n".join(minutes_sections + framework_sections)
        )
        await self.log_audit(
            action="analyzing_batch",
            input_hash=combined_input,
            output_summary=f"Framework check: {len(minutes_sections)} minutes docs, {len(framework_sections)} framework docs",
        )

        user_content = "\n\n".join(minutes_sections)
        if framework_sections:
            user_content += (
                "\n\n===\n\nGOVERNANCE FRAMEWORK/POLICY DOCUMENTS:\n\n"
                + "\n\n".join(framework_sections)
            )
        else:
            user_content += "\n\n[No explicit framework documents provided — analyze against general governance best practices]"

        response_text = await self.call_gemini(SYSTEM_PROMPT, user_content)
        findings = self.parse_json_response(response_text)

        # Map document_id from filename
        for finding in findings:
            src = finding.get("source_document", "")
            matched_doc = doc_map.get(src)
            if matched_doc:
                finding["document_id"] = matched_doc["id"]

        await self.log_audit(
            action="batch_analyzed",
            input_hash=combined_input,
            output_summary=f"Found {len(findings)} gaps across {len(minutes_sections)} documents",
        )

        return findings
