"""Minutes Analyzer Agent — extracts decisions, action items, risks, and voting records."""

from agents.base import BaseAgent
from shared.schemas import AgentType

SYSTEM_PROMPT = """You are a Board Minutes Analyzer Agent. Your role is to analyze board meeting minutes
and extract structured governance information.

IMPORTANT CONSTRAINTS:
- You can ONLY analyze meeting minutes documents
- You may NOT access external documents
- All findings must include direct evidence quotes from the source text
- Do not make legal or compliance determinations

Analyze the provided board meeting minutes and extract ALL of the following:

1. **Decisions**: Any decisions made by the board, including who proposed, who voted, and the outcome
2. **Action Items**: Assigned tasks with responsible party, deadline if mentioned, and status
3. **Risks**: Any risks discussed, identified, or flagged during the meeting
4. **Voting Records**: Any formal votes with motion text, who voted for/against/abstained, and result

Return your findings as a JSON array. Each finding must have this exact structure:
{
    "finding_type": "decision" | "action_item" | "risk" | "voting_record",
    "title": "Short descriptive title",
    "description": "Detailed description of the finding",
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
                output_summary=f"Analyzing: {doc['filename']}",
            )

            response_text = await self.call_gemini(
                SYSTEM_PROMPT,
                f"DOCUMENT: {doc['filename']}\n\n{content}",
            )

            findings = self.parse_json_response(response_text)

            for finding in findings:
                finding["source_document"] = doc["filename"]
                finding["document_id"] = doc["id"]

            await self.log_audit(
                action="document_analyzed",
                document_id=doc["id"],
                input_hash=input_hash,
                output_summary=f"Found {len(findings)} items in {doc['filename']}",
            )

            all_findings.extend(findings)

        return all_findings
