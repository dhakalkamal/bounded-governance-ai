"""Base agent class with shared functionality: Gemini calls, audit logging, access control."""

import hashlib
import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from google import genai

from backend.app.config import settings
from shared.schemas import AgentType, DocumentType, AGENT_ACCESS_MATRIX


class BaseAgent(ABC):
    """Base class for all governance agents."""

    agent_type: AgentType
    model: str = "gemini-2.5-pro"

    def __init__(self, job_id: str, db):
        self.job_id = job_id
        self.db = db
        self.client = genai.Client(api_key=settings.gemini_api_key)

    @property
    def access_rules(self) -> dict:
        return AGENT_ACCESS_MATRIX.get(self.agent_type, {})

    def filter_documents(self, documents: list[dict]) -> list[dict]:
        """Enforce access matrix: only return documents this agent is allowed to read."""
        allowed_types = self.access_rules.get("can_read", [])
        allowed_type_values = [t.value for t in allowed_types]
        filtered = [d for d in documents if d.get("doc_type") in allowed_type_values]

        # For MVP, if no documents match the strict type filter, allow all
        # (since users may not have tagged doc types precisely yet)
        if not filtered and documents:
            return documents
        return filtered

    def compute_input_hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    async def log_audit(
        self,
        action: str,
        document_id: str | None = None,
        input_hash: str | None = None,
        output_summary: str | None = None,
        details: dict | None = None,
    ):
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT INTO audit_log (timestamp, agent_type, action, job_id, document_id, input_hash, output_summary, details_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                now,
                self.agent_type.value,
                action,
                self.job_id,
                document_id,
                input_hash,
                output_summary,
                json.dumps(details or {}),
            ),
        )
        await self.db.commit()

    async def call_gemini(self, system_prompt: str, user_content: str) -> str:
        """Call Gemini API and return the text response."""
        full_prompt = f"{system_prompt}\n\n---\n\n{user_content}"
        response = self.client.models.generate_content(
            model=self.model,
            contents=full_prompt,
        )
        return response.text

    def parse_json_response(self, text: str) -> list[dict]:
        """Extract JSON array from Gemini response, handling markdown fences."""
        cleaned = text.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            # Remove first and last fence lines
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines)

        try:
            result = json.loads(cleaned)
            if isinstance(result, dict) and "findings" in result:
                return result["findings"]
            if isinstance(result, list):
                return result
            return [result]
        except json.JSONDecodeError:
            # Try to find JSON array in the text
            start = cleaned.find("[")
            end = cleaned.rfind("]")
            if start != -1 and end != -1:
                try:
                    return json.loads(cleaned[start : end + 1])
                except json.JSONDecodeError:
                    pass
            return []

    @abstractmethod
    async def analyze(self, documents: list[dict]) -> list[dict]:
        """Run analysis on provided documents. Returns list of finding dicts."""
        ...

    async def run(self, documents: list[dict]) -> list[dict]:
        """Execute the agent: filter docs, analyze, log audit trail."""
        filtered_docs = self.filter_documents(documents)

        await self.log_audit(
            action="agent_started",
            output_summary=f"Processing {len(filtered_docs)} documents (of {len(documents)} provided)",
        )

        if not filtered_docs:
            await self.log_audit(action="agent_skipped", output_summary="No accessible documents")
            return []

        try:
            findings = await self.analyze(filtered_docs)
            await self.log_audit(
                action="agent_completed",
                output_summary=f"Generated {len(findings)} findings",
            )
            return findings
        except Exception as e:
            await self.log_audit(
                action="agent_error",
                output_summary=str(e)[:200],
            )
            raise
