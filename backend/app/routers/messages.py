from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from pydantic import BaseModel
from sqlalchemy import func, select, update
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


def _serialize_message(message: Message) -> dict:
    """Keep AI replies distinguishable without adding a DB migration."""
    marker = "🤖 NyumbaDirect AI\n\n"
    is_ai = message.content.startswith(marker)
    content = message.content[len(marker):] if is_ai else message.content
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "content": content,
        "is_read": message.is_read,
        "is_ai": is_ai,
        "created_at": message.created_at,
        "sender": _serialize_user(message.sender),
        "sender_name": message.sender.full_name if message.sender else None,
    }


def _serialize_user(user: User | None) -> dict | None:
    if user is None:
        return None
    # Never serialize ORM users directly: that would also expose password_hash.
    return {
        "id": user.id,
        "full_name": user.full_name,
        "role": user.role,
        "phone_number": user.phone_number,
        "is_verified": user.is_verified,
    }


def _serialize_property(property_obj: Property | None) -> dict | None:
    if property_obj is None:
        return None
    return {
        "id": property_obj.id,
        "title": property_obj.title,
        "property_type": property_obj.property_type,
        "bedrooms": property_obj.bedrooms,
        "bathrooms": property_obj.bathrooms,
        "monthly_rent": property_obj.monthly_rent,
        "area": property_obj.area,
        "town": property_obj.town,
        "county": property_obj.county,
        "is_available": property_obj.is_available,
        "is_verified": property_obj.is_verified,
    }


def _serialize_conversation(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "property_id": conversation.property_id,
        "house_hunter_id": conversation.house_hunter_id,
        "landlord_id": conversation.landlord_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "property": _serialize_property(conversation.property),
        "house_hunter": _serialize_user(conversation.house_hunter),
        "landlord": _serialize_user(conversation.landlord),
    }


@router.post(
    "/conversations",
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    data: ConversationCreate,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    A house hunter starts a conversation about a specific property.

    The landlord/property manager is taken from the property's owner.
    """

    # On databases that support row locks (including PostgreSQL), serialize
    # creation attempts for this property. This closes the race between the
    # duplicate lookup and insert without changing the existing schema.
    property_obj = db.scalar(
        select(Property)
        .where(Property.id == data.property_id)
        .with_for_update()
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
        response.status_code = status.HTTP_200_OK
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
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    participant_filter = (
        (Conversation.house_hunter_id == current_user.id)
        | (Conversation.landlord_id == current_user.id)
    )
    total = db.scalar(
        select(func.count(Conversation.id)).where(participant_filter)
    ) or 0

    unread_count = (
        select(func.count(Message.id))
        .where(
            Message.conversation_id == Conversation.id,
            Message.sender_id != current_user.id,
            Message.is_read.is_(False),
        )
        .correlate(Conversation)
        .scalar_subquery()
    )
    rows = db.execute(
        select(Conversation, unread_count.label("unread_count"))
        .options(
            joinedload(Conversation.property),
            joinedload(Conversation.house_hunter),
            joinedload(Conversation.landlord),
        )
        .where(
            participant_filter
        )
        .order_by(
            Conversation.updated_at.desc()
        )
        .offset(skip)
        .limit(limit)
    ).unique().all()
    return {
        "items": [
            {
                **_serialize_conversation(conversation),
                "unread_count": unread,
            }
            for conversation, unread in rows
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


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
        **_serialize_conversation(conversation),
        "other_user": _serialize_user(other_user),
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
    background_tasks: BackgroundTasks,
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

    conversation.updated_at = datetime.now(timezone.utc)

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

    # ---------------------------------------------------------
    # AI ASSISTANCE
    # ---------------------------------------------------------
    #
    # Only house-hunter messages can trigger the AI.
    # The AI must never pretend to be the landlord.
    #

    ai_message = None

    if current_user.id == conversation.house_hunter_id:

        ai_reply = AIAssistantService.answer_property_question(
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

    # Save the inquiry and its optional AI guidance in one transaction.
    db.commit()
    db.refresh(message)
    if ai_message:
        db.refresh(ai_message)

    notification_user = (
        landlord
        if current_user.id == conversation.house_hunter_id
        else db.scalar(select(User).where(User.id == conversation.house_hunter_id))
    )
    if notification_user and notification_user.email and property_obj:
        if current_user.id == conversation.house_hunter_id:
            background_tasks.add_task(
                NotificationService.send_property_inquiry_email,
                    to_email=notification_user.email,
                    house_hunter_name=current_user.full_name,
                    property_title=property_obj.title,
            )
        else:
            background_tasks.add_task(
                NotificationService.send_conversation_reply_email,
                    to_email=notification_user.email,
                    sender_name=current_user.full_name,
                    property_title=property_obj.title,
            )

    # ---------------------------------------------------------
    # RESPONSE
    # ---------------------------------------------------------

    response = {
        "message": _serialize_message(message),
        "ai_reply": _serialize_message(ai_message) if ai_message else None,
        "contact": {
            "name": (
                landlord.full_name
                if landlord
                else "Landlord / Property Manager"
            ),
                "phone_number": (
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
    after_id: int | None = Query(default=None, ge=0),
    before_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
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

    if after_id is not None and before_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use either after_id or before_id, not both.",
        )

    query = (
        select(Message)
        .options(
            joinedload(Message.sender)
        )
        .where(
            Message.conversation_id == conversation_id
        )
    )
    if after_id is not None:
        query = query.where(Message.id > after_id).order_by(Message.id.asc()).limit(limit)
    else:
        if before_id is not None:
            query = query.where(Message.id < before_id)
        query = query.order_by(Message.id.desc()).limit(limit + 1)

    messages = db.scalars(query).unique().all()
    has_more = after_id is None and len(messages) > limit
    if has_more:
        messages = messages[:limit]
    if after_id is None:
        messages.reverse()

    read_message_ids = []
    if after_id is not None:
        read_message_ids = db.scalars(
            select(Message.id)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id == current_user.id,
                Message.is_read.is_(True),
            )
            .order_by(Message.id.desc())
            .limit(100)
        ).all()

    other_user = _get_other_user(conversation, current_user.id, db)
    return {
        "conversation": _serialize_conversation(conversation),
        "messages": [_serialize_message(message) for message in messages],
        "read_message_ids": read_message_ids,
        "contact": {
            "name": other_user.full_name if other_user else "Property owner",
            "phone_number": other_user.phone_number if other_user else None,
            "role": other_user.role if other_user else "LANDLORD",
        },
        "ai_available": current_user.id == conversation.house_hunter_id,
        "has_more": has_more,
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

    result = db.execute(
        update(Message).where(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.is_read.is_(False),
        ).values(is_read=True)
    )

    db.commit()

    return {
        "message": "Messages marked as read.",
        "updated": result.rowcount or 0,
    }
