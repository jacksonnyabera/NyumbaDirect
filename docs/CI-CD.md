# NyumbaDirect CI/CD and production safety

## Automated checks

The GitHub Actions workflow `.github/workflows/ci.yml` runs on pull requests targeting `main`, pushes to `main`, and manual dispatch. It installs locked frontend dependencies, runs Oxlint and the Vite production build, installs backend dependencies, compiles FastAPI and Alembic modules, checks the migration graph, and runs pytest if tests exist.

This workflow is CI only. It does not deploy and does not need production credentials.

## Hosting and release

The project uses Vercel for the frontend and Render for the API. Keep those existing integrations as the deployment mechanism. Confirm both providers use `main` as the production branch and previews for feature branches. Do not add duplicate GitHub Actions deployment jobs.

Release only after a reviewed pull request is merged into `main`, required checks pass, and the existing Vercel/Render deployment is confirmed healthy.

## GitHub branch protection

After the workflow has run once, configure a ruleset for `main`:

1. Require pull requests before merging.
2. Require status checks `Frontend lint and production build` and `Backend syntax and migration checks` (choose the exact job names displayed by GitHub).
3. Block force pushes and branch deletion.
4. Require the branch to be up to date before merging where practical.

## Current coverage limitations

The backend test suite was not found in the repository search. The workflow therefore reports that no pytest suite exists and still runs syntax and Alembic graph checks. Add database-isolated backend tests for authentication, property listing, permissions and validation.

The migration graph check does not execute migrations against production. Never run destructive migrations against the live database; review and apply production migrations through a separately controlled release.
