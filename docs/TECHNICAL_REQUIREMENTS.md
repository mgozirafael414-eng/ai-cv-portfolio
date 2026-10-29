# Technical Requirements and Implementation

## Implemented stack

- Frontend: React 19, Vite 8, JavaScript.
- Backend: Node.js, Express 5, JavaScript ES modules.
- Database: PostgreSQL and Prisma ORM/Client 6.
- Authentication: `bcryptjs` password hashing and `jsonwebtoken` bearer tokens.
- AI: optional Groq SDK integration.
- PDF: PDFKit; uploads: Multer and local filesystem.

## Runtime configuration

`backend/.env.example` lists `PORT`, `NODE_ENV`, `FRONTEND_URL`, `CORS_ORIGINS`, `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `JWT_SECRET`, and `JWT_EXPIRES_IN`. `frontend/.env.example` lists `VITE_API_URL`. Keep credentials in ignored local/deployment environment configuration; never put secrets into frontend variables or source.

## Actual constraints

- Backend JSON request limit: 1 MB.
- Profile-image upload: one JPEG, PNG, or WEBP up to 5 MB, with signature checks.
- CORS origins include configured frontend origins and local development origins.
- Protected routes require a bearer token; authorization is by owner ID.
- Local image files are served under `/uploads`.

## Commands

Package scripts are authoritative. Use `npm run dev:frontend`, `npm run dev:backend`, `npm run build:frontend`, `npm run lint:frontend`, `npm test --prefix backend`, `npm run prisma:validate`, and `npm run prisma:generate` from the root as applicable. `npm run prisma:migrate` uses `prisma migrate dev` and is for development; inspect [Database Documentation](./DATABASE_DOCUMENTATION.md) before applying migrations.

The former note that AI/PDF/database features were future phases is outdated. The live provider, production deployment, and browser acceptance remain unverified; see the [Testing Report](./TESTING_REPORT.md).
