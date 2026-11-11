"""Token-level security regression tests (no HTTP, no database)."""

from datetime import timedelta

from jose import jwt

from app.config import settings
from app.security import (
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_access_token,
    decode_password_reset_token,
    reset_token_matches_password,
)


def test_access_token_can_be_decoded():
    token = create_access_token({"sub": "42"})

    payload = decode_access_token(token)

    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "access"
    assert payload["iss"] == settings.jwt_issuer
    assert payload["aud"] == settings.jwt_audience
    assert payload["jti"]


def test_email_verification_token_is_not_an_access_token():
    token = create_email_verification_token("househunter@example.com")

    assert decode_access_token(token) is None


def test_password_reset_token_is_not_an_access_token():
    token = create_password_reset_token("househunter@example.com", "stored-hash")

    assert decode_access_token(token) is None


def test_invalid_token_is_rejected():
    assert decode_access_token("not-a-valid-jwt") is None


def test_expired_access_token_is_rejected():
    token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-5))
    assert decode_access_token(token) is None


def test_token_signed_with_wrong_key_is_rejected():
    forged = jwt.encode({"sub": "1", "type": "access"}, "attacker-key", algorithm="HS256")
    assert decode_access_token(forged) is None


def test_alg_none_token_is_rejected():
    import base64, json

    def b64(data: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    unsigned = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': '1'})}."
    assert decode_access_token(unsigned) is None


def test_wrong_issuer_or_audience_is_rejected():
    for claims in ({"iss": "someone-else", "aud": settings.jwt_audience},
                   {"iss": settings.jwt_issuer, "aud": "another-app"}):
        token = jwt.encode({"sub": "1", "type": "access", **claims},
                           settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        assert decode_access_token(token) is None


def test_legacy_token_without_claims_still_accepted_by_default():
    legacy = jwt.encode({"sub": "1"}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    assert decode_access_token(legacy) is not None


def test_legacy_token_rejected_when_claims_required(monkeypatch):
    monkeypatch.setattr(settings, "jwt_require_claims", True)
    legacy = jwt.encode({"sub": "1"}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    assert decode_access_token(legacy) is None


def test_reset_token_is_bound_to_current_password():
    token = create_password_reset_token("a@example.com", "hash-v1")
    payload = decode_password_reset_token(token)

    assert payload is not None
    assert reset_token_matches_password(payload, "hash-v1")
    assert not reset_token_matches_password(payload, "hash-v2")


def test_old_format_reset_token_without_fingerprint_is_rejected():
    old = jwt.encode({"sub": "a@example.com", "type": "password_reset"},
                     settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    assert decode_password_reset_token(old) is None
