from datetime import datetime, timezone
import os

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.property import Property
from app.models.user import User
from app.services.ai_assistant import AIAssistantService
from app.services.notifications import NotificationService


router = APIRouter(
    prefix="/messages",
    tags=["Messages"],
)


class ConversationCreate(BaseModel):
    property_id: int


class MessageCreate(BaseModel):
    content: str


def _role_name(user: User | None) -> str:
    if not user:
        return "USER"

    value = str(getattr(user, "role", "USER"))
    return value.split(".")[-1].upper()


def _user_payload(user: User | None) -> dict | None:
    if not user:
        return None

    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "phone_number": user.phone_number,
        "role": _role_name(user),
    }


def _property_payload(property_obj: Property | None) -> dict | None:
    if not property_obj:
        return None

    return {
        "id": property_obj.id,
        "title": property_obj.title,
        "area": getattr(property_obj, "area", None),
        "town": getattr(property_obj, "town", None),
        "county": getattr(property_obj, "county", None),
        "property_type": getattr(property_obj, "property_type", None),
        "bedrooms": getattr(property_obj, "bedrooms", None),
        "bathrooms": getattr(property_obj, "bathrooms", None),
        "monthly_rent": getattr(property_obj, "monthly_rent", None),
        "deposit": getattr(property_obj, "deposit", None),
        "description": getattr(property_obj, "description", None),
    }


def _conversation_payload(conversation: Conversation) -> dict:
    landlord = conversation.landlord
    house_hunter = conversation.house_hunter
    property_obj = conversation.property

    contact_user = landlord

    return {
        "id": conversation.id,
        "property_id": conversation.property_id,
        "house_hunter_id": conversation.house_hunter_id,
        "landlord_id": conversation.landlord_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "property": _property_payload(property_obj),
        "house_hunter": _user_payload(house_hunter),
        "landlord": _user_payload(landlord),
        "contact": {
            "name": contact_user.full_name if contact_user else "Property owner",
            "role": (
                "Property Manager"
                if _role_name(contact_user) == "PROPERTY_MANAGER"
                else "Landlord"
            ),
            "phone_number": contact_user.phone_number if contact_user else None,
        },
    }
        )
    except Exception as exc:
        print(f"AI landlord reply unavailable: {exc}")
        return None

    if not ai_reply:
        return None

    property_name = property_obj.title if property_obj else "this property"
    location_parts = []

    if property_obj:
        for value in (
            getattr(property_obj, "area", None),
            getattr(property_obj, "town", None),
            getattr(property_obj, "county", None),
        ):
            if value:
                location_parts.append(str(value))

    location = ", ".join(location_parts)

    context = f" regarding {property_name}"
    if location:
        context += f" in {location}"

    call_role = "the property manager" if _role_name(landlord) == "PROPERTY_MANAGER" else "the landlord"

    return (
        "🤖 NyumbaDirect AI: "
        f"{ai_reply}"
        f"\n\nI'm an AI assistant helping with this listing{context}; I'm not the {call_role}. "
        f"For current availability, viewing arrangements, exact details, or final confirmation, "
        f"please call {call_role} using the Call {('Property Manager' if _role_name(landlord) == 'PROPERTY_MANAGER' else 'Landlord')} button."
    )


def _ai_message_payload(
    source_message: Message,
    content: str,
) -> dict:
    return {
        "id": f"ai-{source_message.id}",
        "conversation_id": source_message.conversation_id,
        "sender_id": None,
        "sender_name": "NyumbaDirect AI",
        "sender_role": "AI",
        "is_ai": True,
        "content": content,
        "is_read": True,
        "created_at": source_message.created_at,
    }


def _message_payload(message: Message) -> dict:
    sender = getattr(message, "sender", None)

    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "sender_name": sender.full_name if sender else "NyumbaDirect User",
        "sender_role": _role_name(sender),
        "is_ai": False,
        "content": message.content,
        "is_read": message.is_read,
        "created_at": message.created_at,
    }
            joinedload(Conversation.property),
            joinedload(Conversation.landlord),
            joinedload(Conversation.house_hunter),
        )
        .where(Conversation.id == conversation_id)
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    if current_user.id not in {
        conversation.house_hunter_id,
        conversation.landlord_id,
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation.",
        )

    content = data.content.strip()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        content=content,
        is_read=False,
    )

    db.add(message)
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)

    property_obj = conversation.property
    landlord = conversation.landlord

    if (
        current_user.id == conversation.house_hunter_id
        and landlord
        and landlord.email
        and property_obj
    ):
        NotificationService.send_property_inquiry_email(
            to_email=landlord.email,
            house_hunter_name=current_user.full_name,
            property_title=property_obj.title,
        )

    response_messages = [_message_payload(message)]

    # A landlord/property-manager can reply normally. The AI is only a fallback
    # for house-hunter messages and is never presented as the human owner.
    if current_user.id == conversation.house_hunter_id:
        ai_reply = _build_ai_reply(content, property_obj, landlord)

        if ai_reply:
            response_messages.append(_ai_message_payload(message, ai_reply))

    return {
        "message": response_messages[0],
        "ai_reply": response_messages[1] if len(response_messages) > 1 else None,
        "contact": {
            "name": landlord.full_name if landlord else "Property owner",
            "role": (
                "Property Manager"
                if _role_name(landlord) == "PROPERTY_MANAGER"
                else "Landlord"
            ),
            "phone_number": landlord.phone_number if landlord else None,
        },
    }

    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    if current_user.id not in {
        conversation.house_hunter_id,
        conversation.landlord_id,
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation.",
        )

    messages = db.scalars(
        select(Message)
        .options(joinedload(Message.sender))
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    ).unique().all()

    payload = [_message_payload(message) for message in messages]

    # If the latest human message came from the house hunter and no landlord
    # reply has followed it, provide the available AI fallback in the chat.
    if messages and messages[-1].sender_id == conversation.house_hunter_id:
        ai_reply = _build_ai_reply(
            messages[-1].content,
            conversation.property,
            conversation.landlord,
        )

        if ai_reply:
            payload.append(_ai_message_payload(messages[-1], ai_reply))

    landlord = conversation.landlord
    contact_role = (
        "Property Manager"
        if _role_name(landlord) == "PROPERTY_MANAGER"
        else "Landlord"
    )

    return {
        "conversation": _conversation_payload(conversation),
        "messages": payload,
        "contact": {
            "name": landlord.full_name if landlord else "Property owner",
            "role": contact_role,
            "phone_number": landlord.phone_number if landlord else None,
        },
        "ai_available": _ai_enabled(),
    }


@router.patch(
    "/conversations/{conversation_id}/messages/read"
)
def mark_messages_as_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.scalar(
        select(Conversation).where(Conversation.id == conversation_id)
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    if current_user.id not in {
        conversation.house_hunter_id,
        conversation.landlord_id,
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation.",
        )

    unread_messages = db.scalars(
        select(Message).where(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.is_read.is_(False),
        )
    ).all()

    for message in unread_messages:
        message.is_read = True

    db.commit()

    return {
        "message": "Messages marked as read.",
        "updated": len(unread_messages),
    }

