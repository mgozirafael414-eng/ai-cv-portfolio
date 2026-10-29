# AI-Powered Dynamic Web CV and Portfolio Management System

A web application for account-owned professional profile and career data, CV preview/PDF generation, public portfolio publishing, and optional review-first AI recommendations.

The repository includes React/Vite frontend code, an Express API, PostgreSQL/Prisma schema and migrations, backend automated tests, and documentation. A hosted deployment, live Groq-provider operation, and authenticated browser acceptance testing are not established by repository evidence.

## Project layout

- `frontend/`: React/Vite single-page client.
- `backend/`: Express API, Prisma schema/migrations, tests, and runtime upload directory.
- `docs/`: project, technical, user, API, database, testing, and defense documentation.

Start with [System Documentation](docs/SYSTEM_DOCUMENTATION.md). Other references:

- [Database Documentation](docs/DATABASE_DOCUMENTATION.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [User Manual](docs/USER_MANUAL.md)
- [Testing Report](docs/TESTING_REPORT.md)
- [Final Project Report](docs/FINAL_PROJECT_REPORT.md)
- [Defense Presentation Outline](docs/DEFENSE_PRESENTATION_OUTLINE.md)
- [Defense Q&A](docs/DEFENSE_QA.md)

## Local setup

Requirements: Node.js/npm and PostgreSQL versions compatible with the installed package set. The repository does not pin a minimum Node.js or PostgreSQL version.

1. Install dependencies from the repository root:
   ```bash
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```
2. Copy `backend/.env.example` to the repository-root `.env` for root-level commands and backend startup. Configure `DATABASE_URL`, a strong `JWT_SECRET`, and local CORS values. Alternatively, when starting with `npm --prefix backend run dev`, provide `backend/.env`.
3. If needed, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL` (development default: `http://localhost:5000`).
4. Validate and generate Prisma Client:
   ```bash
   npm run prisma:validate
   npm run prisma:generate
   ```
5. Review the migrations and apply them to a development database as described in [Database Documentation](docs/DATABASE_DOCUMENTATION.md). Do not reset a database containing data.
6. In separate terminals, start:
   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```
7. Open the Vite URL printed in the frontend terminal (normally `http://localhost:5173`). This is local development access, not a deployment address.

AI actions require private provider configuration. Do not commit credentials or enter real personal data into unverified environments.

## Development commands

```bash
npm run dev:frontend
npm run build:frontend
npm run lint:frontend
npm run dev:backend
npm test --prefix backend
npm run prisma:validate
npm run prisma:generate
```

`npm run prisma:migrate` invokes Prisma's development migration flow; it is not a production deployment command.

## Current validation evidence

The latest documented run reported 304 backend tests passing, frontend build and lint passing, and Prisma schema validation passing with a placeholder database URL. No database migration was applied, and browser, live-provider, or production tests were not performed. See the [Testing Report](docs/TESTING_REPORT.md).
