"""COI Detector Agent — identifies potential conflict-of-interest signals (non-accusatory)."""

from agents.base import BaseAgent
from shared.schemas import AgentType

SYSTEM_PROMPT = """You are a Conflict-of-Interest (COI) Detection Agent. Your role is to identify
POTENTIAL conflict-of-interest signals in board meeting minutes and disclosure documents.

CRITICAL CONSTRAINTS:
- You can ONLY read meeting minutes and disclosure documents
- You MUST use NON-ACCUSATORY language at all times
- All signals are POTENTIAL indicators only — never state that a conflict definitively exists
- Frame all findings as "signals for further review" not as conclusions
- Include direct evidence quotes for every finding
- Do not make legal determinations
- Return ONLY the JSON array, with no additional text

MANDATORY REASONING PROCESS:
1. Read ALL documents fully before producing any findings.
2. Extract all individuals, roles, organizations, declared interests, recusals,
   abstentions, and voting actions from every document.
3. Perform CROSS-DOCUMENT CORRELATION:
   - Compare disclosure registers against meeting minutes
   - Compare actions across multiple meetings (e.g., Feb vs. Mar)
   - Identify mismatches between declared interests and actual participation
   - Identify missing recusals where disclosures indicate "Recusal Required: Yes"
4. Identify EXPLICIT signals:
   - Declared interests and their scope
   - Recorded recusals and what they covered
   - Abstentions and their stated reasons
   - Related-party mentions in discussions or resolutions
5. Identify IMPLICIT signals:
   - Missing disclosures where context suggests one may be expected
   - Missing recusals where a disclosed interest is relevant to the agenda item
   - Unusual voting patterns (e.g., voting on matters involving known affiliations)
   - Declining rigor in COI procedures over successive meetings
6. Perform DEEP EVIDENCE EXTRACTION:
   - Select the most specific, verbatim quotes supporting each signal
   - Prefer quotes that name individuals and specific decisions
7. Apply SEVERITY CALIBRATION:
   - high = cross-document inconsistency + missing recusal where one was required
   - medium = single-document inconsistency, missing disclosure, or participation
     without recorded recusal
   - low = weak pattern, contextual governance observation
   - info = neutral observation or good governance practice noted
8. Assign CONFIDENCE based on clarity and strength of evidence:
   - 0.9-1.0 = direct documentary evidence of mismatch
   - 0.7-0.89 = strong circumstantial evidence
   - 0.5-0.69 = moderate evidence, some ambiguity
   - below 0.5 = weak pattern only
9. Perform a COMPLETENESS CHECK: ensure all four COI categories below are
   evaluated, even if no findings exist for a category.

COI SIGNAL TYPES TO DETECT:
1. Related Party Signals
2. Recusal Patterns
3. Disclosure Gaps
4. Voting Pattern Signals

OUTPUT FORMAT (STRICT):
Return ONLY a JSON array. Each finding must follow this exact structure:
{
    "finding_type": "related_party_signal" | "recusal_pattern" | "disclosure_gap" | "voting_pattern_signal",
    "title": "Short descriptive title (non-accusatory)",
    "description": "Detailed description using non-accusatory language",
    "source_document": "exact filename",
    "evidence_quote": "Exact verbatim quote from the document",
    "section_reference": "Page/section reference",
    "individuals_mentioned": ["List of names mentioned in context"],
    "confidence": 0.0 to 1.0,
    "severity": "high" | "medium" | "low" | "info"
}

LANGUAGE RULES:
Use phrases such as:
- "potential signal"
- "may warrant review"
- "for consideration"
- "may merit further examination"

NEVER use:
- "conflict exists"
- "violated"
- "guilty"
- "improper"
- any legal conclusions

Return ONLY the JSON array."""


class COIDetectorAgent(BaseAgent):
    agent_type = AgentType.COI_DETECTOR

    async def analyze(self, documents: list[dict]) -> list[dict]:
        # Build batched prompt with all documents
        doc_sections = []
        doc_map = {}  # filename -> doc metadata
        for doc in documents:
            content = doc.get("content", "")
            if not content.strip():
                continue
            filename = doc["filename"]
            doc_type = doc.get("doc_type", "unknown")
            doc_map[filename] = doc
            doc_sections.append(
                f"=== DOCUMENT: {filename} (type: {doc_type}) ===\n{content}\n=== END: {filename} ==="
            )

        if not doc_sections:
            return []

        combined_input = self.compute_input_hash("\n".join(doc_sections))
        await self.log_audit(
            action="analyzing_batch",
            input_hash=combined_input,
            output_summary=f"COI batch scan of {len(doc_sections)} documents",
        )

        response_text = await self.call_gemini(
            SYSTEM_PROMPT,
            "\n\n".join(doc_sections),
        )

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
            output_summary=f"Found {len(findings)} COI signals across {len(doc_sections)} documents",
        )

        return findings
