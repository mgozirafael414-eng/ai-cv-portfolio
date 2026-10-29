# Defense Q&A

Answers below are grounded in the repository and recorded checks. Replace student-specific placeholders and adapt to the actual defense setup.

## Architecture and requirements

### 1. What does the system do?

It lets an account owner manage professional profile and career data, preview a CV, download a PDF, configure and publish a portfolio, and optionally request AI-generated recommendations. The AI integration is implemented in source, but live-provider operation has not been verified.

### 2. Why separate the frontend and backend?

The repository has a React/Vite frontend and an Express API with separate package manifests and commands. This separates browser presentation from server-side validation, authorization, persistence, and PDF generation. The codebase does not include a measured comparison showing that this architecture outperforms alternatives.

### 3. How were the requirements gathered?

No interviews, questionnaires, or formal requirements-gathering records are included in the repository. The documentation derives functional requirements from implemented routes, UI pages, and schema. The actual student process should be stated as `[TO BE PROVIDED BY STUDENT]`.

### 4. Which methodology did you use?

No named methodology or iteration record is evidenced in the repository. The student should explain the real development process used rather than claim a methodology from the code alone.

## Database and API

### 5. Which entities are stored?

The Prisma schema defines User, Profile, Education, Experience, Skill, Project, Certificate, Portfolio, and AIGeneration. There is no separate CV-document model in the schema; CV preview settings are kept in browser local storage.

### 6. What relationships and deletion behavior exist?

Profile and Portfolio are one-to-one with User because each `userId` is unique. Career records and AI generations are one-to-many. Their foreign keys specify cascade on user deletion and update. AI target IDs are strings, not foreign keys.

### 7. How do you enforce ownership?

JWT middleware verifies the bearer token and stores the subject as the request's user ID. Services query or create records using that user ID and check ownership before mutation. Client-provided ownership IDs are rejected or excluded. Tests include cross-user access attempts.

### 8. Which APIs are public?

`GET /health`, registration/login, and `GET /api/public/portfolio/:slug` are unauthenticated. The public portfolio route returns content only when the matching portfolio is published. Authenticated API routes require a bearer token.

### 9. Is there an API specification?

There is no OpenAPI/Swagger file or documented Swagger route in the repository. The route and request/response inventory is in `docs/API_DOCUMENTATION.md`.

## Authentication and security

### 10. How are passwords protected?

The authentication service hashes passwords with bcryptjs using 12 salt rounds and compares submitted passwords to hashes. Password hashes are not included in the safe user response.

### 11. How does login persistence work?

Login returns a signed JWT. The frontend stores it in `localStorage` and sends it as a bearer token. A 401 clears the saved client authentication. The token expiration defaults to one hour unless configured otherwise.

### 12. Is the system secure for production?

No production security certification is claimed. Source includes password hashing, JWT verification, owner checks, validation, CORS controls, and upload constraints, and automated security-focused tests pass. Deployment TLS, production secret management, formal penetration testing, monitoring, and privacy/retention review are not evidenced.

### 13. What information becomes public when a portfolio is published?

The public endpoint returns portfolio details and the selected safe user identity with profile, education, experience, skills, projects, and certificates. Review profile contact and career data before publishing. Account email is not included in the public safe-user selection.

## CV Builder and portfolio

### 14. How does CV generation work?

The browser loads the account's data and renders one of three templates with togglable sections. The PDF endpoint independently reads saved profile and career data and creates a PDF with PDFKit. It currently does not receive the browser template, title, or section choices.

### 15. What happens when a portfolio is unpublished?

The stored publication flag becomes false. The public API returns 404 for an unpublished portfolio, so the public route no longer returns its portfolio payload.

### 16. How are public portfolio URLs formed?

The frontend constructs a browser URL from its current origin and `/portfolio/<slug>`. The backend API data route is `/api/public/portfolio/:slug`. A hosted frontend origin has not been supplied.

## AI implementation

### 17. What does “AI-powered” mean here?

The backend uses `groq-sdk` for optional summary, experience/project writing suggestions, skill suggestions, CV optimization, and job-description analysis. It persists recommendation records and has explicit edit/accept/reject operations. It does not mean the system automatically writes all generated text into a CV.

### 18. Has the AI been tested?

The automated AI tests use mock mode and test recommendation, validation, ownership, prompt-injection handling, and provider-failure behavior. A live Groq key/model call was not executed in the documented run.

### 19. How do you reduce invented AI claims?

Prompts instruct the model not to invent facts; output checks reject unsupported links/numbers and certain unsupported claims, and suggestions require user review. These safeguards reduce some risks but do not guarantee factual correctness. Users must verify every claim.

### 20. Does the system send personal CV data to an external provider?

When live AI is configured, the backend builds prompts from the authenticated user's stored CV context and sends relevant context to the configured Groq service. The user/deployer should review provider data handling and obtain any required consent before using real personal data. The live integration was not exercised in the recorded test run.

## Testing and results

### 21. What tests were run?

The backend Node test suite ran 304 tests successfully across 32 suites. Frontend build and lint passed. Prisma schema validation passed with a placeholder `DATABASE_URL`. See `docs/TESTING_REPORT.md`.

### 22. Were browser tests performed?

No authenticated browser acceptance run was available or recorded. The automated tests send HTTP requests to a locally started Express app; they do not prove browser workflow usability.

### 23. Was a live database or migration tested?

No migration was applied to a live database. Schema validation checks the Prisma schema configuration, not connection health or data migration behavior.

### 24. What migration risk was identified?

The second migration adds a required `updated_at` column to `ai_generations` without a default. Its own SQL warning notes this can fail on a populated table. Before applying to existing data, the migration must be reviewed and planned with a backup and appropriate data-safe strategy.

## Trade-offs, limitations, and future work

### 25. Why store CV Builder settings locally?

The current UI stores template/title/section choices in browser `localStorage` keyed by user ID. This is straightforward for local per-browser preferences, but does not synchronize settings across devices and is not modeled as server-persisted CV data.

### 26. What is the most important next step?

Before any production claim, run safe migration validation against a representative database, perform authenticated browser acceptance tests, verify the live AI integration with non-sensitive synthetic data, and complete privacy/security and deployment reviews.

### 27. What evidence supports the project's conclusion?

The evidence is the implementation source, two Prisma migration files, nine backend test files and the current passing run, frontend build/lint output, and Prisma schema validation output. There is no user study, production deployment, live-provider result, or browser acceptance evidence.
