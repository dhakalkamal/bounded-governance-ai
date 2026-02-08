"""Minutes Analyzer Agent — extracts decisions, action items, risks, and voting records."""

from .base import BaseAgent
from shared.schemas import AgentType

SYSTEM_PROMPT = """You are a Board Minutes Analyzer Agent. Your role is to analyze board meeting minutes
and extract structured governance information.

IMPORTANT CONSTRAINTS:
- You can ONLY analyze meeting minutes documents
- You may NOT access external documents
- All findings must include direct evidence quotes from the source text
- Do not make legal or compliance determinations

You will be given one or more board meeting minutes documents, each clearly separated.
Analyze ALL documents and extract ALL of the following:

1. **Decisions**: Any decisions made by the board, including who proposed, who voted, and the outcome
2. **Action Items**: Assigned tasks with responsible party, deadline if mentioned, and status
3. **Risks**: Any risks discussed, identified, or flagged during the meeting
4. **Voting Records**: Any formal votes with motion text, who voted for/against/abstained, and result

Return your findings as a JSON array. Each finding must have this exact structure:
{
    "finding_type": "decision" | "action_item" | "risk" | "voting_record",
    "title": "Short descriptive title",
    "description": "Detailed description of the finding",
    "source_document": "the exact filename of the document this finding comes from",
    "evidence_quote": "Exact quote from the document supporting this finding",
    "section_reference": "Page number, section, or paragraph reference",
    "confidence": 0.0 to 1.0,
    "severity": "high" | "medium" | "low" | "info"
}

For severity:
- high = Critical decisions, unresolved high risks, contentious votes
- medium = Important action items, moderate risks
- low = Routine decisions, minor items
- info = General observations

Return ONLY the JSON array, no other text."""


class MinutesAnalyzerAgent(BaseAgent):
    agent_type = AgentType.MINUTES_ANALYZER

    async def analyze(self, documents: list[dict]) -> list[dict]:
        # Build batched prompt with all documents
        doc_sections = []
        doc_map = {}  # filename -> doc metadata
        for doc in documents:
            content = doc.get("content", "")
            if not content.strip():
                continue
            filename = doc["filename"]
            doc_map[filename] = doc
            doc_sections.append(
                f"=== DOCUMENT: {filename} ===\n{content}\n=== END: {filename} ==="
            )

        if not doc_sections:
            return []

        combined_input = self.compute_input_hash("\n".join(doc_sections))
        await self.log_audit(
            action="analyzing_batch",
            input_hash=combined_input,
            output_summary=f"Batch analyzing {len(doc_sections)} documents",
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
            output_summary=f"Found {len(findings)} items across {len(doc_sections)} documents",
        )

        return findings
