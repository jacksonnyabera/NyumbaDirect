from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_landlord_or_manager
from app.models.property import Property
from app.models.property_photo import PropertyPhoto
from app.models.user import User
from app.schemas.property_photo import (
    PropertyPhotoCreate,
    PropertyPhotoResponse,
)


router = APIRouter(
    prefix="/properties",
    tags=["Property Photos"],
)


@router.post(
    "/{property_id}/photos",
    response_model=PropertyPhotoResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_property_photo(
    property_id: int,
    photo_data: PropertyPhotoCreate,
    current_user: User = Depends(require_landlord_or_manager),
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property).where(Property.id == property_id)
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    if property_obj.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add photos to your own properties.",
        )

    if photo_data.is_primary:
        existing_primary = db.scalars(
            select(PropertyPhoto).where(
                PropertyPhoto.property_id == property_id,
                PropertyPhoto.is_primary.is_(True),
            )
        ).all()

        for photo in existing_primary:
            photo.is_primary = False

    new_photo = PropertyPhoto(
        property_id=property_id,
        **photo_data.model_dump(),
    )

    db.add(new_photo)
    db.commit()
    db.refresh(new_photo)

    return new_photo


@router.get(
    "/{property_id}/photos",
    response_model=list[PropertyPhotoResponse],
)
def list_property_photos(
    property_id: int,
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property).where(Property.id == property_id)
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    photos = db.scalars(
        select(PropertyPhoto)
        .where(PropertyPhoto.property_id == property_id)
        .order_by(PropertyPhoto.display_order.asc())
    ).all()

    return photos


@router.delete(
    "/{property_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_property_photo(
    property_id: int,
    photo_id: int,
    current_user: User = Depends(require_landlord_or_manager),
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property).where(Property.id == property_id)
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    if property_obj.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage photos for your own properties.",
        )

    photo = db.scalar(
        select(PropertyPhoto).where(
            PropertyPhoto.id == photo_id,
            PropertyPhoto.property_id == property_id,
        )
    )

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found.",
        )

    db.delete(photo)
    db.commit()