"""Rate limiting: 429s, headers, spoof resistance, Redis path and fallback."""

import pytest
from starlette.requests import Request

from app import rate_limit
from app.config import settings
from tests.conftest import auth, login, make_user


def fake_request(peer="10.0.0.1", xff=None):
    headers = []
    if xff is not None:
        headers.append((b"x-forwarded-for", xff.encode()))
    return Request({"type": "http", "headers": headers, "client": (peer, 1234),
                    "method": "GET", "path": "/", "query_string": b""})


def test_login_is_limited_per_account_and_returns_429_with_headers(client, db):
    make_user(db)
    statuses = []
    last = None
    for _ in range(10):
        last = client.post("/auth/login", json={"email": "user@example.com", "password": "wrong-pass-1"})
        statuses.append(last.status_code)
    assert statuses[:8] == [401] * 8
    assert 429 in statuses
    assert last.status_code == 429
    assert int(last.headers["Retry-After"]) >= 1
    assert last.headers["X-RateLimit-Limit"] == "8"
    assert last.headers["X-RateLimit-Remaining"] == "0"


def test_successful_responses_carry_rate_limit_headers(client, db):
    make_user(db)
    response = client.post("/auth/login", json={"email": "user@example.com", "password": "CorrectHorse1!"})
    assert response.status_code == 200
    assert response.headers["X-RateLimit-Limit"] == "30"
    assert int(response.headers["X-RateLimit-Remaining"]) == 29


def test_limit_applies_to_unknown_accounts_too(client):
    codes = [client.post("/auth/login", json={"email": "ghost@example.com", "password": "x-x-x-x-x1"}).status_code
             for _ in range(10)]
    assert codes[-1] == 429


def test_one_users_attempts_do_not_block_another(client, db):
    make_user(db)
    make_user(db, email="other@example.com", phone="+254712000002")
    for _ in range(10):
        client.post("/auth/login", json={"email": "user@example.com", "password": "wrong-pass-1"})
    ok = client.post("/auth/login", json={"email": "other@example.com", "password": "CorrectHorse1!"})
    assert ok.status_code == 200


def test_registration_forgot_password_and_resend_are_limited(client):
    body = {"full_name": "A B", "email": "a@example.com", "phone_number": "0712999111",
            "password": "CorrectHorse1!", "role": "HOUSE_HUNTER"}
    assert [client.post("/auth/register", json=body).status_code for _ in range(12)][-1] == 429
    assert [client.post("/auth/forgot-password", json={"email": "x@example.com"}).status_code
            for _ in range(5)][-1] == 429
    assert [client.post("/auth/resend-verification", json={"email": "x@example.com"}).status_code
            for _ in range(5)][-1] == 429


def test_assistant_is_limited(client):
    codes = [client.post("/assistant/chat", json={"question": "2 bedroom"}).status_code for _ in range(25)]
    assert codes[0] == 200
    assert codes[-1] == 429


def test_messaging_and_property_creation_limited_per_user(client, db):
    make_user(db, role="LANDLORD")
    token = login(client)
    payload = {"title": "Nice house", "description": "A" * 30, "property_type": "Apartment",
               "bedrooms": 2, "bathrooms": 1, "monthly_rent": 20000, "county": "Nairobi",
               "town": "Nairobi", "area": "Kilimani"}
    codes = [client.post("/properties", json=payload, headers=auth(token)).status_code for _ in range(22)]
    assert codes[0] == 201
    assert codes[-1] == 429


def test_forged_x_forwarded_for_cannot_pick_the_counted_ip(monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_count", 1)
    # Attacker prepends fake addresses; the trusted proxy appended the real one last.
    request = fake_request(peer="10.9.9.9", xff="1.1.1.1, 2.2.2.2, 203.0.113.7")
    assert rate_limit.get_client_ip(request) == "203.0.113.7"
    other = fake_request(peer="10.9.9.9", xff="8.8.8.8, 203.0.113.7")
    assert rate_limit.get_client_ip(other) == "203.0.113.7"


def test_x_forwarded_for_ignored_when_no_trusted_proxy(monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_count", 0)
    request = fake_request(peer="198.51.100.4", xff="1.2.3.4")
    assert rate_limit.get_client_ip(request) == "198.51.100.4"


def test_malformed_forwarded_header_falls_back_to_peer(monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_count", 1)
    assert rate_limit.get_client_ip(fake_request(peer="198.51.100.4", xff="not-an-ip")) == "198.51.100.4"
    assert rate_limit.get_client_ip(fake_request(peer="198.51.100.4")) == "198.51.100.4"


class FakeRedis:
    """Minimal stand-in used to exercise the Redis backend without a server."""

    def __init__(self):
        self.counts, self.ttls = {}, {}

    def pipeline(self):
        outer = self

        class Pipe:
            def __init__(self):
                self.ops = []

            def incr(self, key):
                self.ops.append(("incr", key))

            def ttl(self, key):
                self.ops.append(("ttl", key))

            def execute(self):
                out = []
                for op, key in self.ops:
                    if op == "incr":
                        outer.counts[key] = outer.counts.get(key, 0) + 1
                        out.append(outer.counts[key])
                    else:
                        out.append(outer.ttls.get(key, -1))
                return out

        return Pipe()

    def expire(self, key, window):
        self.ttls[key] = window


def test_redis_backend_counts_and_sets_window_expiry():
    backend = rate_limit.RedisBackend.__new__(rate_limit.RedisBackend)
    backend._client = FakeRedis()
    first = backend.hit("k", 60)
    second = backend.hit("k", 60)
    assert (first.count, second.count) == (1, 2)
    assert backend._client.ttls["k"] == 60


def test_redis_outage_falls_back_instead_of_failing_requests(monkeypatch, client, db):
    class Broken:
        name = "redis"

        def hit(self, key, window):
            raise ConnectionError("redis down")

    monkeypatch.setattr(settings, "redis_url", "redis://example.invalid:6379/0")
    monkeypatch.setattr(rate_limit, "_redis", Broken())
    make_user(db)
    ok = client.post("/auth/login", json={"email": "user@example.com", "password": "CorrectHorse1!"})
    assert ok.status_code == 200  # request still served, per-process counters used
    for _ in range(9):
        last = client.post("/auth/login", json={"email": "user@example.com", "password": "bad-pass-123"})
    assert last.status_code == 429  # fallback still enforces limits


def test_limiter_can_be_disabled_for_local_dev(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    codes = [client.post("/auth/login", json={"email": "ghost@example.com", "password": "x-x-x-x-x1"}).status_code
             for _ in range(40)]
    assert 429 not in codes
