from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.dependencies import (
    get_current_user,
    require_landlord_or_manager,
)
from app.models.property import Property
from app.models.property_photo import PropertyPhoto
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


# ============================================================
# CREATE PROPERTY
# ============================================================

@router.post(
    "",
    response_model=PropertyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_property(
    data: PropertyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_landlord_or_manager),
):
    property_data = data.model_dump()

    # Never allow the client to assign ownership
    property_data.pop("owner_id", None)

    # New properties are not automatically verified
    property_data["is_verified"] = False

    # New properties are not automatically featured
    property_data["is_featured"] = False
    property_data["featured_until"] = None

    property_obj = Property(
        owner_id=current_user.id,
        **property_data,
    )

    db.add(property_obj)
    db.commit()
    db.refresh(property_obj)

    return property_obj


# ============================================================
# LIST PROPERTIES
# ============================================================

@router.get(
    "/my",
    response_model=PropertyListResponse,
)
def list_my_properties(
    skip: int = Query(
        default=0,
        ge=0,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=100,
    ),
    current_user: User = Depends(
        require_landlord_or_manager
    ),
    db: Session = Depends(get_db),
):
    """
    Return only properties owned by the authenticated
    landlord or property manager.
    """

    query = (
        select(Property)
        .options(
            joinedload(Property.owner),
            selectinload(Property.photos),
        )
        .where(
            Property.owner_id == current_user.id
        )
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
    "",
    response_model=PropertyListResponse,
)
def list_properties(
    search: str | None = Query(default=None, max_length=120),
    county: str | None = None,
    town: str | None = None,
    area: str | None = None,
    property_type: str | None = None,
    min_rent: float | None = Query(default=None, ge=0),
    max_rent: float | None = Query(default=None, ge=0),
    min_bedrooms: int | None = Query(default=None, ge=0),
    max_bedrooms: int | None = Query(default=None, ge=0),
    verified_only: bool = False,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = (
        select(Property)
        .options(
            joinedload(Property.owner),
            selectinload(Property.photos),
        )
        .where(Property.is_available.is_(True))
    )

    # --------------------------------------------------------
    # FILTERS
    # --------------------------------------------------------

    if search and search.strip():
        for token in search.strip().split()[:8]:
            term = f"%{token}%"
            query = query.where(
                or_(
                    Property.title.ilike(term),
                    Property.description.ilike(term),
                    Property.county.ilike(term),
                    Property.town.ilike(term),
                    Property.area.ilike(term),
                    Property.property_type.ilike(term),
                )
            )

    if county:
        query = query.where(Property.county.ilike(f"%{county}%"))

    if town:
        query = query.where(Property.town.ilike(f"%{town}%"))

    if area:
        query = query.where(Property.area.ilike(f"%{area}%"))

    if property_type:
        query = query.where(
            Property.property_type.ilike(f"%{property_type}%")
        )

    if min_rent is not None:
        query = query.where(Property.monthly_rent >= min_rent)

    if max_rent is not None:
        query = query.where(Property.monthly_rent <= max_rent)

    if min_bedrooms is not None:
        query = query.where(Property.bedrooms >= min_bedrooms)

    if max_bedrooms is not None:
        query = query.where(Property.bedrooms <= max_bedrooms)

    if verified_only:
        query = query.where(Property.is_verified.is_(True))

    # --------------------------------------------------------
    # TOTAL COUNT
    # --------------------------------------------------------

    count_query = select(func.count()).select_from(
        query.order_by(None).subquery()
    )

    total = db.scalar(count_query) or 0

    # --------------------------------------------------------
    # FEATURED PROPERTY PRIORITY
    #
    # A property is considered actively featured only when:
    # - is_featured = True
    # - featured_until exists
    # - featured_until is still in the future
    # --------------------------------------------------------

    now = datetime.now(timezone.utc)

    featured_order = case(
        (
            (Property.is_featured.is_(True))
            & (Property.featured_until.is_not(None))
            & (Property.featured_until > now),
            1,
        ),
        else_=0,
    )

    # --------------------------------------------------------
    # GET PROPERTIES
    # --------------------------------------------------------

    properties = db.scalars(
        query
        .order_by(
            featured_order.desc(),
            Property.created_at.desc(),
        )
        .offset(skip)
        .limit(limit)
    ).unique().all()

    return PropertyListResponse(
        items=properties,
        total=total,
        skip=skip,
        limit=limit,
    )


# ============================================================
# GET SINGLE PROPERTY
# ============================================================

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
            status_code=404,
            detail="Property not found.",
        )

    return property_obj


# ============================================================
# UPDATE PROPERTY
# ============================================================

@router.put(
    "/{property_id}",
    response_model=PropertyResponse,
)
def update_property(
    property_id: int,
    data: PropertyUpdate,
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
            detail="You can only update your own property.",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Prevent users from changing protected fields
    update_data.pop("owner_id", None)
    update_data.pop("is_verified", None)
    update_data.pop("is_featured", None)
    update_data.pop("featured_until", None)

    for field, value in update_data.items():
        setattr(property_obj, field, value)

    db.commit()
    db.refresh(property_obj)

    return property_obj


# ============================================================
# DELETE PROPERTY
# ============================================================

@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_property(
    property_id: int,
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
            detail="You can only delete your own property.",
        )

    db.delete(property_obj)
    db.commit()

    return None
