from datetime import datetime, timezone

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


def _is_participant(
    conversation: Conversation,
    user_id: int,
) -> bool:
    return user_id in {
        conversation.house_hunter_id,
        conversation.landlord_id,
    }


def _get_other_user(
    conversation: Conversation,
    current_user_id: int,
    db: Session,
):
    other_user_id = (
        conversation.landlord_id
        if current_user_id == conversation.house_hunter_id
        else conversation.house_hunter_id
    )

    return db.scalar(
        select(User).where(User.id == other_user_id)
    )


def _build_ai_reply(
    content: str,
    property_obj: Property | None,
) -> str | None:
    """
    Uses the existing AI assistant service to classify the
    house hunter's message.

    If the service provides a reply, return it.
    Otherwise return None so the normal landlord conversation
    continues without inventing an AI response.
    """

    try:
        intent = AIAssistantService.classify_intent(content)

        print(
            f"AI intent detected: "
            f"{intent.intent} "
            f"confidence={intent.confidence} "
            f"reply={intent.reply}"
        )

        ai_reply = getattr(intent, "reply", None)

        if not ai_reply:
            return None

        return str(ai_reply).strip()

    except Exception as exc:
        print(f"AI assistant unavailable: {exc}")
        return None


@router.post(
    "/conversations",
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    A house hunter starts a conversation about a specific property.

    The landlord/property manager is taken from the property's owner.
    """

    property_obj = db.scalar(
        select(Property).where(
            Property.id == data.property_id
        )
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    if property_obj.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot start a conversation with yourself.",
        )

    existing_conversation = db.scalar(
        select(Conversation).where(
            Conversation.property_id == data.property_id,
            Conversation.house_hunter_id == current_user.id,
            Conversation.landlord_id == property_obj.owner_id,
        )
    )

    if existing_conversation:
        return existing_conversation

    conversation = Conversation(
        property_id=data.property_id,
        house_hunter_id=current_user.id,
        landlord_id=property_obj.owner_id,
    )

    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    return conversation


@router.get("/conversations")
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = db.scalars(
        select(Conversation)
        .options(
            joinedload(Conversation.property),
            joinedload(Conversation.house_hunter),
            joinedload(Conversation.landlord),
        )
        .where(
            (Conversation.house_hunter_id == current_user.id)
            | (Conversation.landlord_id == current_user.id)
        )
        .order_by(
            Conversation.updated_at.desc()
        )
    ).unique().all()

    return conversations


@router.get(
    "/conversations/{conversation_id}"
)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns conversation details for one of its participants.
    """

    conversation = db.scalar(
        select(Conversation)
        .options(
            joinedload(Conversation.property),
            joinedload(Conversation.house_hunter),
            joinedload(Conversation.landlord),
        )
        .where(
            Conversation.id == conversation_id
        )
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    if not _is_participant(
        conversation,
        current_user.id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation.",
        )

    other_user = _get_other_user(
        conversation,
        current_user.id,
        db,
    )

    return {
        "id": conversation.id,
        "property_id": conversation.property_id,
        "house_hunter_id": conversation.house_hunter_id,
        "landlord_id": conversation.landlord_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "property": conversation.property,
        "house_hunter": conversation.house_hunter,
        "landlord": conversation.landlord,
        "other_user": other_user,
        "contact_phone": (
            other_user.phone_number
            if other_user
            else None
        ),
    }


@router.post(
    "/conversations/{conversation_id}/messages",
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: int,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a message in an existing property conversation.

    House hunter:
        Sends inquiry to landlord/property manager.
        AI may provide an assistance reply.

    Landlord/property manager:
        Replies directly to the house hunter.
    """

    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id
        )
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    if not _is_participant(
        conversation,
        current_user.id,
    ):
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

    if len(content) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot exceed 2000 characters.",
        )

    # ---------------------------------------------------------
    # SAVE HUMAN MESSAGE
    # ---------------------------------------------------------

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        content=content,
        is_read=False,
    )

    db.add(message)

    conversation.updated_at = datetime.now(
        timezone.utc
    )

    db.commit()
    db.refresh(message)

    # ---------------------------------------------------------
    # GET PROPERTY + LANDLORD
    # ---------------------------------------------------------

    property_obj = db.scalar(
        select(Property).where(
            Property.id == conversation.property_id
        )
    )

    landlord = db.scalar(
        select(User).where(
            User.id == conversation.landlord_id
        )
    )

    # ---------------------------------------------------------
    # NOTIFY LANDLORD / PROPERTY MANAGER
    # ---------------------------------------------------------

    if (
        landlord
        and landlord.email
        and property_obj
    ):
        try:
            NotificationService.send_property_inquiry_email(
                to_email=landlord.email,
                house_hunter_name=current_user.full_name,
                property_title=property_obj.title,
            )
        except Exception as exc:
            print(
                f"Notification email failed: {exc}"
            )

    # ---------------------------------------------------------
    # AI ASSISTANCE
    # ---------------------------------------------------------
    #
    # Only house-hunter messages can trigger the AI.
    # The AI must never pretend to be the landlord.
    #

    ai_message = None

    if current_user.id == conversation.house_hunter_id:

        ai_reply = _build_ai_reply(
            content,
            property_obj,
        )

        if ai_reply:

            ai_content = (
                "🤖 NyumbaDirect AI\n\n"
                f"{ai_reply}\n\n"
                "For current availability, viewing "
                "arrangements, exact property details, "
                "rent confirmation, or any final decision, "
                "please contact the landlord/property manager "
                "directly."
            )

            ai_message = Message(
                conversation_id=conversation.id,
                sender_id=current_user.id,
                content=ai_content,
                is_read=True,
            )

            db.add(ai_message)

            conversation.updated_at = datetime.now(
                timezone.utc
            )

            db.commit()
            db.refresh(ai_message)

    # ---------------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------------

    response = {
        "message": message,
        "ai_reply": ai_message,
        "contact": {
            "name": (
                landlord.full_name
                if landlord
                else "Landlord / Property Manager"
            ),
            "phone": (
                landlord.phone_number
                if landlord
                else None
            ),
            "role": (
                landlord.role
                if landlord
                else "LANDLORD"
            ),
        },
    }

    return response


@router.get(
    "/conversations/{conversation_id}/messages"
)
def list_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id
        )
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    if not _is_participant(
        conversation,
        current_user.id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation.",
        )

    messages = db.scalars(
        select(Message)
        .options(
            joinedload(Message.sender)
        )
        .where(
            Message.conversation_id == conversation_id
        )
        .order_by(
            Message.created_at.asc()
        )
    ).unique().all()

    return messages


@router.patch(
    "/conversations/{conversation_id}/messages/read"
)
def mark_messages_as_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id
        )
    )

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    if not _is_participant(
        conversation,
        current_user.id,
    ):
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