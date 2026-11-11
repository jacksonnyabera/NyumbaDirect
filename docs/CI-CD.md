# NyumbaDirect CI/CD and production safety

## Automated checks

The GitHub Actions workflow `.github/workflows/ci.yml` runs on pull requests targeting `main`, pushes to `main`, and manual dispatch.

- Frontend: installs the locked npm dependencies, runs Oxlint, and builds the Vite production bundle.
- Backend: installs `requirements-dev.txt`, compiles application/migration/test modules, validates the Alembic revision graph, and runs the backend pytest suite.
- Backend CI uses an isolated SQLite URL and a disposable CI-only JWT secret. It does not connect to Neon, Render, M-Pesa, Cloudinary, email or production services.
- The workflow is CI only. It does not deploy and does not need production credentials.

## Hosting and release

The project uses Vercel for the frontend and Render for the API. Keep those existing integrations as the deployment mechanism. Confirm both providers use `main` as the production branch and previews for feature branches. Do not add duplicate GitHub Actions deployment jobs.

Release only after a reviewed pull request is merged into `main`, required checks pass, and the existing Vercel/Render deployment is confirmed healthy. A Vercel preview marked Ready is not proof that the production domain or backend is healthy.

## GitHub branch protection

Repository inspection on 11 November 2026 showed that `main` was not protected and had no required status checks. After the CI workflow has run successfully at least once, configure a ruleset for `main`:

1. Require pull requests before merging.
2. Require status checks `Frontend lint and production build` and `Backend tests and migration checks` (select the exact names shown in GitHub).
3. Block force pushes and branch deletion.
4. Require the branch to be up to date before merging where practical.
5. Restrict direct pushes to `main` to repository administrators only if that fits your release process.

These repository settings must be enabled by an administrator in GitHub; this workflow cannot enable its own branch protection.

## Current coverage limitations and follow-up audit

The first backend tests added here cover JWT token issuance and token-type separation without a live database. They are a starting regression suite, not comprehensive API coverage. Add isolated API tests for authentication, property listing, ownership/role permissions, photo validation, payment callback validation and schema validation.

The migration graph check does not execute migrations against production. Never run destructive migrations against the live database; review and apply production migrations through a separately controlled release.

The frontend is a Vite React single-page application. Per-property title, canonical and structured data are currently set client-side after fetching the listing. This should be reviewed for social crawlers and search-engine rendering; do not assume client-side metadata alone guarantees each property page will be indexed. A prerender/SSR solution should be chosen only after validating compatibility with current routing, API data and Vercel deployment.

## Production safety

- Never commit secrets or production environment files.
- Never point CI tests at the production database.
- Do not run database migrations against production from a pull-request workflow.
- Do not change live M-Pesa settings, production environment variables or provider deployment settings as part of CI setup.
- Keep production deployment controlled by the existing hosting integrations and the reviewed `main` branch.
