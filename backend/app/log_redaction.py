"""Keep secrets that travel in query strings out of access logs.

The M-Pesa callback URL carries a shared secret (Daraja cannot send custom
headers) and the legacy email-verification link carries a signed token. Both
would otherwise appear in uvicorn's access log, which Render retains.
"""

import logging
import re

_SECRET_PARAM = re.compile(r"([?&](?:key|token|code|secret)=)[^&\s\"']+", re.IGNORECASE)


def redact(value: str) -> str:
    return _SECRET_PARAM.sub(r"\1[REDACTED]", value)


class RedactQuerySecrets(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(
                redact(arg) if isinstance(arg, str) else arg for arg in record.args
            )
        return True


def install() -> None:
    for name in ("uvicorn.access", "uvicorn.error", "gunicorn.access"):
        logger = logging.getLogger(name)
        if not any(isinstance(f, RedactQuerySecrets) for f in logger.filters):
            logger.addFilter(RedactQuerySecrets())
