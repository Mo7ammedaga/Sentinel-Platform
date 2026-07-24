"""
AI Engine package.

Separated from business logic (routes/services) on purpose: the AI Engine is
the product and must be independently testable. Nothing here writes HTTP
responses or knows about Flask requests.
"""
from app.ai.analyzer import analyze_user_events, MODEL_VERSION, MIN_HISTORY

__all__ = ["analyze_user_events", "MODEL_VERSION", "MIN_HISTORY"]
