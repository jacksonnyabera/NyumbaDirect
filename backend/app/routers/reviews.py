from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.property import Property
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewResponse


router = APIRouter(
    prefix="/reviews",
    tags=["Reviews"],
)


@router.post(
    "/{property_id}",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    property_id: int,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property).where(
            Property.id == property_id
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
            detail="You cannot review your own property.",
        )

    existing = db.scalar(
        select(Review).where(
            Review.user_id == current_user.id,
            Review.property_id == property_id,
        )
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this property.",
        )

    review = Review(
        user_id=current_user.id,
        property_id=property_id,
        rating=review_data.rating,
        comment=review_data.comment,
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    return review


@router.get(
    "/{property_id}",
    response_model=list[ReviewResponse],
)
def list_property_reviews(
    property_id: int,
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property).where(
            Property.id == property_id
        )
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    return db.scalars(
        select(Review)
        .where(
            Review.property_id == property_id
        )
        .order_by(Review.created_at.desc())
    ).all()


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.scalar(
        select(Review).where(
            Review.id == review_id
        )
    )

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found.",
        )

    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own review.",
        )

    db.delete(review)
    db.commit()