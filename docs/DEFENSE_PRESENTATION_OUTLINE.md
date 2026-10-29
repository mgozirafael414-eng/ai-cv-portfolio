# Defense Presentation Outline

Suggested concise defense: 10–12 slides, adjusted to the institution's time limit. Do not present placeholder content as a result.

## Slide 1 — Title

- AI-Powered Dynamic Web CV and Portfolio Management System
- Student, registration number, department, institution, supervisor: `[TO BE PROVIDED BY STUDENT]`
- Date: `[TO BE PROVIDED BY STUDENT]`
- **Visual:** title slide; no fabricated institutional branding.

## Slide 2 — Background and problem

- Professional data may be repeated across separate documents.
- The project centralizes profile and career records and reuses them in CV/portfolio workflows.
- No comparative user study or measured improvement is claimed.
- **Visual:** simple “separate data → centralized records” diagram.

## Slide 3 — Objectives and scope

- Account-scoped profile/career management.
- CV preview/PDF, portfolio publishing, optional review-first AI.
- State what is implemented and what remains unverified.
- **Visual:** objective-to-module mapping.

## Slide 4 — Architecture

- React/Vite client → Express API → Prisma → PostgreSQL.
- Optional Groq API, PDFKit output, local profile-image storage.
- Public visitor route is separate from authenticated operations.
- **Visual:** use the architecture diagram from [System Documentation](./SYSTEM_DOCUMENTATION.md).

## Slide 5 — Database design

- User, Profile, Education, Experience, Skill, Project, Certificate, Portfolio, AIGeneration.
- One-to-one profile/portfolio; one-to-many career and AI-generation records.
- Cascading user deletion and unique email/slug constraints.
- **Visual:** ER diagram from [Database Documentation](./DATABASE_DOCUMENTATION.md).

## Slide 6 — Authentication and API

- bcrypt password hashes; JWT bearer access token; owner ID derived from verified token.
- Validation and owner checks protect CRUD endpoints.
- Public API returns only a published portfolio slug.
- **Visual:** request flow from login to protected API.

## Slide 7 — Main user workflows

- Profile and career record maintenance.
- CV preview templates, section toggles, PDF download.
- Portfolio save, preview, publish/unpublish, public URL.
- **Visual:** capture screenshots using synthetic data; screenshots are not currently available.

## Slide 8 — AI implementation status

- Groq-backed summary/experience/project improvements, skill suggestions, CV optimization, and job analysis exist in source.
- Suggestions are stored and require review; accepting is explicit.
- Mock-provider tests exist; live provider configuration/behavior is unverified.
- **Visual:** synthetic recommendation review flow, not a fabricated live response.

## Slide 9 — Testing and evidence

- Backend suite: 304 passed, 0 failed in the recorded run.
- Frontend build and lint passed.
- Prisma schema validation passed with placeholder connection URL.
- No live DB migration, live AI call, authenticated browser run, or production test.
- **Visual:** test report table; avoid unverified coverage claims.

## Slide 10 — Limitations and risks

- Deployment status unknown; local storage used for token/settings.
- PDF uses saved server data and does not inherit CV preview settings.
- Public portfolio makes returned relations public.
- Required `updated_at` migration caveat; safe populated-database migration needs planning.

## Slide 11 — Conclusion and future work

- Implemented the central account-owned CV/portfolio workflow.
- Future: safe migration testing, browser/accessibility tests, privacy review, live AI validation, production operations, and user evaluation.

## Slide 12 — Demonstration and questions

Demonstrate only if a working local environment and synthetic account are available:

1. Sign in; show dashboard.
2. Edit one synthetic profile/career item.
3. Preview CV and download PDF.
4. Show AI workflow only if provider/mock setup is known; label mock output.
5. Save, publish, and open a synthetic portfolio; unpublish and show unavailable state.
6. Questions.

Do not expose real personal records, credentials, database URLs, or provider keys during the defense.
