from datetime import datetime, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.dependencies import (
    get_current_user,
    get_optional_current_user,
    require_landlord_or_manager,
)
from app.models.favorite import Favorite
from app.models.property import Property
from app.models.property_photo import PropertyPhoto
from app.models.property_view import PropertyView
from app.models.user import User
from app.schemas.property import (
    PropertyCreate,
    PropertyListResponse,
    PropertyResponse,
    PropertyUpdate,
)
from app.schemas.property_view import (
    PropertyEngagementResponse,
    PropertyViewCreate,
    PropertyViewResponse,
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
    "/mine",
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
    boosted: bool | None = Query(default=None),
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
    now = datetime.now(timezone.utc)
    active_boost = (
        Property.is_featured.is_(True)
        & Property.featured_until.is_not(None)
        & (Property.featured_until > now)
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

    if boosted is True:
        query = query.where(active_boost)
    elif boosted is False:
        query = query.where(~active_boost)

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

    featured_order = case(
        (active_boost, 1),
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


@router.get(
    "/mine/engagement",
    response_model=list[PropertyEngagementResponse],
)
def get_my_property_engagement(
    current_user: User = Depends(require_landlord_or_manager),
    db: Session = Depends(get_db),
):
    view_counts = (
        select(
            PropertyView.property_id,
            func.count(PropertyView.id).label("unique_views"),
        )
        .group_by(PropertyView.property_id)
        .subquery()
    )
    save_counts = (
        select(
            Favorite.property_id,
            func.count(Favorite.id).label("saves"),
        )
        .group_by(Favorite.property_id)
        .subquery()
    )
    rows = db.execute(
        select(
            Property.id.label("property_id"),
            func.coalesce(view_counts.c.unique_views, 0).label("unique_views"),
            func.coalesce(save_counts.c.saves, 0).label("saves"),
        )
        .outerjoin(view_counts, view_counts.c.property_id == Property.id)
        .outerjoin(save_counts, save_counts.c.property_id == Property.id)
        .where(Property.owner_id == current_user.id)
        .order_by(Property.created_at.desc())
    ).all()

    return [
        PropertyEngagementResponse(
            property_id=row.property_id,
            unique_views=row.unique_views,
            saves=row.saves,
        )
        for row in rows
    ]


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


@router.post(
    "/{property_id}/view",
    response_model=PropertyViewResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def record_property_view(
    property_id: int,
    data: PropertyViewCreate,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    property_obj = db.get(Property, property_id)
    if not property_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    if not property_obj.is_available or (
        current_user and property_obj.owner_id == current_user.id
    ):
        return PropertyViewResponse(recorded=False)

    identity = (
        f"user:{current_user.id}"
        if current_user
        else f"visitor:{data.visitor_id}"
    )
    viewer_hash = sha256(identity.encode("utf-8")).hexdigest()
    existing = db.scalar(
        select(PropertyView.id).where(
            PropertyView.property_id == property_id,
            PropertyView.viewer_hash == viewer_hash,
        )
    )
    if existing:
        return PropertyViewResponse(recorded=False)

    db.add(
        PropertyView(
            property_id=property_id,
            viewer_hash=viewer_hash,
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return PropertyViewResponse(recorded=False)

    return PropertyViewResponse(recorded=True)


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

    if "bedrooms" in update_data or "property_type" in update_data:
        property_type = str(
            update_data.get("property_type", property_obj.property_type)
        ).casefold()
        bedrooms = update_data.get("bedrooms", property_obj.bedrooms)
        is_studio_or_bedsitter = any(
            kind in property_type
            for kind in ("studio", "bedsitter", "bachelor")
        )
        if bedrooms == 0 and not is_studio_or_bedsitter:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Enter at least one bedroom, or choose Studio/Bedsitter "
                    "for a zero-bedroom home."
                ),
            )

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
