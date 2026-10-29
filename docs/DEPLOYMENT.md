# Production Deployment: Vercel, Neon, and Cloudinary

This guide deploys the existing frontend and API as two Vercel projects using Neon PostgreSQL and Cloudinary image storage. It documents setup; it does not mean the project is deployed. No production database connection or migration was run while preparing this guide.

## Before you start

You will need accounts for GitHub (or the Git provider holding this repository), Vercel, Neon, and Cloudinary. Keep the repository private if it contains project data you do not intend to publish. Do not commit `.env` files, connection strings, passwords, JWT secrets, or Cloudinary secrets.

The project has these verified deployment pieces:

- Frontend root: `frontend` (React/Vite; build script `npm run build`).
- Backend root: `backend` (Express; Vercel entrypoint `src/index.js`, which exports the existing app and routes).
- Prisma uses `DATABASE_URL` for the runtime datasource and `DIRECT_URL` for direct Prisma CLI operations.
- Existing PostgreSQL migrations are under `backend/prisma/migrations/`; keep these migration files unchanged.
- Profile images use authenticated signed direct uploads to Cloudinary in production. Image URLs are stored in the existing profile field. PDF generation supports validated Cloudinary URLs and old local upload paths.

## 1. Create a new Neon database

1. Sign in to Neon and create a project. Choose the region closest to your Vercel backend region.
2. Create or select the database and application role.
3. In Neon’s connection details, copy both PostgreSQL connection strings:
   - **Pooled connection**: use the pooled hostname (usually includes `-pooler`) for `DATABASE_URL`.
   - **Direct connection**: use the non-pooled hostname for `DIRECT_URL` and Prisma migrations.
4. Keep these values private. Do not paste them into source files, frontend variables, screenshots, or chat messages.
5. Do not run any migration yet. Applying the existing migrations is step 7 after the Vercel projects and their settings are ready.

## 2. Prepare a secure JWT secret

On Windows, open PowerShell in VS Code. This command prints a cryptographically random 48-byte secret encoded as Base64 URL-safe text:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copy the result directly into the backend Vercel variable `JWT_SECRET`. Do not save the output in the repository or use it as a frontend setting. Generate a different secret for Preview environments if you enable previews.

## 3. Create and configure the backend Vercel project

1. In Vercel, import this repository as a new project.
2. Set **Root Directory** to `backend` and enable the option to include files outside the root directory if Vercel asks. The project needs the root `package.json`/lockfile only if Vercel detects it as a monorepo; otherwise use the backend package/lockfile. Confirm the install and build use the backend project’s `package.json`.
3. Use the Node.js runtime and the Express framework detection. The Vercel entrypoint is `backend/src/index.js`; it exports the Express app created by `createApp()` in `src/app.js`. All existing route mounts remain in that app.
4. Set these **backend-only** environment variables for the Vercel **Production** environment. Add them to Preview only if you intend to run preview deployments against a separately selected database and storage configuration.

| Variable | Required | Value |
|---|---:|---|
| `DATABASE_URL` | Yes | Neon pooled PostgreSQL connection string |
| `DIRECT_URL` | Yes | Neon direct PostgreSQL connection string |
| `JWT_SECRET` | Yes | The generated private secret from step 2 |
| `JWT_EXPIRES_IN` | Recommended | `1h`, or another deliberate token lifetime |
| `NODE_ENV` | Yes | `production` |
| `FRONTEND_URL` | Yes | Exact frontend origin, for example `https://your-frontend.vercel.app` |
| `CORS_ORIGINS` | Optional | Comma-separated exact extra origins you control; leave empty if unused |
| `CLOUDINARY_CLOUD_NAME` | Yes for image uploads | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes for image uploads | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes for image uploads | Cloudinary API secret; keep private |
| `GROQ_API_KEY` | Optional | Private key only if AI endpoints should be enabled |
| `GROQ_MODEL` | Optional | Model supported by your Groq account |

Do not set `PORT` on Vercel. Production CORS excludes localhost. `FRONTEND_URL` and `CORS_ORIGINS` must contain exact origins (scheme and host, no path); do not use `*`. If the production frontend domain is not known yet, finish step 5 and then set `FRONTEND_URL` before the final backend redeploy.

### Cloudinary configuration

1. Create or select a Cloudinary account and copy its cloud name, API key, and API secret from the Cloudinary console.
2. Enter all three values in the **backend** Vercel project environment settings above. The Cloudinary secret must never be in a `VITE_` variable. The backend returns a signed upload configuration; the browser sends image bytes directly to Cloudinary, and the backend verifies the asset before saving its URL.
3. Uploads accept one JPG, PNG, or WEBP image up to 5 MB. Without all credentials, production image uploads return a configuration error rather than writing to Vercel’s temporary filesystem.

Vercel functions have a request-body size limit, so the production direct-upload flow avoids sending the image through the Express function. Existing local development and legacy `/uploads/profile-images/...` profile references remain supported.

## 4. Deploy the backend and note its URL

1. Save the backend project settings and deploy it.
2. Copy the backend deployment origin, such as `https://your-api.vercel.app`. Do not append `/api`.
3. Open `https://your-api.vercel.app/health`. Expected response:

   ```json
   { "name": "AI CV Portfolio API", "status": "ok" }
   ```

