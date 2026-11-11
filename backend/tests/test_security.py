"""Focused security-token regression tests that do not require a live database."""

import os

# Settings are loaded at import time. These are deliberately local test-only
# values and never point to production infrastructure.
os.environ.setdefault("DATABASE_URL", "sqlite:///./nyumbadirect-ci.db")
os.environ.setdefault("JWT_SECRET_KEY", "nyumbadirect-ci-only-secret-not-for-production")
os.environ.setdefault("APP_ENV", "test")

from app.security import (  # noqa: E402
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_access_token,
)


def test_access_token_can_be_decoded():
    token = create_access_token({"sub": "42"})

    payload = decode_access_token(token)

    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "access"


def test_email_verification_token_is_not_an_access_token():
    token = create_email_verification_token("househunter@example.test")

    assert decode_access_token(token) is None


def test_password_reset_token_is_not_an_access_token():
    token = create_password_reset_token("househunter@example.test")

    assert decode_access_token(token) is None


def test_invalid_token_is_rejected():
    assert decode_access_token("not-a-valid-jwt") is None
