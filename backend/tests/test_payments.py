"""M-Pesa payment security. Daraja is always mocked: no real payments, no
network calls, no credentials."""

import logging
from decimal import Decimal

import pytest
import requests

from app import rate_limit
from app.config import settings
from app.log_redaction import RedactQuerySecrets
from app.models.property import Property
from app.models.property_promotion import PropertyPromotion
from app.routers import payments
from app.services import mpesa
from app.services.mpesa import MpesaQueryUnavailableError
from tests.conftest import auth, login, make_user

SECRET = "test-callback-secret"
CHECKOUT = "ws_CO_11112026101010123456"
MERCHANT = "29115-34620561-1"
RECEIPT = "NLJ7RT61SV"
AMOUNT = Decimal("1500.00")
CALLBACK_URL = f"/payments/mpesa/callback?key={SECRET}"


@pytest.fixture(autouse=True)
def verification_on(monkeypatch):
    monkeypatch.setattr(settings, "mpesa_verify_callbacks", True)
    monkeypatch.setattr(settings, "mpesa_callback_secret", SECRET)
    monkeypatch.setattr(settings, "mpesa_callback_allowed_ips", "")


@pytest.fixture
def safaricom(monkeypatch):
    """Control what Safaricom's STK Query 'says'."""

    class Fake:
        calls = 0
        answer = {"ResultCode": "0", "CheckoutRequestID": CHECKOUT, "MerchantRequestID": MERCHANT}
        error = None

    def fake_query(checkout_request_id):
        Fake.calls += 1
        if Fake.error:
            raise Fake.error
        return Fake.answer

    monkeypatch.setattr(payments, "query_stk_status", fake_query)
    Fake.calls, Fake.answer, Fake.error = 0, {"ResultCode": "0", "CheckoutRequestID": CHECKOUT, "MerchantRequestID": MERCHANT}, None
    return Fake


@pytest.fixture
def promo(db):
    owner = make_user(db, email="owner@example.com", role="LANDLORD", phone="+254712000010")
    prop = Property(owner_id=owner.id, title="Two bedroom", description="A" * 30,
                    property_type="Apartment", bedrooms=2, bathrooms=1,
                    monthly_rent=Decimal("20000"), county="Nairobi", town="Nairobi", area="Kilimani")
    db.add(prop)
    db.commit()
    p = PropertyPromotion(property_id=prop.id, user_id=owner.id, package="7_DAYS", amount=AMOUNT,
                          payment_status="PENDING", phone_number="254712000010",
                          checkout_request_id=CHECKOUT, merchant_request_id=MERCHANT)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def body(code=0, amount="1500.00", receipt=RECEIPT, checkout=CHECKOUT, merchant=MERCHANT, items=None):
    cb = {"MerchantRequestID": merchant, "CheckoutRequestID": checkout, "ResultCode": code,
          "ResultDesc": "The service request is processed successfully." if code == 0 else "Request cancelled by user"}
    if code == 0:
        cb["CallbackMetadata"] = {"Item": items if items is not None else [
            {"Name": "Amount", "Value": amount},
            {"Name": "MpesaReceiptNumber", "Value": receipt},
            {"Name": "PhoneNumber", "Value": 254712000010},
        ]}
    return {"Body": {"stkCallback": cb}}


def refresh(db, p):
    db.expire_all()
    return db.get(PropertyPromotion, p.id)


def featured(db, p):
    db.expire_all()
    return db.get(Property, p.property_id).is_featured


# ---------------------------------------------------------------- auth
def test_callback_without_secret_is_rejected(client, promo):
    assert client.post("/payments/mpesa/callback", json=body()).status_code == 401


def test_callback_with_wrong_secret_is_rejected_and_does_not_pay(client, db, promo):
    assert client.post("/payments/mpesa/callback?key=wrong", json=body()).status_code == 401
    assert refresh(db, promo).payment_status == "PENDING"


