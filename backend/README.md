# NyumbaDirect API deployment

The API is a FastAPI service. Its public readiness endpoint is `/health/ready`; it checks that the database can answer a query. `/health/` is a lightweight liveness endpoint.

## Required runtime settings

Provide these through the hosting provider's secret/environment settings. Do not commit production values:

- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `PUBLIC_API_URL` (the public HTTPS API origin used in account verification links)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `SMTP_FROM` for verification, password reset, and conversation notices
- `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_SHORTCODE`, `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_URL`, and `MPESA_CALLBACK_SECRET` for paid listing boosts

`MPESA_CALLBACK_URL` should be the public HTTPS URL for `/payments/mpesa/callback`. Set `MPESA_CALLBACK_SECRET` to a long random value and keep it private. The API adds it as the callback URL's `key` parameter and checks it with a constant-time comparison before accepting payment results. Payment initiation fails closed when either callback setting is missing.

For a multi-worker deployment, set `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, and `DATABASE_POOL_TIMEOUT` to fit the database connection limit across all workers. These settings apply per worker process.

If SMTP is not configured, account creation still succeeds and the API reports that the verification email was not sent. Password reset requests return the same public response whether or not the account exists.
