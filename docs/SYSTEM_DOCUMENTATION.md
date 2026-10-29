# System Documentation

## 1. Project overview

**AI-Powered Dynamic Web CV and Portfolio Management System** is a browser-based application for maintaining professional profile and career data, composing a CV preview, downloading a PDF, and publishing a public portfolio. Authenticated content is owned by an individual account. The application has a React/Vite frontend, an Express API, PostgreSQL persistence through Prisma, and an optional Groq-powered writing and job-description assistance module.

The codebase contains working application modules, backend automated tests, and a frontend build. The presence of code is not evidence that the system is deployed or that external integrations have been configured. No hosted environment is documented in this repository.

## 2. Problem, objectives, scope, and limitations

### Problem statement

Professional details are often maintained in separate documents and services. This project provides a central, account-owned place to manage CV source information and reuse it in a CV and public portfolio workflow.

### Objectives

- Let users register, sign in, and manage profile information.
- Provide CRUD management for education, experience, skills, projects, and certificates.
- Provide a CV preview with selectable layouts and visible sections, plus server-generated PDF download.
- Let a user configure, preview, publish, and unpublish a public portfolio.
- Offer optional AI-generated writing and job-description suggestions that require user review.

### Current scope

Implemented in source: authentication, profile and career-data APIs, CV preview and PDF generation, portfolio configuration/public route, and AI suggestion/recommendation endpoints. The UI provides corresponding pages. Backend automated tests cover API behavior using test doubles and a mocked AI provider.

Not established by repository evidence: hosted deployment, production configuration, live Groq-provider operation, authenticated browser acceptance testing, performance targets, monitoring, backups, or formal accessibility certification. There is no separate administrator/role system.

AI suggestions are generated from saved CV context, persisted as `AIGeneration` records, and are not intended to silently change CV fields. Applying an AI suggestion requires an explicit accept action. AI output is not a factual verification service.

### Implementation status

| Status | Features and evidence |
|---|---|
| Implemented in source | Authentication, owner-scoped profile/career CRUD, portfolio management and public lookup, PDF endpoint, AI routes/recommendation workflow, frontend pages, and backend automated tests |
| Partially implemented as an end-to-end workflow | CV Builder preview/template/section settings work in the browser, but its settings are local-only and are not passed to the server PDF endpoint; preview and downloaded PDF are not one synchronized configuration |
| Planned/recommended, not claimed as implemented | Production deployment/operations, browser acceptance and accessibility validation, live-database migration testing, live AI verification, privacy/retention process, and user evaluation |
| Unverified | Hosted deployment status, live Groq-provider operation, authenticated browser workflows, production database behavior, and performance/security certification |

“Planned/recommended” means follow-up identified by this documentation, not a committed delivery date or promise.

The dashboard sidebar currently labels CV Builder, AI Assistant, and Portfolio under “Coming later” even though corresponding page components and routes are present. This documentation describes the source implementation rather than treating that label as proof that the features are absent.

## 3. Requirements

### Functional requirements evidenced by implementation

1. Register with a name, email, and password; log in and retrieve the authenticated user.
2. Read and update the signed-in user's profile and manage a profile image.
3. Create, list, update, and delete owned education, experience, skill, project, and certificate records.
4. Preview a CV in Classic, Modern, or Minimal layouts, toggle displayed sections, and download a generated PDF.
5. Create and update one portfolio per user; select a portfolio template; publish or unpublish it; return public content only for a published slug.
6. Request AI writing, skills, CV optimization, and job-description suggestions; list, edit, accept, and reject saved recommendations.

### Non-functional requirements and known limits

- API requests use bearer JWT authentication for protected routes; password hashes are stored rather than plaintext passwords.
- Ownership is derived from the verified token for private records.
- Input validation, request-size limits, CORS allow-listing, and upload restrictions are implemented in code.
- The backend uses a 1 MB JSON body limit. Profile image uploads are limited to one JPEG, PNG, or WEBP file up to 5 MB.
- The repository provides no measured performance, availability, usability, accessibility, or security certification targets.
- The app stores its login token and CV Builder settings in browser `localStorage`; this has browser/device scope and is not server-side session storage.
- Published portfolio content is public. Review profile and career details before publishing.

## 4. Architecture

```mermaid
flowchart LR
  Browser[React + Vite browser app] -->|JSON / multipart; Bearer token| API[Express API]
  API -->|Prisma Client| DB[(PostgreSQL)]
  API -->|Optional HTTPS provider request| Groq[Groq Chat Completions]
  API -->|PDFKit| PDF[PDF response]
  API -->|Static profile-image files| Uploads[process cwd/uploads]
  Visitor[Public visitor] -->|GET published slug| API
```

The frontend calls the API through `frontend/src/services/api.js`. The API is assembled in `backend/src/app.js`; routes call controllers, services, validation helpers, and Prisma. The API also serves files from an `uploads` directory resolved against the backend process's current working directory. Starting from the repository root therefore uses a root-level `uploads` directory; starting with the backend package uses `backend/uploads`. The public portfolio endpoint bypasses authentication but only returns a portfolio when it is marked published. There is no OpenAPI/Swagger specification in the repository.

