# API Documentation

## Conventions

- Base URL for local development: `http://localhost:5000`. The server port is configurable with `PORT`.
- JSON endpoints use `Content-Type: application/json`, except profile image upload (`multipart/form-data`).
- Protected routes require `Authorization: Bearer <access-token>`. The token is returned by login; registration returns a user but does not log the client in.
- Request JSON bodies below show the supported fields. Omit optional fields when not setting them; `null` can clear many optional profile/resource fields.
- Error envelope: `{ "error": "message" }`; validation errors generally add `"details": ["..."]`. Unhandled errors return `500` with `{ "error": "Internal server error" }`.
- No OpenAPI/Swagger document or endpoint exists in the repository.

## Public endpoints

| Method and route | Purpose / input | Success response | Errors and rules |
|---|---|---|---|
| `GET /health` | Liveness response; no body | `{ "name": "AI CV Portfolio API", "status": "ok" }` | No authentication |
| `POST /api/auth/register` | JSON body with `name`, `email`, and `password` fields (credential value intentionally omitted) | `201 { "user": { "id", "name", "email", "createdAt", "updatedAt" } }` | `400` invalid body, email, or password; `409` duplicate email. Name required; email format checked; password 8–128 characters. Hash is not returned. |
| `POST /api/auth/login` | JSON body with `email` and `password` fields (credential value intentionally omitted) | `200 { "token": "...", "user": { "id", "name", "email", "createdAt", "updatedAt" } }` | `400` invalid input; `401` same invalid-credentials message for missing account or wrong password. Email/password required; password 8–128 characters. |
| `GET /api/public/portfolio/:slug` | Public published portfolio lookup by slug | `200 { "portfolio": { "id", "title", "slug", "template", "isPublished", "user": { "id", "name", "profile", "education", "experience", "skills", "projects", "certificates" } } }` | `404` when slug is absent, longer than 160 characters, nonexistent, or unpublished. Does not require a token. Returned relations are public content. |

The browser-facing page is `/portfolio/:slug`; this is distinct from the JSON API route above.

## Protected authentication endpoint

| Method and route | Input | Success | Errors |
|---|---|---|---|
| `GET /api/auth/me` | No body | `200 { "user": { "id", "name", "email", "createdAt", "updatedAt" } }` | `401` absent/invalid/expired token or user not found |

## Protected profile endpoints

All require a bearer token. Profile fields accepted by `PUT /api/profile` are optional: `phone` (40 chars), `location` (160), `headline` (200), `bio` (5000), `profileImage` (2048), `linkedinUrl`, `githubUrl`, and `websiteUrl` (each 2048). Text is trimmed; empty optional values become null. Social/website values must be HTTP(S) URLs. `profileImage` must be an HTTP(S) URL or a path beginning with `/`. Unknown keys and client-supplied `userId` are rejected.

| Method and route | Input | Success response | Errors |
|---|---|---|---|
| `GET /api/profile` | None | `200 { "profile": { ...profile fields... } }` | `401`; `404` if no profile exists |
| `PUT /api/profile` | JSON profile fields above | `201 { "profile": ... }` on create; `200` on update | `400` validation; `401` |
| `POST /api/profile/image` | Multipart field `image`; one JPEG/PNG/WEBP file, up to 5 MB | `200 { "profile": ... }` | `400` missing/invalid file or over size; `401`; unexpected upload errors use standard error handling |
| `DELETE /api/profile/image` | None | `200 { "profile": ... }` | `401`; `404` if profile does not exist |

Image MIME type and file signature are both checked. Files are stored under `uploads/profile-images` relative to the backend process working directory (repository-root `uploads` with the root start command, or `backend/uploads` when the backend package is the working directory), and the database stores the path.

## Protected career-data endpoints

For each resource below, routes require authentication and use the shared ownership controller/service. `GET` lists only the current user's records; `POST` creates with the authenticated `userId`; `PUT`/`DELETE` verify record ownership. A record ID must match UUID format. Other owners' records are reported as `404`, not disclosed.

| Resource | Collection route | Required fields on create | Optional fields and validation |
|---|---|---|---|
| Education | `/api/education` | `institution` (non-empty, max 200) | `degree`, `field` (160 each), `startDate`, `endDate` (`YYYY-MM-DD`), `description` (5000); end date cannot precede start |
| Experience | `/api/experience` | `company`, `position` (non-empty, max 200 each) | `startDate`, `endDate` (`YYYY-MM-DD`), `description` (5000); end date cannot precede start |
| Skills | `/api/skills` | `name` (non-empty, max 120) | `category` (120), `proficiency` integer 0–100 |
| Projects | `/api/projects` | `title` (non-empty, max 200) | `description` (10000), `technologies` (up to 50 non-empty strings, max 100 each), `githubUrl`, `liveUrl`, `imageUrl` (HTTP(S), max 2048) |
| Certificates | `/api/certificates` | `name` (non-empty, max 200) | `issuer` (200), `issueDate` (`YYYY-MM-DD`), `credentialUrl` (HTTP(S), max 2048) |

For each collection, the implemented method/route contract is:

| Method / route | Success response | Errors |
|---|---|---|
| `GET <collection>` | `200 { "<plural>": [records...] }` (`educations`, `experiences`, `skills`, `projects`, `certificates`) | `401`; `500` on unexpected failure |
| `POST <collection>` | `201 { "<singular>": record }` (`education`, `experience`, `skill`, `project`, `certificate`) | `400` invalid object, missing/invalid fields, unsupported keys; `401` |
| `PUT <collection>/:id` | `200 { "<singular>": updatedRecord }`; body is a partial update using the fields above | `400` invalid UUID or validation; `401`; `404` missing/not owned |
| `DELETE <collection>/:id` | `204` with no body | `400` invalid UUID; `401`; `404` missing/not owned |

