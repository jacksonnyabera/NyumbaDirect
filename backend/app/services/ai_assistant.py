from dataclasses import dataclass
from typing import Any
import re


@dataclass
class AssistantSuggestion:
    reply: str
    confidence: float
    intent: str


class AIAssistantService:
    """Lightweight rule-based AI helper for property and screening workflows."""

    @staticmethod
    def summarize_message(message: str) -> str:
        cleaned = message.strip()
        if not cleaned:
            return "House hunter asked a new question."

        lower = cleaned.lower()
        if "available" in lower or "vacant" in lower:
            return "The user is asking about availability."
        if "rent" in lower or "price" in lower or "monthly" in lower:
            return "The user is asking about rent or monthly cost."
        if "location" in lower or "near" in lower or "town" in lower or "area" in lower:
            return "The user is asking about the property location."
        if "bed" in lower or "bath" in lower or "room" in lower:
            return "The user is asking about property size or rooms."

        return "The user is asking about the property listing."

    @staticmethod
    def draft_reply(message: str, property_title: str = "the property") -> str:
        cleaned = message.strip()
        lower = cleaned.lower()

        if "available" in lower or "vacant" in lower:
            return (
                f"Thanks for your interest in {property_title}. "
                "I can confirm the current availability of the property and help arrange a viewing."
            )

        if "rent" in lower or "price" in lower or "monthly" in lower:
            return (
                f"Thanks for your message about {property_title}. "
                "I can share the rental price, deposit details, and available move-in date."
            )

        if "near" in lower or "location" in lower or "town" in lower or "area" in lower:
            return (
                f"Thanks for asking about {property_title}. "
                "I can share the neighbourhood, transport access, and nearby amenities."
            )

        if "bed" in lower or "bath" in lower or "bedroom" in lower or "room" in lower:
            return (
                f"Thanks for your question about {property_title}. "
                "I can share the room count, bathroom count, and property layout."
            )

        return (
            f"Thanks for your message about {property_title}. "
            "I will review the listing and respond with the next best step."
        )

    @staticmethod
    def classify_intent(message: str) -> AssistantSuggestion:
        lower = message.lower().strip()

        if any(word in lower for word in ["available", "vacant", "empty"]):
            return AssistantSuggestion(
                reply="I can help confirm availability and start a viewing conversation.",
                confidence=0.92,
                intent="availability_check",
            )

        if any(word in lower for word in ["rent", "price", "monthly", "cost"]):
            return AssistantSuggestion(
                reply="I can help share rent, deposit and payment details.",
                confidence=0.92,
                intent="price_check",
            )

        if any(word in lower for word in ["location", "near", "town", "estate", "area"]):
            return AssistantSuggestion(
                reply="I can help explain the location and nearby services.",
                confidence=0.90,
                intent="location_check",
            )

        return AssistantSuggestion(
            reply="I can help connect you with the property owner or manager.",
            confidence=0.80,
            intent="general_inquiry",
        )
