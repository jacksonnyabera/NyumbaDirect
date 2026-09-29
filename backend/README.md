# NyumbaDirect API deployment

The API is a FastAPI service. Its public readiness endpoint is `/health/ready`; it checks that the database can answer a query. `/health/` is a lightweight liveness endpoint.

## Required runtime settings

Provide these through the hosting provider's secret/environment settings. Do not commit production values:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `PUBLIC_API_URL` (the public HTTPS API origin used in account verification links)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `SMTP_FROM` for verification, password reset, and conversation notices
- `VERIFICATION_CODE_TTL_MINUTES`, `VERIFICATION_CODE_MAX_ATTEMPTS`, and `VERIFICATION_RESEND_COOLDOWN_SECONDS` to tune signup-code expiry and resend limits (defaults: 10 minutes, 5 attempts, and 60 seconds)
- `SMS_PROVIDER=africas_talking`, `SMS_API_KEY`, `SMS_USERNAME`, and `SMS_ENVIRONMENT=sandbox` or `production` for SMS signup codes. Set `SMS_SENDER_ID` only after Africa's Talking has approved the sender ID for your account.
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_URL`, and `MPESA_CALLBACK_SECRET` for paid listing boosts

`MPESA_CALLBACK_URL` should be the public HTTPS URL for `/payments/mpesa/callback`. Set `MPESA_CALLBACK_SECRET` to a long random value and keep it private. The API adds it as the callback URL's `key` parameter and checks it with a constant-time comparison before accepting payment results. Payment initiation fails closed when either callback setting is missing.

For a multi-worker deployment, set `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, and `DATABASE_POOL_TIMEOUT` to fit the database connection limit across all workers. These settings apply per worker process.

Signup supports a one-time code by email or Kenyan mobile SMS. Unverified accounts cannot sign in or use authenticated API routes. If the selected delivery channel is not configured or delivery fails, the account remains pending and the user can request another code after delivery is configured. Africa's Talking credentials and a production-approved sender ID are required for real SMS delivery. Password reset requests return the same public response whether or not the account exists.