def test_callback_accepts_secret_in_header(client, db, promo, safaricom):
    r = client.post("/payments/mpesa/callback", json=body(), headers={"X-Callback-Key": SECRET})
    assert r.status_code == 200
    assert refresh(db, promo).payment_status == "PAID"


def test_callback_refuses_to_run_when_secret_not_configured(client, promo, monkeypatch):
    monkeypatch.setattr(settings, "mpesa_callback_secret", "")
    assert client.post("/payments/mpesa/callback?key=", json=body()).status_code == 503


def test_secret_guessing_is_rate_limited(client, promo):
    codes = [client.post(f"/payments/mpesa/callback?key=guess{i}", json=body()).status_code for i in range(25)]
    assert codes[0] == 401
    assert codes[-1] == 429


def test_valid_callbacks_do_not_consume_the_failure_limit(client, promo, safaricom):
    for _ in range(25):
        assert client.post(CALLBACK_URL, json=body()).status_code == 200


def test_source_ip_allowlist(client, promo, monkeypatch):
    monkeypatch.setattr(settings, "mpesa_callback_allowed_ips", "203.0.113.50")
    assert client.post(CALLBACK_URL, json=body()).status_code == 403


# ------------------------------------------------------ payload validation
@pytest.mark.parametrize("payload", [
    {},
    {"Body": {}},
    {"Body": {"stkCallback": "nope"}},
    {"Body": {"stkCallback": {"CheckoutRequestID": CHECKOUT}}},
    {"Body": {"stkCallback": {"CheckoutRequestID": CHECKOUT, "ResultCode": "abc"}}},
    {"Body": {"stkCallback": {"CheckoutRequestID": "", "ResultCode": 0}}},
    {"Body": {"stkCallback": {"CheckoutRequestID": "x" * 101, "ResultCode": 0}}},
    {"Body": {"stkCallback": {"CheckoutRequestID": "bad id; DROP TABLE", "ResultCode": 0}}},
    {"Body": {"stkCallback": {"CheckoutRequestID": CHECKOUT, "ResultCode": 0,
                              "CallbackMetadata": {"Item": [{"Name": "Amount"}] * 31}}}},
])
def test_malformed_payloads_are_rejected_without_changing_state(client, db, promo, payload):
    assert client.post(CALLBACK_URL, json=payload).status_code == 400
    assert refresh(db, promo).payment_status == "PENDING"


def test_non_object_json_is_rejected(client, promo):
    assert client.post(CALLBACK_URL, json=[1, 2, 3]).status_code in (400, 422)


def test_unknown_checkout_id_gets_the_same_answer_as_a_valid_one(client, promo, safaricom):
    known = client.post(CALLBACK_URL, json=body(code=1032))
    unknown = client.post(CALLBACK_URL, json=body(checkout="ws_CO_unknown"))
    assert known.status_code == unknown.status_code == 200


def test_merchant_request_id_mismatch_is_ignored(client, db, promo, safaricom):
    client.post(CALLBACK_URL, json=body(merchant="someone-elses-request"))
    assert refresh(db, promo).payment_status == "PENDING"
    assert not featured(db, promo)


# ---------------------------------------------------------- success path
def test_verified_success_activates_the_boost(client, db, promo, safaricom):
    assert client.post(CALLBACK_URL, json=body()).status_code == 200
    p = refresh(db, promo)
    assert p.payment_status == "PAID"
    assert p.payment_reference == RECEIPT
    assert p.expires_at is not None
    assert featured(db, promo)
    assert safaricom.calls == 1


def test_duplicate_callback_is_idempotent(client, db, promo, safaricom):
    client.post(CALLBACK_URL, json=body())
    first_expiry = refresh(db, promo).expires_at
    for _ in range(3):
        r = client.post(CALLBACK_URL, json=body())
        assert r.status_code == 200
    p = refresh(db, promo)
    assert p.expires_at == first_expiry          # not extended by replays
    assert safaricom.calls == 1                  # no repeated Safaricom lookups


