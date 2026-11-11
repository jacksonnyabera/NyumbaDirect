"""Shared fixtures. Uses a throwaway SQLite database and never touches real
infrastructure, credentials, customers or payments."""

import os
import tempfile

_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="nyumba-tests-"), "test.db")

# Settings load at import time; set test-only values first.
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE}"
os.environ["JWT_SECRET_KEY"] = "nyumbadirect-ci-only-secret-not-for-production"
os.environ["REDIS_URL"] = ""
os.environ["MPESA_CALLBACK_SECRET"] = "test-callback-secret"
os.environ["MPESA_VERIFY_CALLBACKS"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import rate_limit  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app import models as _models  # noqa: E402,F401  (registers all tables)
from app.services.notifications import NotificationService  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    rate_limit.reset_for_tests()
    yield


@pytest.fixture(autouse=True)
def sent_emails(monkeypatch):
    """Capture outgoing email instead of sending it."""
    outbox: list[dict] = []

    def fake_send_email(to_email, subject, message):
        outbox.append({"to": to_email, "subject": subject, "body": message})
        return True

    monkeypatch.setattr(NotificationService, "send_email", staticmethod(fake_send_email))
    monkeypatch.setattr(
        NotificationService,
        "send_verification_code_email",
        staticmethod(lambda to, name, code: outbox.append({"to": to, "code": code}) or True),
    )
    monkeypatch.setattr(
        NotificationService,
        "send_password_reset_email",
        staticmethod(
            lambda to_email, name, token: outbox.append(
                {"to": to_email, "reset_token": token}
            )
            or True
        ),
    )
    return outbox


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def rate_limits_off(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", False)


def make_user(db, email="user@example.com", role="HOUSE_HUNTER", password="CorrectHorse1!",
              phone="+254712000001", verified=True, active=True):
    from app.models.user import User
    from app.security import hash_password

    user = User(
        full_name="Test User",
        email=email,
        phone_number=phone,
        password_hash=hash_password(password),
        role=role,
        is_active=active,
        is_verified=verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(client, email="user@example.com", password="CorrectHorse1!"):
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}
