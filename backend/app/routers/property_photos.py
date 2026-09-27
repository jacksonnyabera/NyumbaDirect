from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.property import Property
from app.models.property_photo import PropertyPhoto
from app.models.user import User
from app.services.cloudinary import (
    delete_property_image,
    upload_property_image,
)

router = APIRouter(
    prefix="/properties",
    tags=["Property Photos"],
)


@router.post(
    "/{property_id}/photos",
    status_code=status.HTTP_201_CREATED,
)
def upload_property_photo(
    property_id: int,
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
    is_primary: bool = Form(default=False),
    display_order: int = Form(default=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    property_obj = db.scalar(
        select(Property).where(Property.id == property_id)
    )

    if not property_obj:
        raise HTTPException(
            status_code=404,
            detail="Property not found.",
        )

    if property_obj.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only upload photos to your own property.",
        )

    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG and WebP images are allowed.",
        )

    max_size = 10 * 1024 * 1024

    file_content = file.file.read()

    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="Image must be 10MB or smaller.",
        )

    file.file.seek(0)

    try:
        upload_result = upload_property_image(file.file)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Image upload failed. Please try again.",
        )

    if is_primary:
        existing_photos = db.scalars(
            select(PropertyPhoto).where(
                PropertyPhoto.property_id == property_id
            )
        ).all()

        for photo in existing_photos:
            photo.is_primary = False

    photo = PropertyPhoto(
        property_id=property_id,
        image_url=upload_result["url"],
        cloudinary_public_id=upload_result["public_id"],
        caption=caption,
        is_primary=is_primary,
        display_order=display_order,
        created_at=datetime.now(timezone.utc),
    )

    db.add(photo)
    db.commit()
    db.refresh(photo)

    return photo


@router.get(
    "/{property_id}/photos",
)
def get_property_photos(
    property_id: int,
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property).where(Property.id == property_id)
    )

    if not property_obj:
        raise HTTPException(
            status_code=404,
            detail="Property not found.",
        )

    photos = db.scalars(
        select(PropertyPhoto)
        .where(
            PropertyPhoto.property_id == property_id
        )
        .order_by(
            PropertyPhoto.is_primary.desc(),
            PropertyPhoto.display_order.asc(),
            PropertyPhoto.created_at.asc(),
        )
    ).all()

    return photos


@router.delete(
    "/{property_id}/photos/{photo_id}",
)
def delete_property_photo(
    property_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo = db.scalar(
        select(PropertyPhoto).where(
            PropertyPhoto.id == photo_id,
            PropertyPhoto.property_id == property_id,
        )
    )

    if not photo:
        raise HTTPException(
            status_code=404,
            detail="Photo not found.",
        )

    property_obj = db.scalar(
        select(Property).where(
            Property.id == property_id
        )
    )

    if not property_obj:
        raise HTTPException(
            status_code=404,
            detail="Property not found.",
        )

    if property_obj.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own property photos.",
        )

    # Remove the actual image from Cloudinary.
    if photo.cloudinary_public_id:
        try:
            delete_property_image(
                photo.cloudinary_public_id
            )
        except Exception:
            raise HTTPException(
                status_code=502,
                detail=(
                    "The image could not be removed from "
                    "image storage. Please try again."
                ),
            )

    db.delete(photo)
    db.commit()

    return {
        "message": "Photo deleted successfully."
    }