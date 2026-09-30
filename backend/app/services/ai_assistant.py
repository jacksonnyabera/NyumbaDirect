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
    def _room_summary(property_obj: Any) -> tuple[str, str]:
        property_type = str(getattr(property_obj, "property_type", "property") or "property")
        normalized_type = property_type.lower()
        bedrooms = getattr(property_obj, "bedrooms", None)
        bathrooms = getattr(property_obj, "bathrooms", None)

        if bedrooms is None or bedrooms < 0:
            bedroom_summary = "bedroom count not listed"
        elif bedrooms == 0 and "bedsitter" in normalized_type:
            bedroom_summary = "bedsitter layout"
        elif bedrooms == 0 and "studio" in normalized_type:
            bedroom_summary = "studio layout"
        elif bedrooms == 0:
            bedroom_summary = "bedroom count not listed"
        else:
            bedroom_label = "bedroom" if bedrooms == 1 else "bedrooms"
            bedroom_summary = f"{bedrooms} {bedroom_label}"

        if bathrooms is None or bathrooms < 0:
            bathroom_summary = "bathroom count not listed"
        else:
            bathroom_label = "bathroom" if bathrooms == 1 else "bathrooms"
            bathroom_summary = f"{bathrooms} {bathroom_label}"

        return bedroom_summary, bathroom_summary

    @staticmethod
    def answer_property_question(message: str, property_obj: Any = None) -> str:
        """Answer using listing facts only; send decisions to the property owner."""
        lower = message.lower().strip()
        title = getattr(property_obj, "title", None) or "this listing"
        if property_obj is None:
            return (
                "I can help with search and listing details. Open a property page "
                "to ask a question tied to that home's published information."
            )

        if any(word in lower for word in ("available", "vacant", "empty")):
            status = "marked available" if property_obj.is_available else "marked unavailable"
            answer = f"{title} is currently {status} in its listing. Please confirm with the landlord before arranging a viewing."
        elif any(word in lower for word in ("rent", "price", "monthly", "cost", "deposit")):
            rent = f"KSh {property_obj.monthly_rent:,.0f} per month"
            answer = f"The listing shows {rent} for {title}."
            if property_obj.deposit is not None:
                answer += f" The listed deposit is KSh {property_obj.deposit:,.0f}."
            else:
                answer += " A deposit amount is not listed."
            answer += " Confirm payment terms directly with the landlord."
        elif any(word in lower for word in ("bed", "bath", "room", "size", "type")):
            bedrooms, bathrooms = AIAssistantService._room_summary(property_obj)
            answer = (
                f"The listing describes {title} as a {property_obj.property_type.lower()}, "
                f"with {bedrooms} and {bathrooms}."
            )
        elif any(word in lower for word in ("where", "location", "near", "town", "area", "estate")):
            location = ", ".join(
                part for part in (property_obj.area, property_obj.town, property_obj.county)
                if part
            )
            answer = f"The listing gives the location as {location or 'not provided'}. Contact the landlord for exact directions."
        else:
            bedrooms, _ = AIAssistantService._room_summary(property_obj)
            answer = (
                f"I can help with {title}. The listing shows {property_obj.property_type.lower()}, "
                f"{bedrooms}, at KSh {property_obj.monthly_rent:,.0f} per month. "
                "Ask the landlord to confirm viewing times, availability and any details not shown here."
            )

        return answer

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
