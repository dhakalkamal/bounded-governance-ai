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

Analyze the documents for these types of COI signals:

1. **Related Party Signals**: Mentions of transactions or decisions involving entities
   that may have relationships with board members
2. **Recusal Patterns**: Note when members recuse themselves (positive signal) or when
   recusal might have been expected but didn't occur
3. **Disclosure Gaps**: Areas where disclosure might be expected but is not present
4. **Voting Pattern Signals**: Unusual voting patterns that might warrant further review
   (e.g., a member voting on matters involving their known affiliations)

Return your findings as a JSON array. Each finding must have this exact structure:
{
    "finding_type": "related_party_signal" | "recusal_pattern" | "disclosure_gap" | "voting_pattern_signal",
    "title": "Short descriptive title (non-accusatory)",
    "description": "Detailed description using phrases like 'may warrant review', 'potential signal', 'for consideration'",
    "evidence_quote": "Exact quote from the document",
    "section_reference": "Page/section reference",
    "individuals_mentioned": ["List of names mentioned in context"],
    "confidence": 0.0 to 1.0,
    "severity": "high" | "medium" | "low" | "info"
}

For severity:
- high = Strong signal warranting prompt review
- medium = Moderate signal for routine review
- low = Weak signal, informational
- info = Context only, good governance practice noted

REMEMBER: Use language like "potential signal", "may warrant review", "for consideration".
NEVER use language like "conflict exists", "violated", "guilty", "improper".

Return ONLY the JSON array, no other text."""


class COIDetectorAgent(BaseAgent):
    agent_type = AgentType.COI_DETECTOR

    async def analyze(self, documents: list[dict]) -> list[dict]:
        all_findings = []

        for doc in documents:
            content = doc.get("content", "")
            if not content.strip():
                continue

            input_hash = self.compute_input_hash(content)
            await self.log_audit(
                action="analyzing_document",
                document_id=doc["id"],
                input_hash=input_hash,
                output_summary=f"COI scan: {doc['filename']}",
            )

            response_text = await self.call_gemini(
                SYSTEM_PROMPT,
                f"DOCUMENT: {doc['filename']}\nTYPE: {doc.get('doc_type', 'unknown')}\n\n{content}",
            )

            findings = self.parse_json_response(response_text)

            for finding in findings:
                finding["source_document"] = doc["filename"]
                finding["document_id"] = doc["id"]

            await self.log_audit(
                action="document_analyzed",
                document_id=doc["id"],
                input_hash=input_hash,
                output_summary=f"Found {len(findings)} COI signals in {doc['filename']}",
            )

            all_findings.extend(findings)

        return all_findings
