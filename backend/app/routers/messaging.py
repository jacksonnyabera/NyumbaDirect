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


router = APIRouter(
    prefix="/messages",
    tags=["Messages"],
)


class ConversationCreate(BaseModel):
    property_id: int


class MessageCreate(BaseModel):
    content: str


@router.post(
    "/conversations",
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    conversation.updated_at = None

    db.commit()
    db.refresh(message)

    return message


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