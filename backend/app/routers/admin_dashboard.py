from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.models.favorite import Favorite
from app.models.landlord_verification import LandlordVerification
from app.models.property import Property
from app.models.property_promotion import PropertyPromotion
from app.models.review import Review
from app.models.user import User


router = APIRouter(
    prefix="/admin",
    tags=["Admin Dashboard"],
)


def _count(db: Session, statement) -> int:
    return int(db.scalar(statement) or 0)


def _promotion_rows(db: Session, query, skip: int, limit: int):
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    rows = db.execute(
        query.order_by(PropertyPromotion.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    items = []
    for promotion, property_title, user_name, user_email in rows:
        phone = promotion.phone_number or ""
        items.append(
            {
                "id": promotion.id,
                "property_id": promotion.property_id,
                "property_title": property_title,
                "user_id": promotion.user_id,
                "user_name": user_name,
                "user_email": user_email,
                "package": promotion.package,
                "amount": promotion.amount,
                "payment_status": promotion.payment_status,
                "phone_number": f"••••{phone[-3:]}" if phone else None,
                "result_code": promotion.result_code,
                "result_description": promotion.result_description,
                "created_at": promotion.created_at,
                "starts_at": promotion.starts_at,
                "expires_at": promotion.expires_at,
            }
        )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/overview")
def get_overview(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    paid_revenue = db.scalar(
        select(func.coalesce(func.sum(PropertyPromotion.amount), 0)).where(
            PropertyPromotion.payment_status == "PAID"
        )
    )
    return {
        "users_total": _count(db, select(func.count(User.id))),
        "users_active": _count(db, select(func.count(User.id)).where(User.is_active.is_(True))),
        "landlords": _count(
            db,
            select(func.count(User.id)).where(
                User.role.in_(["LANDLORD", "PROPERTY_MANAGER"])
            ),
        ),
        "house_hunters": _count(
            db, select(func.count(User.id)).where(User.role == "HOUSE_HUNTER")
        ),
        "properties_total": _count(db, select(func.count(Property.id))),
        "properties_available": _count(
            db,
            select(func.count(Property.id)).where(Property.is_available.is_(True)),
        ),
        "account_verifications_pending": _count(
            db,
            select(func.count(User.id)).where(User.verification_status == "PENDING"),
        ),
        "landlord_verifications_pending": _count(
            db,
            select(func.count(LandlordVerification.id)).where(
                LandlordVerification.status == "PENDING"
            ),
        ),
        "promotions_pending": _count(
            db,
            select(func.count(PropertyPromotion.id)).where(
                PropertyPromotion.payment_status == "PENDING"
            ),
        ),
        "promotions_paid": _count(
            db,
            select(func.count(PropertyPromotion.id)).where(
                PropertyPromotion.payment_status == "PAID"
            ),
        ),
        "paid_revenue": paid_revenue or Decimal("0"),
        "favorites_total": _count(db, select(func.count(Favorite.id))),
        "reviews_total": _count(db, select(func.count(Review.id))),
    }


@router.get("/users")
def get_users(
    q: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None, max_length=30),
    active: bool | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(User)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                User.full_name.ilike(term),
                User.email.ilike(term),
                User.phone_number.ilike(term),
            )
        )
    if role:
        query = query.where(User.role == role.upper())
    if active is not None:
        query = query.where(User.is_active.is_(active))

    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    users = db.scalars(
        query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    ).all()
    return {
        "items": [
            {
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "phone_number": user.phone_number,
                "role": user.role,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "verification_status": user.verification_status,
                "created_at": user.created_at,
            }
            for user in users
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/properties")
def get_properties(
    q: str | None = Query(default=None, max_length=120),
    available: bool | None = None,
    verified: bool | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(Property, User.full_name, User.email).join(
        User, User.id == Property.owner_id
    )
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                Property.title.ilike(term),
                Property.area.ilike(term),
                Property.town.ilike(term),
                Property.county.ilike(term),
                User.full_name.ilike(term),
            )
        )
    if available is not None:
        query = query.where(Property.is_available.is_(available))
    if verified is not None:
        query = query.where(Property.is_verified.is_(verified))

    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    rows = db.execute(
        query.order_by(Property.created_at.desc()).offset(skip).limit(limit)
    ).all()
    return {
        "items": [
            {
                "id": prop.id,
                "title": prop.title,
                "property_type": prop.property_type,
                "town": prop.town,
                "county": prop.county,
                "monthly_rent": prop.monthly_rent,
                "is_available": prop.is_available,
                "is_verified": prop.is_verified,
                "is_featured": prop.is_featured,
                "featured_until": prop.featured_until,
                "created_at": prop.created_at,
                "owner_name": owner_name,
                "owner_email": owner_email,
            }
            for prop, owner_name, owner_email in rows
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


def _get_promotions(
    db: Session,
    q: str | None,
    payment_status: str | None,
    skip: int,
    limit: int,
):
    query = (
        select(PropertyPromotion, Property.title, User.full_name, User.email)
        .join(Property, Property.id == PropertyPromotion.property_id)
        .join(User, User.id == PropertyPromotion.user_id)
    )
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(Property.title.ilike(term), User.full_name.ilike(term), User.email.ilike(term))
        )
    if payment_status:
        query = query.where(PropertyPromotion.payment_status == payment_status.upper())
    return _promotion_rows(db, query, skip, limit)


@router.get("/promotions")
def get_promotions(
    q: str | None = Query(default=None, max_length=120),
    payment_status: str | None = Query(default=None, max_length=30),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _get_promotions(db, q, payment_status, skip, limit)


@router.get("/payments")
def get_payments(
    q: str | None = Query(default=None, max_length=120),
    payment_status: str | None = Query(default=None, max_length=30),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _get_promotions(db, q, payment_status, skip, limit)


@router.get("/reports")
def get_reports(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users_by_role = db.execute(
        select(User.role, func.count(User.id)).group_by(User.role).order_by(User.role)
    ).all()
    properties_by_type = db.execute(
        select(Property.property_type, func.count(Property.id))
        .group_by(Property.property_type)
        .order_by(Property.property_type)
    ).all()
    promotions_by_status = db.execute(
        select(PropertyPromotion.payment_status, func.count(PropertyPromotion.id))
        .group_by(PropertyPromotion.payment_status)
        .order_by(PropertyPromotion.payment_status)
    ).all()
    top_saved = db.execute(
        select(
            Property.id,
            Property.title,
            Property.town,
            func.count(Favorite.id).label("saves"),
        )
        .join(Favorite, Favorite.property_id == Property.id)
        .group_by(Property.id, Property.title, Property.town)
        .order_by(func.count(Favorite.id).desc(), Property.id)
        .limit(10)
    ).all()
    return {
        "users_by_role": [
            {"role": role, "count": count} for role, count in users_by_role
        ],
        "properties_by_type": [
            {"property_type": property_type, "count": count}
            for property_type, count in properties_by_type
        ],
        "promotions_by_status": [
            {"status": status, "count": count} for status, count in promotions_by_status
        ],
        "most_saved_properties": [
            {"id": prop_id, "title": title, "town": town, "saves": saves}
            for prop_id, title, town, saves in top_saved
        ],
    }


@router.get("/settings")
def get_safe_settings(
    current_admin: User = Depends(require_admin),
):
    production = settings.app_env.casefold() in {"production", "prod"}
    return {
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "debug_enabled": settings.debug and not production,
        "trusted_hosts": settings.allowed_hostnames,
        "services": {
            "database_configured": bool(settings.database_url),
            "email_configured": bool(settings.smtp_host and settings.smtp_user and settings.smtp_password),
            "sms_configured": bool(settings.sms_provider and settings.sms_api_key),
            "payments_configured": bool(
                settings.mpesa_consumer_key
                and settings.mpesa_consumer_secret
                and settings.mpesa_callback_secret
            ),
            "image_storage_configured": bool(
                settings.cloudinary_cloud_name
                and settings.cloudinary_api_key
                and settings.cloudinary_api_secret
            ),
        },
    }


@router.get("/verifications/landlords")
def get_landlord_verifications(
    verification_status: str | None = Query(default=None, max_length=30),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(LandlordVerification, User.full_name, User.email).join(
        User, User.id == LandlordVerification.user_id
    )
    if verification_status:
        query = query.where(LandlordVerification.status == verification_status.upper())
    total = int(db.scalar(select(func.count()).select_from(query.subquery())) or 0)
    rows = db.execute(
        query.order_by(LandlordVerification.submitted_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return {
        "items": [
            {
                "id": verification.id,
                "user_id": verification.user_id,
                "full_name": full_name,
                "email": email,
                "phone_number": verification.phone_number,
                "status": verification.status,
                "rejection_reason": verification.rejection_reason,
                "submitted_at": verification.submitted_at,
                "reviewed_at": verification.reviewed_at,
            }
            for verification, full_name, email in rows
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }