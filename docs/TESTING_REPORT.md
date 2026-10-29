# Testing Report

## Objectives and scope

This report distinguishes executed automated checks from browser or external-provider testing. The evidence below was collected in the current workspace during documentation preparation. It is not evidence of production operation or complete test coverage.

## Test environment and tools

- Backend: Node.js built-in `node:test` runner, invoked by `npm test --prefix backend`.
- Frontend: Vite production build and ESLint, invoked by the frontend package scripts.
- Database schema: Prisma CLI validation, invoked from the root package script with a non-secret placeholder `DATABASE_URL`.
- Backend test files start an ephemeral local HTTP server and stub Prisma model methods; AI tests enable the project's Groq mock mode. These tests do not establish correctness against a live production database or live Groq account.
- Specific Node.js and PostgreSQL versions were not recorded for this run.

## Executed automated checks

| Test ID | Feature | Steps/input | Expected result | Actual result | Status | Evidence |
|---|---|---|---|---|---|---|
| AUTO-01 | Backend automated suite | `npm test --prefix backend` | All configured Node tests complete successfully | 304 tests; 304 passed, 0 failed, 0 skipped; 32 suites; duration reported 7,643.8598 ms | PASS | Test runner output; source tests in `backend/test/*.test.js` |
| AUTO-02 | Frontend production build | `npm run build --prefix frontend` | Vite creates frontend build without errors | Build succeeded; 37 modules transformed | PASS | Vite command output |
| AUTO-03 | Frontend lint | `npm run lint --prefix frontend` | ESLint exits successfully | Exited with code 0; no diagnostics printed | PASS | ESLint command output |
| AUTO-04 | Prisma schema validation | `npm run prisma:validate` with a local placeholder `DATABASE_URL` | Prisma accepts the schema configuration | “The schema ... is valid” | PASS | Prisma CLI output |
| AUTO-05 | Prisma validation without connection variable | Initial `npm run prisma:validate` without `DATABASE_URL` | Validation needs the schema's configured environment variable | Failed with P1012, missing `DATABASE_URL`; rerun with placeholder passed | EXPECTED ENVIRONMENT BLOCK | Prisma CLI output |

The placeholder URL was used only for schema validation; no database reset, migration application, or live database test was performed.

## Test inventory and coverage evidence

Automated files present:

- `auth.test.js`: registration/login validation, token and user responses, authentication failures.
- `authorization.test.js`: cross-user read/write/recommendation ownership checks.
- `cv-data.test.js`: career-resource authentication, CRUD, ownership, and validation.
- `profile.test.js`: profile and profile-image behavior.
- `portfolio.test.js`: portfolio creation, publication state, and public access.
- `ai.test.js`: AI suggestion/recommendation workflows and provider outcomes.
- `ai-security.test.js`: prompt-injection handling, generated content, recommendation ownership, provider failures, and review-first behavior.
- `pdf.test.js`: authenticated PDF generation and owner isolation.
- `input-validation.test.js`: validation and CORS edge cases.

These are API/service-focused automated tests. Several test suites replace Prisma methods with in-memory test doubles; AI provider responses are mocked. A test count is not a code-coverage percentage, and no coverage report was generated.

## Representative test cases evidenced in source

| Test ID | Feature | Steps/input | Expected result | Actual result | Status | Evidence |
|---|---|---|---|---|---|---|
| CASE-01 | Authentication | Request protected endpoint without a token | `401` authentication required | Included in auth/profile/PDF test suites; full suite passed | PASS (automated) | `auth.test.js`, `profile.test.js`, `pdf.test.js` |
| CASE-02 | Password/account security | Attempt duplicate registration and invalid credentials | Duplicate rejected; bad/missing account returns safe authentication failure | Covered by auth tests; full suite passed | PASS (automated) | `auth.test.js` |
| CASE-03 | Ownership | User B attempts to read/update/delete User A records or AI recommendations | No access; non-owned resources are not disclosed as owned | Included cross-user cases; full suite passed | PASS (automated) | `authorization.test.js`, `cv-data.test.js`, `ai-security.test.js` |
| CASE-04 | Profile CRUD/upload | Create/partially update profile and test invalid fields/image actions | Valid owner actions succeed; invalid input is rejected | Covered in profile suite; full suite passed | PASS (automated) | `profile.test.js` |
| CASE-05 | Career CRUD | Create/list/update/delete career records and submit invalid IDs/dates/URLs | Owner-scoped operations and validation responses | Covered in CV-data/input-validation suites; full suite passed | PASS (automated) | `cv-data.test.js`, `input-validation.test.js` |
| CASE-06 | CV PDF | Request PDF unauthenticated, as owner, and as another user | Protected, owner-specific PDF response | Covered by PDF tests; full suite passed | PASS (automated) | `pdf.test.js` |
| CASE-07 | Portfolio publication | Create portfolio and switch publication state; request public slug | Published content available; unpublished/invalid slug not found | Covered by portfolio tests; full suite passed | PASS (automated) | `portfolio.test.js` |
| CASE-08 | AI review/security | Generate, edit, accept/reject recommendation; test ownership, injection, and unsafe/provider responses | Owner-scoped, review-first operations; unsafe outputs rejected | Covered by AI suites; full suite passed with mocked provider | PASS (automated/mock) | `ai.test.js`, `ai-security.test.js` |

## Manual testing and unexecuted checks

- **Authenticated browser testing:** not executed; no shared browser session or recorded browser test output was available.
- **Cross-browser/mobile usability testing:** not executed.
- **Live PostgreSQL integration/migration application:** not executed. Prisma schema validation alone is not a database integration test.
- **Live Groq provider testing:** not executed. Passing AI tests use mock mode.
- **Security testing/penetration testing:** not executed. Automated security-focused test cases are not a security audit or certification.
- **Accessibility audit:** not executed.
- **Deployment, production smoke test, backups, monitoring, performance/load testing:** not executed or evidenced.
- **PDF visual inspection:** not evidenced by a browser/manual output capture.

## Bugs, limitations, and follow-up

- The second checked-in migration adds non-null `ai_generations.updated_at` without a database default; its SQL notes this can fail if the table is populated. Review and plan data-safe remediation before applying to populated databases.
- CV Builder preview layout/section settings are browser-local, but PDF generation uses server-side stored data and does not receive those settings.
- Public portfolios intentionally expose the relations returned by the public API; privacy review is required before publication.
- Hosted deployment and production configuration are unknown.
- Add repeatable live-database migration tests and browser acceptance tests when a safe test environment and synthetic account are available.

## Summary

The backend automated suite, frontend build, frontend lint, and Prisma schema validation passed in this run. The first schema-validation attempt correctly failed because `DATABASE_URL` was absent; validation passed after setting a non-secret placeholder. No database was changed. No browser, live provider, production, performance, or security-audit result is claimed.