def test_amount_as_float_or_string_is_accepted(client, db, promo, safaricom):
    client.post(CALLBACK_URL, json=body(amount=1500.0))
    assert refresh(db, promo).payment_status == "PAID"


@pytest.mark.parametrize("amount", ["1.00", 1499, "0", "-1500", None, "NaN", "abc", True, "1500.01"])
def test_wrong_or_missing_amount_never_pays(client, db, promo, safaricom, amount):
    items = [{"Name": "MpesaReceiptNumber", "Value": RECEIPT}]
    if amount is not None:
        items.append({"Name": "Amount", "Value": amount})
    client.post(CALLBACK_URL, json=body(items=items))
    assert refresh(db, promo).payment_status == "FAILED"
    assert not featured(db, promo)
    assert safaricom.calls == 0


@pytest.mark.parametrize("receipt", [None, "", "  ", "bad receipt!", "AB", "X" * 40])
def test_missing_or_invalid_receipt_never_pays(client, db, promo, safaricom, receipt):
    items = [{"Name": "Amount", "Value": "1500"}]
    if receipt is not None:
        items.append({"Name": "MpesaReceiptNumber", "Value": receipt})
    client.post(CALLBACK_URL, json=body(items=items))
    assert refresh(db, promo).payment_status == "FAILED"
    assert not featured(db, promo)


def test_receipt_cannot_be_reused_for_another_boost(client, db, promo, safaricom):
    other = PropertyPromotion(property_id=promo.property_id, user_id=promo.user_id, package="7_DAYS",
                              amount=AMOUNT, payment_status="PAID", payment_reference=RECEIPT)
    db.add(other)
    db.commit()
    client.post(CALLBACK_URL, json=body())
    assert refresh(db, promo).payment_status == "FAILED"
    assert not featured(db, promo)


def test_package_extends_from_existing_expiry(client, db, promo, safaricom):
    client.post(CALLBACK_URL, json=body())
    first = refresh(db, promo).expires_at
    second = PropertyPromotion(property_id=promo.property_id, user_id=promo.user_id, package="14_DAYS",
                               amount=AMOUNT, payment_status="PENDING", phone_number="254712000010",
                               checkout_request_id="ws_CO_second", merchant_request_id="m2")
    db.add(second)
    db.commit()
    safaricom.answer = {"ResultCode": "0", "CheckoutRequestID": "ws_CO_second", "MerchantRequestID": "m2"}
    client.post(CALLBACK_URL, json=body(checkout="ws_CO_second", merchant="m2", receipt="QWE12345AB"))
    db.expire_all()
    assert db.get(PropertyPromotion, second.id).starts_at >= first


# ----------------------------------------------------- failure / states
@pytest.mark.parametrize("code", [1, 1032, 1037, 2001])
def test_failed_cancelled_and_timed_out_payments_fail(client, db, promo, code):
    client.post(CALLBACK_URL, json=body(code=code))
    p = refresh(db, promo)
    assert p.payment_status == "FAILED"
    assert p.result_code == str(code)
    assert not featured(db, promo)


def test_failed_payment_cannot_be_flipped_to_paid_by_a_later_callback(client, db, promo, safaricom):
    client.post(CALLBACK_URL, json=body(code=1032))
    client.post(CALLBACK_URL, json=body())
    assert refresh(db, promo).payment_status == "FAILED"
    assert not featured(db, promo)
    assert safaricom.calls == 0


def test_paid_payment_cannot_be_failed_by_a_later_callback(client, db, promo, safaricom):
    client.post(CALLBACK_URL, json=body())
    client.post(CALLBACK_URL, json=body(code=1032))
    assert refresh(db, promo).payment_status == "PAID"


