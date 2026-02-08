"""Agent package for governance analysis."""

from .base import BaseAgent
from .minutes_agent import MinutesAnalyzerAgent
from .framework_agent import FrameworkCheckerAgent
from .coi_agent import COIDetectorAgent

__all__ = [
    "BaseAgent",
    "MinutesAnalyzerAgent", 
    "FrameworkCheckerAgent",
    "COIDetectorAgent",
]