`userId` and unsupported fields are rejected by validators. Date input must be a real `YYYY-MM-DD` calendar date. Optional fields are not required in a partial update.

## Protected portfolio management

| Method and route | Input | Success response | Errors / authorization |
|---|---|---|---|
| `GET /api/portfolio` | None | `200 { "portfolio": { "id", "userId", "title", "slug", "template", "isPublished", "createdAt", "updatedAt" } }` | `401`; `404` no portfolio |
| `POST /api/portfolio` | `{ "title": "Example portfolio", "slug": "safe-example", "template": "professional", "isPublished": false }` | `201 { "portfolio": ... }` | `400` validation; `401`; `409` one already exists or slug conflicts |
| `PUT /api/portfolio` | Partial JSON with `title`, `slug`, `template`, or `isPublished` | `200 { "portfolio": ... }` | `400` validation; `401`; `404` no portfolio; `409` duplicate slug |
| `PATCH /api/portfolio/publish` | `{ "isPublished": true }` or `{ "isPublished": false }` | `200 { "portfolio": ... }` | `400` missing/non-boolean property; `401`; `404` no portfolio |

`title` max is 200 characters, `slug` max is 160 and must consist of lowercase letters, digits, and single hyphen-separated groups, and `template` is one of `professional`, `modern`, `minimal`. Portfolio is per-user. Public retrieval is separate at `GET /api/public/portfolio/:slug`.

## Protected AI endpoints

AI endpoints require authentication. The provider must be configured; otherwise generation requests may return `503`. The backend expects structured JSON from Groq and can return provider-related `422`, `429`, `502`, or `503` errors. AI is review-first; generated text is persisted as a recommendation and is not automatically applied.

| Method and route | Body / parameters | Success shape |
|---|---|---|
| `GET /api/ai/recommendations` | None | `200 { "success": true, "recommendations": [recommendation...] }` |
| `GET /api/ai/recommendations/:id` | UUID recommendation ID | `200 { "success": true, "recommendation": {...} }` |
| `POST /api/ai/recommendations/:id/accept` | Optional `{ "targetType", "targetId", "field" }`; target values must resolve to a supported owned record when supplied | `200 { "success": true, "recommendation": {...} }` |
| `POST /api/ai/recommendations/:id/reject` | Empty JSON object is accepted by the client | `200 { "success": true, "recommendation": {...} }` |
| `POST /api/ai/recommendations/:id/edit` | `{ "editedText": "Reviewed suggestion text" }`; non-empty | `200 { "success": true, "recommendation": {...} }` |
| `POST /api/ai/improve-summary` | `{ "text": "Draft summary" }`, non-empty, max 20,000 chars | `200` with recommendation `id`, `userId`, `type`, `status`, `original`, `suggestion`, `reasoning` |
| `POST /api/ai/improve-experience` | `{ "experienceId": "<UUID>", "description": "Draft" }`; description non-empty/max 20,000 | `200` with `id`, `userId`, `type`, `status`, `suggestion`, `reasoning` |
| `POST /api/ai/improve-project` | `{ "projectId": "<UUID>", "description": "Draft" }`; description non-empty/max 20,000 | `200` with `id`, `userId`, `type`, `status`, `suggestion`, `reasoning` |
| `POST /api/ai/suggest-skills` | Object containing at least one array property among `experience`, `projects`, `skills` | `200` with `id`, `userId`, `type`, `status`, `existingSkills`, `suggestedSkills`, `suggestion` |
| `POST /api/ai/optimize-cv` | Object containing at least `profile` or an array among `experience`, `projects`, `skills` | `200` with `id`, `userId`, `type`, `status`, section arrays, `suggestions`, and serialized `suggestion` |
| `POST /api/ai/analyze-job-description` | `{ "jobTitle": "Example role", "description": "Role text", "skills": [] }`; title max 200, description max 20,000; skills array required | `200` with `id`, `userId`, `type`, `status`, `matchingSkills`, `missingOrNotEvidenced`, `missingSkills`, `keywords`, `relevantExperience`, `relevantProjects`, `suggestions`, and serialized `suggestion` |

Recommendation IDs are UUID-checked. Recommendation reads/actions are scoped to the current user. For accept, `targetId` is UUID-checked and the target must belong to that user; already processed recommendations return `409`. Invalid recommendation IDs return `400`; missing/not-owned recommendation or target returns `404`; invalid edit/target data may return `422`. Request validation errors for generation endpoints return `400` with `details`. AI API behavior is subject to configured provider availability.

## Protected CV PDF

| Method and route | Input | Success | Errors |
|---|---|---|---|
| `GET /api/cv/pdf` | No body | `200 application/pdf`, attachment filename generated from the account name | `401`; `404 { "error": "CV not found" }` if user/profile absent; unexpected failures return `500` |

PDF content is built server-side from stored profile and career records. CV Builder browser template/section choices are not submitted to this endpoint.

## Cross-cutting behavior

- Express allows JSON bodies up to 1 MB and serves local files under `/uploads`.
- CORS allows the origins listed in `backend/src/app.js`, `FRONTEND_URL`, and `CORS_ORIGINS`; credentials are enabled.
- Most validation errors are `400`; unauthorized is `401`; missing/not-owned resources are `404`; conflicts are `409`; provider and generated-output statuses are described above.
- The API does not include a general user/account deletion endpoint, pagination, or role-based administrator API.

See [System Documentation](./SYSTEM_DOCUMENTATION.md) for setup and [Database Documentation](./DATABASE_DOCUMENTATION.md) for persisted models.
