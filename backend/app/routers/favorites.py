from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.favorite import Favorite
from app.models.property import Property
from app.models.user import User
from app.schemas.favorite import FavoriteResponse


router = APIRouter(
    prefix="/favorites",
    tags=["Favorites"],
)


@router.post(
    "/{property_id}",
    response_model=FavoriteResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_favorite(
    property_id: int,
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

    existing = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.property_id == property_id,
        )
    )

    if existing:
        return existing

    favorite = Favorite(
        user_id=current_user.id,
        property_id=property_id,
    )

    db.add(favorite)
    db.commit()
    db.refresh(favorite)

    return favorite


@router.get(
    "",
    response_model=list[FavoriteResponse],
)
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Favorite)
        .where(
            Favorite.user_id == current_user.id
        )
        .order_by(Favorite.created_at.desc())
    ).all()


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_favorite(
    property_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favorite = db.scalar(
        select(Favorite).where(
            Favorite.user_id == current_user.id,
            Favorite.property_id == property_id,
        )
    )

    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Favorite not found.",
        )

    db.delete(favorite)
    db.commit()