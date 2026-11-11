"""Authentication, session revocation and account-recovery behaviour."""

from datetime import timedelta

import pytest
from jose import jwt

from app.config import settings
from app.models.user import User
from app.security import create_access_token, create_password_reset_token
from tests.conftest import auth, login, make_user

pytestmark = pytest.mark.usefixtures("rate_limits_off")

NEW_PASSWORD = "BrandNewPass9!"


def request_reset_token(client, db, sent_emails, email="user@example.com"):
    response = client.post("/auth/forgot-password", json={"email": email})
    assert response.status_code == 200
    tokens = [m["reset_token"] for m in sent_emails if "reset_token" in m]
    return tokens[-1] if tokens else None


def test_login_and_me(client, db):
    make_user(db)
    token = login(client)
    assert client.get("/auth/me", headers=auth(token)).status_code == 200


def test_login_wrong_password_and_unknown_user_look_identical(client, db):
    make_user(db)
    wrong = client.post("/auth/login", json={"email": "user@example.com", "password": "nope-nope-1"})
    unknown = client.post("/auth/login", json={"email": "ghost@example.com", "password": "nope-nope-1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_expired_token_rejected_on_protected_route(client, db):
    user = make_user(db)
    token = create_access_token({"sub": str(user.id), "ver": 0}, expires_delta=timedelta(seconds=-1))
    assert client.get("/auth/me", headers=auth(token)).status_code == 401


def test_garbage_and_wrong_type_tokens_rejected(client, db):
    user = make_user(db)
    assert client.get("/auth/me", headers=auth("garbage")).status_code == 401
    reset = create_password_reset_token(user.email, user.password_hash)
    assert client.get("/auth/me", headers=auth(reset)).status_code == 401


def test_inactive_user_is_blocked_with_valid_token(client, db):
    user = make_user(db)
    token = login(client)
    user.is_active = False
    db.commit()
    assert client.get("/auth/me", headers=auth(token)).status_code == 403


def test_deleted_user_token_rejected(client, db):
    user = make_user(db)
    token = login(client)
    db.delete(user)
    db.commit()
    assert client.get("/auth/me", headers=auth(token)).status_code == 401


def test_legacy_token_without_version_works_until_revoked(client, db):
    user = make_user(db)
    legacy = jwt.encode({"sub": str(user.id)}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    assert client.get("/auth/me", headers=auth(legacy)).status_code == 200
    user.token_version = 1
    db.commit()
    assert client.get("/auth/me", headers=auth(legacy)).status_code == 401


def test_password_reset_revokes_existing_sessions(client, db, sent_emails):
    make_user(db)
    old_session = login(client)
    reset_token = request_reset_token(client, db, sent_emails)

    response = client.post("/auth/reset-password", json={"token": reset_token, "password": NEW_PASSWORD})
    assert response.status_code == 200

    assert client.get("/auth/me", headers=auth(old_session)).status_code == 401
    # New password works and yields a working session.
    new_session = login(client, password=NEW_PASSWORD)
    assert client.get("/auth/me", headers=auth(new_session)).status_code == 200
    assert db.query(User).one().token_version == 1


def test_password_reset_token_cannot_be_replayed(client, db, sent_emails):
    make_user(db)
    reset_token = request_reset_token(client, db, sent_emails)

    first = client.post("/auth/reset-password", json={"token": reset_token, "password": NEW_PASSWORD})
    replay = client.post("/auth/reset-password", json={"token": reset_token, "password": "AttackerPass1!"})

    assert first.status_code == 200
    assert replay.status_code == 400
    # The attacker's password was not applied.
    assert client.post("/auth/login", json={"email": "user@example.com", "password": "AttackerPass1!"}).status_code == 401
    assert client.post("/auth/login", json={"email": "user@example.com", "password": NEW_PASSWORD}).status_code == 200


def test_older_reset_link_dies_when_a_newer_one_is_used(client, db, sent_emails):
    make_user(db)
    first_link = request_reset_token(client, db, sent_emails)
    second_link = request_reset_token(client, db, sent_emails)
    assert client.post("/auth/reset-password", json={"token": second_link, "password": NEW_PASSWORD}).status_code == 200
    assert client.post("/auth/reset-password", json={"token": first_link, "password": "AnotherPass1!"}).status_code == 400


def test_expired_reset_token_rejected(client, db):
    user = make_user(db)
    token = jwt.encode(
        {
            "sub": user.email,
            "type": "password_reset",
            "fp": "x" * 32,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "exp": 1,
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    response = client.post("/auth/reset-password", json={"token": token + "", "password": NEW_PASSWORD})
    assert response.status_code == 400


def test_garbage_reset_token_rejected(client):
    response = client.post("/auth/reset-password", json={"token": "x" * 40, "password": NEW_PASSWORD})
    assert response.status_code == 400


def test_forgot_password_does_not_reveal_whether_account_exists(client, db, sent_emails):
    make_user(db)
    known = client.post("/auth/forgot-password", json={"email": "user@example.com"})
    unknown = client.post("/auth/forgot-password", json={"email": "ghost@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    # Only the real account got an email.
    assert [m["to"] for m in sent_emails] == ["user@example.com"]


def test_registration_does_not_reveal_existing_email_or_phone(client, db, sent_emails):
    make_user(db)
    body = {"full_name": "Someone New", "email": "fresh@example.com",
            "phone_number": "0712999111", "password": "CorrectHorse1!", "role": "HOUSE_HUNTER"}
    fresh = client.post("/auth/register", json=body)

    dup_email = client.post("/auth/register", json={**body, "phone_number": "0712999222",
                                                    "email": "user@example.com"})
    dup_phone = client.post("/auth/register", json={**body, "email": "other@example.com",
                                                    "phone_number": "0712000001"})

    assert fresh.status_code == dup_email.status_code == dup_phone.status_code == 201
    assert fresh.json() == dup_email.json() == dup_phone.json()
    # Existing account owner is warned by email; nothing leaks in the response.
    assert any(m["to"] == "user@example.com" and "subject" in m for m in sent_emails)
    assert db.query(User).count() == 2  # original + the one genuine new user


def test_registered_user_must_verify_with_emailed_code(client, db, sent_emails):
    body = {"full_name": "Someone New", "email": "fresh@example.com",
            "phone_number": "0712999111", "password": "CorrectHorse1!", "role": "HOUSE_HUNTER"}
    assert client.post("/auth/register", json=body).status_code == 201
    code = next(m["code"] for m in sent_emails if "code" in m)
    wrong = client.post("/auth/verify-signup", json={"email": "fresh@example.com", "code": "000000" if code != "000000" else "111111"})
    assert wrong.status_code == 400
    ok = client.post("/auth/verify-signup", json={"email": "fresh@example.com", "code": code})
    assert ok.status_code == 200


def test_cannot_register_as_admin(client):
    body = {"full_name": "Sneaky", "email": "s@example.com", "phone_number": "0712999111",
            "password": "CorrectHorse1!", "role": "ADMIN"}
    assert client.post("/auth/register", json=body).status_code == 400


def test_legacy_verify_email_link_does_not_reveal_accounts(client):
    from app.security import create_email_verification_token

    token = create_email_verification_token("ghost@example.com")
    response = client.get("/auth/verify-email", params={"token": token})
    assert response.status_code == 400
    assert client.get("/auth/verify-email", params={"token": "bad"}).status_code == 400