# --------------------------------------------- independent verification
def test_unconfirmed_callback_stays_pending_and_does_not_activate(client, db, promo, safaricom):
    safaricom.error = MpesaQueryUnavailableError("timeout")
    assert client.post(CALLBACK_URL, json=body()).status_code == 200
    p = refresh(db, promo)
    assert p.payment_status == "PENDING"
    assert not featured(db, promo)
    assert p.payment_reference == RECEIPT


def test_callback_claiming_success_that_safaricom_denies_is_failed(client, db, promo, safaricom):
    safaricom.answer = {"ResultCode": "1032", "CheckoutRequestID": CHECKOUT}
    client.post(CALLBACK_URL, json=body())
    assert refresh(db, promo).payment_status == "FAILED"
    assert not featured(db, promo)


def test_status_check_finishes_a_payment_that_could_not_be_verified(client, db, promo, safaricom):
    owner_token = _owner_token(client)
    safaricom.error = MpesaQueryUnavailableError("down")
    client.post(CALLBACK_URL, json=body())
    safaricom.error = None
    r = client.get(f"/payments/mpesa/status/{promo.id}", headers=auth(owner_token))
    assert r.status_code == 200
    assert r.json()["payment_status"] == "PAID"
    assert featured(db, promo)


def test_lost_callback_is_recovered_from_safaricom_and_receipt_backfilled(client, db, promo, safaricom):
    token = _owner_token(client)
    r = client.get(f"/payments/mpesa/status/{promo.id}", headers=auth(token))
    assert r.json()["payment_status"] == "PAID"
    assert refresh(db, promo).payment_reference is None
    client.post(CALLBACK_URL, json=body())          # callback finally arrives
    p = refresh(db, promo)
    assert p.payment_reference == RECEIPT
    assert p.payment_status == "PAID"


def test_status_check_marks_failed_when_safaricom_says_not_completed(client, db, promo, safaricom):
    token = _owner_token(client)
    safaricom.answer = {"ResultCode": "1037", "CheckoutRequestID": CHECKOUT}
    r = client.get(f"/payments/mpesa/status/{promo.id}", headers=auth(token))
    assert r.json()["payment_status"] == "FAILED"
    assert not featured(db, promo)


def test_status_check_leaves_pending_when_safaricom_is_unreachable(client, db, promo, safaricom):
    token = _owner_token(client)
    safaricom.error = MpesaQueryUnavailableError("down")
    assert client.get(f"/payments/mpesa/status/{promo.id}", headers=auth(token)).json()["payment_status"] == "PENDING"


def test_status_polling_cannot_hammer_safaricom(client, db, promo, safaricom):
    token = _owner_token(client)
    safaricom.error = MpesaQueryUnavailableError("down")
    for _ in range(5):
        client.get(f"/payments/mpesa/status/{promo.id}", headers=auth(token))
    assert safaricom.calls == 1


def test_verification_can_be_disabled_for_sandbox_only(client, db, promo, safaricom, monkeypatch):
    monkeypatch.setattr(settings, "mpesa_verify_callbacks", False)
    client.post(CALLBACK_URL, json=body())
    assert refresh(db, promo).payment_status == "PAID"
    assert safaricom.calls == 0


# ------------------------------------------------------- authorization
def _owner_token(client):
    return login(client, email="owner@example.com")


def test_other_users_cannot_read_or_pay_for_someone_elses_promotion(client, db, promo, safaricom):
    make_user(db, email="intruder@example.com", phone="+254712000099")
    token = login(client, email="intruder@example.com")
    assert client.get(f"/payments/mpesa/status/{promo.id}", headers=auth(token)).status_code == 403
    r = client.post("/payments/mpesa/stk-push", json={"promotion_id": promo.id, "phone_number": "0712000099"},
                    headers=auth(token))
    assert r.status_code == 403


def test_status_requires_login(client, promo):
    assert client.get(f"/payments/mpesa/status/{promo.id}").status_code == 401


