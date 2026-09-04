from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.dependencies import require_landlord_or_manager
from app.models.property import Property
from app.models.user import User
from app.schemas.property import (
    PropertyCreate,
    PropertyListResponse,
    PropertyResponse,
    PropertyUpdate,
)


router = APIRouter(
    prefix="/properties",
    tags=["Properties"],
)


@router.post(
    "",
    response_model=PropertyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_property(
    property_data: PropertyCreate,
    current_user: User = Depends(require_landlord_or_manager),
    db: Session = Depends(get_db),
):
    property_values = property_data.model_dump()

    # Ownership must always come from the authenticated user.
    property_values.pop("owner_id", None)

    # Verification must never be self-assigned during creation.
    property_values.pop("is_verified", None)

    property_values["is_verified"] = False

    new_property = Property(
        owner_id=current_user.id,
        **property_values,
    )

    db.add(new_property)
    db.commit()
    db.refresh(new_property)

    return new_property


@router.get(
    "",
    response_model=PropertyListResponse,
)
def list_properties(
    county: str | None = None,
    town: str | None = None,
    area: str | None = None,
    property_type: str | None = None,
    min_rent: Decimal | None = None,
    max_rent: Decimal | None = None,
    min_bedrooms: int | None = Query(
        default=None,
        ge=0,
    ),
    max_bedrooms: int | None = Query(
        default=None,
        ge=0,
    ),
    verified_only: bool = False,
    skip: int = Query(
        default=0,
        ge=0,
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
):
    if (
        min_rent is not None
        and min_rent < 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum rent cannot be negative.",
        )

    if (
        max_rent is not None
        and max_rent < 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum rent cannot be negative.",
        )

    if (
        min_rent is not None
        and max_rent is not None
        and min_rent > max_rent
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum rent cannot be greater than maximum rent.",
        )

    if (
        min_bedrooms is not None
        and max_bedrooms is not None
        and min_bedrooms > max_bedrooms
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum bedrooms cannot be greater than maximum bedrooms.",
        )

    query = (
        select(Property)
        .options(
            joinedload(Property.owner),
            selectinload(Property.photos),
        )
        .where(Property.is_available.is_(True))
    )

    if county:
        county = county.strip()

        if county:
            query = query.where(
                Property.county.ilike(
                    f"%{county}%"
                )
            )

    if town:
        town = town.strip()

        if town:
            query = query.where(
                Property.town.ilike(
                    f"%{town}%"
                )
            )

    if area:
        area = area.strip()

        if area:
            query = query.where(
                Property.area.ilike(
                    f"%{area}%"
                )
            )

    if property_type:
        property_type = property_type.strip()

        if property_type:
            query = query.where(
                Property.property_type
                == property_type
            )

    if min_rent is not None:
        query = query.where(
            Property.monthly_rent >= min_rent
        )

    if max_rent is not None:
        query = query.where(
            Property.monthly_rent <= max_rent
        )

    if min_bedrooms is not None:
        query = query.where(
            Property.bedrooms >= min_bedrooms
        )

    if max_bedrooms is not None:
        query = query.where(
            Property.bedrooms <= max_bedrooms
        )

    if verified_only:
        query = query.join(
            User,
            Property.owner_id == User.id,
        ).where(
            User.is_verified.is_(True)
        )

    total = db.scalar(
        select(func.count())
        .select_from(query.subquery())
    )

    properties = db.scalars(
        query
        .order_by(Property.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).unique().all()

    return PropertyListResponse(
        items=properties,
        total=total or 0,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{property_id}",
    response_model=PropertyResponse,
)
def get_property(
    property_id: int,
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property)
        .options(
            joinedload(Property.owner),
            selectinload(Property.photos),
        )
        .where(Property.id == property_id)
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    return property_obj


@router.put(
    "/{property_id}",
    response_model=PropertyResponse,
)
def update_property(
    property_id: int,
    property_data: PropertyUpdate,
    current_user: User = Depends(
        require_landlord_or_manager
    ),
    db: Session = Depends(get_db),
):
    property_obj = db.scalar(
        select(Property)
        .options(joinedload(Property.owner))
        .where(Property.id == property_id)
    )

    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    if property_obj.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own properties.",
        )

    update_data = property_data.model_dump(
        exclude_unset=True,
    )

    # Protected fields cannot be changed through
    # the normal property update endpoint.
    update_data.pop("owner_id", None)
    update_data.pop("is_verified", None)

    for field, value in update_data.items():
        setattr(
            property_obj,
            field,
            value,
        )

    db.commit()
    db.refresh(property_obj)

    return property_obj


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_property(
    property_id: int,
    current_user: User = Depends(
        require_landlord_or_manager
    ),
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

    if property_obj.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own properties.",
        )

    db.delete(property_obj)
    db.commit()

    return None