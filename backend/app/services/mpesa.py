import base64
from datetime import datetime

import requests

from app.config import settings


def get_mpesa_base_url() -> str:
    if settings.mpesa_environment.lower() == "production":
        return "https://api.safaricom.co.ke"

    return "https://sandbox.safaricom.co.ke"


def get_access_token() -> str:
    url = f"{get_mpesa_base_url()}/oauth/v1/generate?grant_type=client_credentials"

    response = requests.get(
        url,
        auth=(
            settings.mpesa_consumer_key,
            settings.mpesa_consumer_secret,
        ),
        timeout=30,
    )

    response.raise_for_status()

    data = response.json()

    return data["access_token"]


def generate_password(timestamp: str) -> str:
    raw = (
        f"{settings.mpesa_shortcode}"
        f"{settings.mpesa_passkey}"
        f"{timestamp}"
    )

    return base64.b64encode(
        raw.encode("utf-8")
    ).decode("utf-8")


def initiate_stk_push(
    phone_number: str,
    amount: int,
    account_reference: str,
    transaction_description: str,
):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

    access_token = get_access_token()

    password = generate_password(timestamp)

    url = (
        f"{get_mpesa_base_url()}"
        "/mpesa/stkpush/v1/processrequest"
    )

    payload = {
        "BusinessShortCode": settings.mpesa_shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": amount,
        "PartyA": phone_number,
        "PartyB": settings.mpesa_shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": settings.mpesa_callback_url,
        "AccountReference": account_reference,
        "TransactionDesc": transaction_description,
    }

    response = requests.post(
        url,
        json=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()