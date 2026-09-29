import hashlib
import hmac
import re
import secrets

from app.config import settings


def normalize_kenyan_phone(value: str) -> str:
    if not re.fullmatch(r"[+0-9()\s-]+", value):
        raise ValueError("Enter a valid Kenyan mobile number, such as 0712345678.")
    digits = re.sub(r"\D", "", value)
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif digits.startswith("7") or digits.startswith("1"):
        if len(digits) == 9:
            digits = "254" + digits
    if not re.fullmatch(r"254[17]\d{8}", digits):
        raise ValueError("Enter a valid Kenyan mobile number, such as 0712345678.")
    return "+" + digits


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str) -> str:
    return hmac.new(
        settings.jwt_secret_key.encode(), code.encode(), hashlib.sha256
    ).hexdigest()


def check_code(code: str, saved_hash: str) -> bool:
    return hmac.compare_digest(hash_code(code), saved_hash)