def test_stk_push_blocked_when_a_request_is_already_in_flight(client, promo):
    token = _owner_token(client)
    r = client.post("/payments/mpesa/stk-push", json={"promotion_id": promo.id, "phone_number": "0712000010"},
                    headers=auth(token))
    assert r.status_code == 409


# -------------------------------------------------------------- logging
def test_callback_never_logs_payment_details_or_the_secret(client, promo, safaricom, caplog):
    with caplog.at_level(logging.DEBUG):
        client.post(CALLBACK_URL, json=body())
        client.post("/payments/mpesa/callback?key=wrong-guess", json=body())
    # httpx is the *test client* logging its own outgoing URL; only the
    # server-side loggers matter here.
    text = "\n".join(
        r.getMessage() for r in caplog.records if not r.name.startswith("httpx")
    )
    assert "payment_anomaly" not in text or RECEIPT not in text
    for sensitive in (RECEIPT, "254712000010", SECRET, "wrong-guess"):
        assert sensitive not in text


def test_access_log_filter_redacts_secrets_in_query_strings():
    f = RedactQuerySecrets()
    record = logging.LogRecord("uvicorn.access", logging.INFO, "", 0,
                               '%s - "%s %s HTTP/%s" %d',
                               ("1.2.3.4", "POST", f"/payments/mpesa/callback?key={SECRET}&x=1", "1.1", 200), None)
    f.filter(record)
    rendered = record.getMessage()
    assert SECRET not in rendered
    assert "key=[REDACTED]" in rendered and "x=1" in rendered
    verify = logging.LogRecord("uvicorn.access", logging.INFO, "", 0, "%s",
                               ("/auth/verify-email?token=eyJabc.def.ghi",), None)
    f.filter(verify)
    assert "eyJabc" not in verify.getMessage()


# ------------------------------------------------ Safaricom query client
class FakeResponse:
    def __init__(self, data, status=200):
        self._data, self.status_code = data, status

    def json(self):
        if isinstance(self._data, Exception):
            raise self._data
        return self._data


@pytest.fixture
def daraja(monkeypatch):
    monkeypatch.setattr(mpesa, "get_access_token", lambda: "token")
    state = {"response": None, "exc": None, "sent": None}

    def fake_post(url, json=None, headers=None, timeout=None):
        state["sent"] = {"url": url, "json": json, "timeout": timeout}
        if state["exc"]:
            raise state["exc"]
        return state["response"]

    monkeypatch.setattr(mpesa.requests, "post", fake_post)
    return state


def test_query_returns_a_definite_matching_answer(daraja):
    daraja["response"] = FakeResponse({"ResultCode": "0", "CheckoutRequestID": CHECKOUT})
    assert mpesa.query_stk_status(CHECKOUT)["ResultCode"] == "0"
    assert daraja["sent"]["json"]["CheckoutRequestID"] == CHECKOUT
    assert daraja["sent"]["url"].endswith("/mpesa/stkpushquery/v1/query")
    assert isinstance(daraja["sent"]["timeout"], tuple)       # connect + read timeouts set


@pytest.mark.parametrize("response", [
    FakeResponse({"errorCode": "500.001.1001", "errorMessage": "still processing"}, 500),
    FakeResponse({"ResultCode": "0", "CheckoutRequestID": "a-different-request"}),
    FakeResponse({"ResultDesc": "no code"}),
    FakeResponse(ValueError("not json")),
    FakeResponse(["unexpected"]),
])
def test_query_without_a_definite_matching_answer_is_unavailable(daraja, response):
    daraja["response"] = response
    with pytest.raises(MpesaQueryUnavailableError):
        mpesa.query_stk_status(CHECKOUT)


@pytest.mark.parametrize("exc", [requests.Timeout(), requests.ConnectionError()])
def test_query_network_failures_are_unavailable(daraja, exc):
    daraja["exc"] = exc
    with pytest.raises(MpesaQueryUnavailableError):
        mpesa.query_stk_status(CHECKOUT)