This endpoint confirms the API responds; it does **not** check database connectivity or migration state. Do not test database-backed registration until step 7 has completed.

## 5. Create and configure the frontend Vercel project

1. Import the same repository into Vercel as a **second** project.
2. Set **Root Directory** to `frontend`. Select Vite if Vercel asks for a framework. Use `npm run build` as the build command and `dist` as the output directory (Vercel normally detects these automatically).
3. Set this variable in the frontend Vercel project:

| Variable | Required | Value |
|---|---:|---|
| `VITE_API_URL` | Yes | Backend origin from step 4, for example `https://your-api.vercel.app`, with no trailing slash and no `/api` suffix |

`VITE_API_URL` is public browser configuration and must contain only the API base URL. Never add `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CLOUDINARY_API_SECRET`, or `GROQ_API_KEY` to the frontend project.
4. Deploy the frontend and copy its exact origin, such as `https://your-frontend.vercel.app`.
5. Return to the backend Vercel project. Set `FRONTEND_URL` to that exact origin. Put any additional approved frontend origins (for example a specific Preview URL) in `CORS_ORIGINS` as a comma-separated list. Do not use wildcard or broad domain matching.
6. Redeploy the backend after changing its environment variables. Vercel environment changes apply to new deployments.

For private Vercel Preview deployments, configure explicit Preview values rather than pointing arbitrary previews at production data. If a preview is authorized to call the API, add that exact preview origin to the backend's Preview CORS configuration.

## 6. Run local pre-deployment checks (optional but recommended)

From the repository root in PowerShell, run:

```powershell
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
$env:DATABASE_URL = "<Neon pooled connection string>"
$env:DIRECT_URL = "<Neon direct connection string>"
npm run prisma:validate
```

Prisma validation checks the schema configuration; it does not connect to Neon. Never paste connection strings into command output you share. Do not place production values in tracked files.

## 7. Apply existing migrations to the new Neon database

Only after confirming that the Neon database is **new and empty**, review the two existing migration directories in `backend/prisma/migrations/` and run the deployment migration command from the repository root in PowerShell:

```powershell
$env:DATABASE_URL = "<Neon pooled connection string>"
$env:DIRECT_URL = "<Neon direct connection string>"
npm --prefix backend run prisma:migrate:deploy
```

The Prisma datasource has `directUrl = env("DIRECT_URL")`, so Prisma Migrate uses the direct Neon connection rather than the pooled runtime connection. The existing migration files are applied in their recorded order and tracked by Prisma; this command does not create new migrations or reset the database.

**Stop before running this command if the database is not empty or its history is unknown.** Do not use `prisma migrate reset`, `prisma db push`, or `prisma migrate dev` against production. This command is intentionally a manual step; deployments do not run it automatically.

After it completes, keep `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) configured in the backend Vercel Production environment and redeploy if you changed those settings.

## 8. Test the deployed application

Use your own test account and non-sensitive test profile data. Check browser DevTools’ Network panel for failed requests, but never share bearer tokens or secret environment values.

1. **API health:** visit `https://<backend-domain>/health`; confirm the health JSON above.
2. **Frontend:** open `https://<frontend-domain>` and confirm the application loads without console errors.
3. **Registration:** create a new test account using the application’s registration screen. Confirm success.
4. **Login:** sign in with that test account; confirm the authenticated dashboard loads.
5. **Profile editing:** update a harmless test field, save, refresh, and confirm the value persisted.
6. **Cloudinary image upload:** upload a non-sensitive JPG, PNG, or WEBP image up to 5 MB. Confirm it displays in the profile and, if enabled, the public portfolio. Replace it, then remove it; confirm the current image changes and the profile no longer references it.
7. **Portfolio publishing:** configure the portfolio, publish it, and open the generated `/portfolio/<slug>` URL in a signed-out/private browser window. Confirm published content appears. Unpublish it and confirm the public API/page no longer exposes that portfolio.
8. **AI features:** if `GROQ_API_KEY` is configured, try one suggestion with non-sensitive text and confirm errors are visible if the provider is unavailable. Skip this step if AI is disabled.
9. **PDF download:** generate and open a CV PDF. Confirm its content is current and, when a Cloudinary profile image is set, the image appears. Try without a profile image as well.
10. **CORS and direct routes:** confirm browser API requests succeed from the deployed frontend origin. Also open a public `/portfolio/<slug>` page URL directly or refresh it to verify Vercel serves the React application for that route.

These are manual checks; they have not been performed by this repository validation.

## Environment variable separation

**Frontend Vercel project:** `VITE_API_URL` only.

**Backend Vercel project:** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`, `FRONTEND_URL`, optional `CORS_ORIGINS`, Cloudinary variables, and optional Groq variables.

The local templates are `frontend/.env.example` and `backend/.env.example`. Copy them to untracked local `.env` files only when needed. Never commit those files or put backend secrets in a `VITE_` variable.

## Current validation and remaining limitations

Automated tests, lint, build, and Prisma schema validation do not prove a live Vercel deployment, Neon connection, migration, Cloudinary account, or browser workflow works. Real Cloudinary credentials are needed to verify external uploads and deletion. The API `/health` endpoint is not a database health check. Monitor Vercel logs, Neon metrics, and Cloudinary assets during initial smoke tests.