## 5. Technology stack

| Area | Actual technology | Use |
|---|---|---|
| Frontend | React 19, Vite 8, JavaScript, CSS | Single-page browser interface and local development/build |
| Backend | Node.js, Express 5, JavaScript ES modules | HTTP API, middleware, route/controller/service layers |
| Data | PostgreSQL, Prisma ORM / Prisma Client 6 | Relational storage and migrations |
| Authentication | `bcryptjs`, `jsonwebtoken` | Password hashing and signed access tokens |
| AI integration | `groq-sdk` | Optional Groq chat-completion requests |
| PDF | `pdfkit` | Server-side CV PDF generation |
| Uploads | `multer` and Node filesystem APIs | In-memory image validation and local image-file storage |
| Tests/lint | Node built-in test runner, ESLint | Backend API tests and frontend linting |

These are the technologies present in the package manifests. Reasons stated here describe their implemented role, not a comparative benchmark.

## 6. Project structure

```text
.
├── README.md
├── package.json
├── docs/                         # Project docs and earlier planning docs (see linked index)
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │       ├── 20260919133202_init/
│   │       └── 20260919165434_add_ai_recommendation_status/
│   ├── src/
│   │   ├── app.js, server.js
│   │   ├── config/               # groq.js, prisma.js
│   │   ├── controllers/          # Auth, profile, resources, AI, and PDF
│   │   ├── middleware/           # auth.middleware.js
│   │   ├── routes/               # Auth, profile, resources, AI, CV, and public
│   │   ├── services/             # Domain services and ai/ai.service.js
│   │   └── utils/                # Validators, password, JWT, safe-user helpers
│   ├── test/                     # Nine Node test-runner files
│   └── uploads/.gitkeep          # Runtime storage directory marker
└── frontend/
    ├── .env.example
    ├── package.json
    ├── public/                   # favicon.svg, icons.svg
    └── src/
        ├── assets/               # hero.png and Vite/React assets
        ├── components/
        │   ├── common/           # ResourcePage
        │   └── cv/               # CVBuilder and templates/
        ├── context/, hooks/      # Authentication state
        ├── pages/                # auth, dashboard, profile, career, AI, portfolio, public
        ├── services/api.js
        └── App.jsx, main.jsx, CSS
        └── App.jsx, main.jsx, CSS
```

Dependencies and generated output directories are intentionally omitted from this source-oriented map.

## 7. Modules

- **Authentication:** registration, login, current-user lookup, bearer-token middleware.
- **Profile:** editable contact/professional fields and validated profile-image upload/removal.
- **Career records:** education, experience, skills, projects, and certificates; each record is scoped to its owner.
- **CV Builder:** browser-side templates, section controls, preview, and PDF download. CV title/template/section settings are stored in browser `localStorage`.
- **Portfolio:** one portfolio record per account, title/slug/template and publication state; public retrieval by slug.
- **AI Assistant:** summary/experience/project improvement, skill suggestions, CV optimization, job analysis, and saved recommendation review actions.
- **PDF:** server-side PDF output derived from the user's saved profile and career data.

## 8. Authentication and authorization

Registration validates name/email/password, normalizes email to lowercase, hashes the password with bcrypt, and returns a safe user object. Login verifies the password and returns `{ token, user }`. Authenticated requests send `Authorization: Bearer <token>`; middleware verifies the token and takes the user ID from its `sub` claim. The configured token lifetime defaults to one hour when `JWT_EXPIRES_IN` is unset.

Private data services use that authenticated user ID for reads and writes. The shared owned-resource service checks ownership before updates/deletes and ignores client-supplied ownership identifiers. AI recommendation operations are also owner-scoped. The public portfolio endpoint is deliberately unauthenticated and only serves published portfolios.

The frontend keeps the access token in `localStorage`, sends it for API requests, clears authentication on a 401 event, and offers a sign-out action. JWT signing requires `JWT_SECRET`; no secret is included in documentation examples.

## 9. Data flows

1. A user submits credentials in the browser; the frontend calls `/api/auth/register` or `/api/auth/login`.
2. The browser stores the login token and includes it on protected API requests.
3. Express validates request data and identifies the token owner; services read/write that owner's Prisma records in PostgreSQL.
4. The CV Builder loads the profile and career collections to render its browser preview. A separate protected PDF request builds a PDF on the server from stored data.
5. For AI actions, the backend sends user context and task instructions to Groq when configured. Generated output is validated and persisted as a recommendation. User actions determine whether suggestion text is accepted into an owned target.
6. Portfolio publication flips a database flag. A visitor's slug request returns public profile and career content only if the portfolio is published.

## 10. Local installation and setup

Requirements: a supported Node.js/npm installation, PostgreSQL, and a browser. Exact minimum Node.js/PostgreSQL versions are not pinned in the project documentation; confirm compatible versions for the installed package set.

From the project root:

