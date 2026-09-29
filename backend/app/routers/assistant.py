import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.property import Property


router = APIRouter(prefix="/assistant", tags=["Assistant"])


class AssistantQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=500)


def _number_exceeds_database_range(match: re.Match[str] | None) -> bool:
    if match is None:
        return False
    return int(match.group(1).replace(",", "")) > 2_147_483_647


@router.post("/chat")
def ask_assistant(data: AssistantQuestion, db: Session = Depends(get_db)):
    question = data.question.strip()
    lower = question.lower()

    if not question:
        return {"reply": "Type a question and I’ll help you get started.", "properties": []}

    rent_match = re.search(
        r"(?:under|below|up to|less than|maximum|max)\s*(?:ksh\s*)?([\d,]+)",
        lower,
    )
    min_rent = re.search(r"(?:over|above|at least|minimum|min)\s*(?:ksh\s*)?([\d,]+)", lower)
    beds_match = re.search(r"(\d+)\s*(?:\+\s*)?(?:bed|bedroom)", lower)
    if any(
        _number_exceeds_database_range(match)
        for match in (rent_match, min_rent, beds_match)
    ):
        return {
            "reply": "That number is outside the range I can search. Please try a smaller rent or bedroom count.",
            "properties": [],
        }

    rent_limit = int(rent_match.group(1).replace(",", "")) if rent_match else None
    rent_floor = int(min_rent.group(1).replace(",", "")) if min_rent else None
    bedrooms = int(beds_match.group(1)) if beds_match else None

    property_type = None
    for aliases, value in (
        (("bedsitter", "bachelor"), "BEDSITTER"),
        (("studio",), "STUDIO"),
        (("maisonette",), "MAISONETTE"),
        (("apartment", "flat"), "APARTMENT"),
        (("house", "bungalow", "townhouse"), "HOUSE"),
    ):
        if any(alias in lower for alias in aliases):
            property_type = value
            break

    location_match = re.search(
        r"\b(?:in|near|around|at)\s+([a-z][a-z -]{1,40}?)(?=\s+(?:under|below|up to|less than|with|for)\b|[?.!,]|$)",
        lower,
    )
    location = location_match.group(1).strip() if location_match else None
    wants_homes = any(
        word in lower
        for word in ("home", "house", "apartment", "flat", "bedsitter", "studio", "property", "properties", "listing", "rentals", "rent")
    )

    if wants_homes or location or rent_limit or rent_floor or bedrooms or property_type:
        query = (
            select(Property)
            .options(selectinload(Property.photos))
            .where(Property.is_available.is_(True))
        )
        if rent_limit is not None:
            query = query.where(Property.monthly_rent <= rent_limit)
        if rent_floor is not None:
            query = query.where(Property.monthly_rent >= rent_floor)
        if bedrooms is not None:
            query = query.where(Property.bedrooms >= bedrooms)
        if property_type:
            query = query.where(Property.property_type.ilike(f"%{property_type}%"))
        if location:
            # Treat the requested location literally, not as SQL LIKE syntax.
            escaped_location = (
                location.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
            )
            pattern = f"%{escaped_location}%"
            query = query.where(
                or_(
                    Property.area.ilike(pattern, escape="\\"),
                    Property.town.ilike(pattern, escape="\\"),
                    Property.county.ilike(pattern, escape="\\"),
                )
            )

        properties = db.scalars(
            query.order_by(Property.is_featured.desc(), Property.created_at.desc()).limit(4)
        ).unique().all()
        if properties:
            return {
                "reply": f"I found {len(properties)} available home(s) that match. Open a listing to review its details and message the landlord.",
                "properties": [
                    {
                        "id": item.id,
                        "title": item.title,
                        "property_type": item.property_type,
                        "monthly_rent": item.monthly_rent,
                        "bedrooms": item.bedrooms,
                        "area": item.area,
                        "town": item.town,
                        "county": item.county,
                        "is_verified": item.is_verified,
                    }
                    for item in properties
                ],
            }

        return {
            "reply": "I couldn't find an available home matching those details yet. Try a nearby town, a wider rent range, or browse all current listings.",
            "properties": [],
        }

    if any(word in lower for word in ("list", "landlord", "post", "advertise", "upload")):
        reply = "Create a landlord or property-manager account, open your dashboard and choose Add Property. Your listing can go live after the required review."
    elif any(word in lower for word in ("message", "contact", "talk", "reply", "conversation")):
        reply = "Open a property listing and choose Contact Landlord to start a private conversation. Your inbox is under Messages; the owner’s reply appears in the same thread."
    elif any(word in lower for word in ("boost", "promote", "feature", "payment", "mpesa", "m-pesa")):
        reply = "Landlords can choose a paid listing boost from their dashboard. The available package and amount are shown before the M-Pesa payment prompt; a boost activates after payment confirmation."
    elif any(word in lower for word in ("verify", "verified", "trust", "safe", "scam")):
        reply = "A verification badge is shown only after review. Confirm availability, viewing arrangements and payment details with the landlord, and view the home before sending rent or a deposit."
    elif any(word in lower for word in ("account", "register", "sign up", "signup", "login", "password")):
        reply = "You can register as a house hunter, landlord or property manager. Use the same email address to log in and access your dashboard and messages."
    else:
        reply = "I can help find homes by location, rent, bedrooms or type, explain how to contact a landlord, and guide landlords through listing or promoting a property. What would you like to do?"

    return {"reply": reply, "properties": []}
