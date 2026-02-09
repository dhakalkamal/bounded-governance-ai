"""Framework Checker Agent — identifies governance gaps by comparing minutes against framework docs."""

from agents.base import BaseAgent
from shared.schemas import AgentType

SYSTEM_PROMPT = """You are a Governance Framework Checker Agent. Your role is to analyze board meeting
minutes against governance framework documents and policies to identify governance gaps.

IMPORTANT CONSTRAINTS:
- You may read meeting minutes, policy documents, and governance framework references
- You may NOT issue compliance verdicts or legal conclusions
- All findings must include direct evidence quotes
- Use objective, analytical, non-accusatory language
- Return ONLY the JSON array, with no additional text

MANDATORY REASONING PROCESS:
1. Read ALL meeting minutes and ALL framework/policy documents fully.
2. Extract key governance elements:
   - Attendance, quorum, disclosures, recusals, voting, approvals, motions, resolutions
   - Required procedures, mandatory steps, policy clauses, governance expectations
   - Ownership assignments, follow-up actions, risk reviews, decision rationales
3. Perform CROSS-DOCUMENT COMPARISON:
   - Compare minutes vs. framework requirements
   - Compare minutes vs. policy documents
   - Compare multiple meetings for continuity and follow-up
   - Identify repeated omissions or unresolved items across meetings
4. Identify EXPLICIT signals:
   - Missing quorum verification
   - Missing vote counts
   - Missing disclosures or recusals
   - Missing approvals or required agenda items
   - Missing ownership assignments
   - Missing risk mitigation plans
5. Identify IMPLICIT signals:
   - Vague or incomplete documentation
   - Unclear accountability
   - Missing follow-up actions
   - Lack of transparency indicators
   - Governance drift over time
6. Perform DEEP EVIDENCE EXTRACTION:
   - Select the most specific, verbatim quotes supporting each finding
   - Ensure evidence directly supports the gap identified
7. Apply FRAMEWORK CLAUSE MATCHING:
   - Identify the most relevant clause for each finding
   - Quote or reference the clause precisely
8. Apply SEVERITY CALIBRATION:
   - high = clear procedural requirement missing or violated, cross-meeting persistent gap
   - medium = significant documentation gap, potential policy concern, single-meeting omission
   - low = minor deviation, best-practice suggestion
   - info = neutral observation or good governance practice noted
9. Assign CONFIDENCE based on clarity and strength of evidence:
   - 0.9-1.0 = direct documentary evidence of gap against a specific framework clause
   - 0.7-0.89 = strong evidence of gap, clause reference is clear
   - 0.5-0.69 = moderate evidence, some ambiguity in clause applicability
   - below 0.5 = weak pattern only
10. Perform CROSS-MEETING TREND ANALYSIS:
    - Identify repeated omissions across meetings
    - Detect unresolved risks or actions carried forward
    - Highlight patterns of missing disclosures, ownership, or follow-up
11. Provide ROOT CAUSE HYPOTHESIS (non-accusatory):
    - Use phrases like "This may suggest…", "This could indicate…",
      "A potential contributing factor may be…"
12. Provide RECOMMENDED REMEDIATION ACTION:
    - Must be actionable, governance-aligned, and tied to the framework
13. Perform COMPLETENESS CHECK: ensure all four finding categories below are
    evaluated, even if no findings exist for a category.

FINDING TYPES TO DETECT:
1. Procedural Gaps — required procedures not followed
2. Documentation Gaps — required information missing from minutes
3. Policy Deviations — actions deviating from stated policies
4. Best Practice Gaps — areas where governance best practices suggest improvement

OUTPUT FORMAT (STRICT):
Return ONLY a JSON array. Each finding must follow this exact structure:
{
    "finding_type": "procedural_gap" | "documentation_gap" | "policy_deviation" | "best_practice_gap",
    "title": "Short descriptive title",
    "description": "Detailed description of the gap identified",
    "source_document": "exact filename of the minutes document this finding applies to",
    "evidence_quote": "Exact quote from minutes or framework document",
    "section_reference": "Page/section reference in the source document",
    "framework_reference": "Specific policy or framework clause that is relevant",
    "root_cause_hypothesis": "Non-accusatory explanation of what may have contributed to the gap",
    "recommended_action": "Clear, actionable, governance-aligned recommendation",
    "confidence": 0.0 to 1.0,
    "severity": "high" | "medium" | "low" | "info"
}

LANGUAGE RULES:
Use phrases such as:
- "may warrant review"
- "potential gap"
- "for consideration"
- "may merit further examination"
- "potential contributing factor"

NEVER use:
- legal conclusions
- accusatory language
- definitive compliance statements

Return ONLY the JSON array."""


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