1. Install each package set:
   ```bash
   npm install
   npm install --prefix backend
   npm install --prefix frontend
   ```
2. Copy `backend/.env.example` to a root `.env` when launching the backend from the root, and replace placeholders locally. Alternatively, when running the backend with `npm --prefix backend run dev`, provide `backend/.env`.
3. Set `DATABASE_URL` to a local PostgreSQL connection. Set a strong local-only `JWT_SECRET`. Configure Groq only if using live AI actions. Do not commit environment files.
4. Prepare the development database using the migration instructions in [Database Documentation](./DATABASE_DOCUMENTATION.md). Do not use database resets on a database with data.
5. Copy `frontend/.env.example` to `frontend/.env` if the API address needs to be changed. `VITE_API_URL` defaults to `http://localhost:5000` in development.
6. Start the API and frontend in separate terminals:
   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```
7. Open the Vite URL reported by the frontend process (normally `http://localhost:5173`). This is local development access, not a hosted deployment URL.

### Environment variables

| Variable | Purpose | Example placeholder |
|---|---|---|
| `PORT` | Backend listen port; defaults to `5000` | `5000` |
| `NODE_ENV` | Node environment label | `development` |
| `FRONTEND_URL` | Additional allowed frontend origin | `http://localhost:5173` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection used by Prisma | `postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public` |
| `GROQ_API_KEY` | Optional Groq provider credential | `SET_LOCALLY_ONLY` |
| `GROQ_MODEL` | Groq model identifier; example default in template is `openai/gpt-oss-20b` | `PROVIDER_MODEL_NAME` |
| `JWT_SECRET` | JWT signing secret; required for auth | `GENERATE_A_LONG_RANDOM_VALUE` |
| `JWT_EXPIRES_IN` | JWT lifetime; default `1h` | `1h` |
| `VITE_API_URL` | Frontend API origin | `http://localhost:5000` |

The service also supports `AI_PROVIDER_MODE=disabled` to disable provider calls, and tests use `GROQ_MOCK_MODE=true`. These are implementation/test controls, not listed in the checked-in environment examples. Never put credentials in frontend `VITE_` variables.

## 11. Development commands

| Command from root | Effect |
|---|---|
| `npm run dev:frontend` | Start Vite development server |
| `npm run build:frontend` | Build frontend |
| `npm run lint:frontend` | Lint frontend |
| `npm run dev:backend` | Start backend server |
| `npm run start:backend` | Start backend server without watch mode |
| `npm run prisma:validate` | Validate Prisma schema; requires `DATABASE_URL` to be set |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run Prisma `migrate dev` (development use only) |
| `npm test --prefix backend` | Run backend Node tests |

The backend package also has `npm --prefix backend run dev`, `start`, `test`, `prisma:validate`, `prisma:generate`, and `prisma:migrate`.

## 12. Troubleshooting

- **Prisma reports missing `DATABASE_URL`:** ensure the environment file is in the working directory Prisma/Node reads, or set the variable for the command. Use a placeholder only for schema validation, never as a real database.
- **Protected requests return 401:** sign in again; confirm the frontend API origin, token, backend JWT configuration, and CORS origin.
- **AI returns 503:** the provider key may be absent or AI may be disabled. Configure provider access privately; live-provider behavior has not been verified for this project.
- **AI returns 429/502:** provider quota, credentials, or provider response may be at fault; retry only after reviewing server/provider configuration.
- **Profile image is rejected:** use JPEG, PNG, or WEBP, keep the file at or below 5 MB, and ensure the actual file content matches its type.
- **Public URL gives 404:** confirm the exact slug and that the portfolio is published; unpublished portfolios intentionally return 404.
- **Browser cannot reach API:** ensure backend is listening on the configured port and `VITE_API_URL`/CORS origins match.

## 13. Maintenance

- Back up PostgreSQL before applying schema changes; review SQL migrations and use production migration workflows rather than `migrate dev`.
- The second migration adds a required `updated_at` to `ai_generations` without a database default. Its SQL warns that applying it to a non-empty table may fail; assess existing data and plan an explicit safe migration before applying it to a populated database.
- Back up the process working directory's `uploads/profile-images` separately if uploaded images must survive host replacement; the database stores image paths, not image binaries.
- Keep secrets in deployment/local environment configuration and rotate credentials if exposed.
- Review public portfolio fields before publication and document retention/deletion policy before production use.
- Monitor the optional AI provider's terms, availability, rate limits, privacy practices, and model changes.
- Keep API, database, test, and documentation changes synchronized. No production monitoring, backup automation, or deployment pipeline is evidenced here.

Related references: [Database Documentation](./DATABASE_DOCUMENTATION.md), [API Documentation](./API_DOCUMENTATION.md), [User Manual](./USER_MANUAL.md), [Testing Report](./TESTING_REPORT.md), [Final Project Report](./FINAL_PROJECT_REPORT.md), [Defense Presentation Outline](./DEFENSE_PRESENTATION_OUTLINE.md), and [Defense Q&A](./DEFENSE_QA.md).
