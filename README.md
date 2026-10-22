# NyumbaDirect 🇰🇪

**Find a home directly from landlords and property managers.**

NyumbaDirect is a Kenya-focused rental property platform designed to help house hunters discover homes and connect with landlords or property managers directly.

- **Live website:** https://www.nyumbadirect.co.ke/
- **API documentation:** https://nyumbadirect-bjig.onrender.com/docs
- **API service:** https://nyumbadirect-bjig.onrender.com

## What the project aims to provide

- Browse and search rental property listings
- Property details, photos, and listing filters
- Accounts for house hunters, landlords, and property managers
- User dashboards and property management
- Saved homes and messaging
- Property promotion/boost packages and M-Pesa payment integration
- Account and property verification workflows
- Responsive web experience for desktop and mobile screens

Feature availability can depend on the current production deployment and configuration.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM and migrations | SQLAlchemy, Alembic |
| API requests | Axios |
| Deployment | Vercel (frontend), Render (API), Neon PostgreSQL (database) |

## Repository layout

```text
NyumbaDirect/
├── backend/     # FastAPI application and database migrations
├── frontend/    # React + Vite web application
└── README.md
```

## Run locally

### Requirements

- Python 3.12 or a compatible Python version
- Node.js and npm
- PostgreSQL, or a development database URL supported by your configuration

### 1. Clone the repository

```bash
git clone https://github.com/jacksonnyabera/NyumbaDirect.git
cd NyumbaDirect
```

### 2. Configure the backend

In PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create a local `.env` file using the settings expected by the backend configuration. Set your database URL and a strong, private JWT secret. Configure optional email, image-storage, and M-Pesa credentials only if you intend to test those integrations.

**Never commit real passwords, API keys, JWT secrets, payment credentials, or production environment files.**

Run database migrations:

```powershell
alembic upgrade head
```

Start the API from the `backend` directory:

```powershell
uvicorn app.main:app --reload --port 8000
```

Open http://127.0.0.1:8000/docs to inspect the API.

### 3. Configure and run the frontend

Open a second terminal:

```powershell
cd frontend
npm install
```

Create `frontend/.env.local` and set the backend URL:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the development server:

```powershell
npm run dev
```

Open the local URL printed by Vite in the terminal.

For production, configure `VITE_API_URL` in the frontend hosting environment to point to the deployed API. The backend CORS configuration must allow the frontend's exact origin.

## Deployment overview

- **Frontend:** deployed through Vercel.
- **Backend:** deployed through Render.
- **Database:** PostgreSQL hosted on Neon.

Production environment variables should be configured in the relevant hosting dashboards, not committed to this repository. Apply database migrations as part of a controlled deployment process and verify the API health endpoint and `/docs` after deployment.

## Contributing

1. Create a feature branch.
2. Make a focused change and test it locally.
3. Review the diff and ensure no secrets or personal data are included.
4. Open a pull request with a clear description of the change.

## Security

Please do not publish credentials, tokens, private user information, or production database connection strings. Report security concerns privately to the repository maintainer rather than posting sensitive details in a public issue.

## Maintainer

**Jackson Nyabera**  
GitHub: [@jacksonnyabera](https://github.com/jacksonnyabera)

---

*Built to make finding rental homes in Kenya more direct and accessible.*
