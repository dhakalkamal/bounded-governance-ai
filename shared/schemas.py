"""Shared schema definitions used by backend and agents."""

from enum import Enum


class AgentType(str, Enum):
    MINUTES_ANALYZER = "minutes_analyzer"
    FRAMEWORK_CHECKER = "framework_checker"
    COI_DETECTOR = "coi_detector"
    REVIEWER = "reviewer"


class DocumentType(str, Enum):
    MINUTES = "minutes"
    POLICY = "policy"
    FRAMEWORK = "framework"
    DISCLOSURE = "disclosure"
    OTHER = "other"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    FAILED = "failed"


class FindingSeverity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


# Agent Access Matrix — defines what each agent can read
AGENT_ACCESS_MATRIX = {
    AgentType.MINUTES_ANALYZER: {
        "can_read": [DocumentType.MINUTES],
        "can_write": ["decisions", "risks", "action_items", "voting_records"],
        "restrictions": "No external docs access",
    },
    AgentType.FRAMEWORK_CHECKER: {
        "can_read": [DocumentType.MINUTES, DocumentType.POLICY, DocumentType.FRAMEWORK],
        "can_write": ["gap_analysis"],
        "restrictions": "No compliance verdicts",
    },
    AgentType.COI_DETECTOR: {
        "can_read": [DocumentType.MINUTES, DocumentType.DISCLOSURE],
        "can_write": ["coi_signals"],
        "restrictions": "Non-accusatory language only",
    },
}
