# Product Requirements and Current Scope

## Product

**AI-Powered Dynamic Web CV and Portfolio Management System**

## Current implemented capabilities

- Account registration/login and bearer-token protected workspace.
- Professional profile and profile-image management.
- CRUD for education, experience, skills, projects, and certificates.
- CV preview with three client-side templates and section toggles; server-generated PDF download.
- One portfolio per user with title, slug, template, preview, publish/unpublish, and public lookup.
- Optional Groq-based writing/skills/CV/job-description suggestions with persisted review-first recommendations.

## Boundaries and limitations

The source does not establish a deployed service, live AI provider test, authenticated browser acceptance, user research, or production operational setup. AI output is a suggestion, not verified fact. Public portfolio output includes profile/career relations; users must review data before publishing. CV Builder browser preferences are local to the browser and are not passed to PDF generation.

## References

For detailed requirements and implementation status, see [System Documentation](./SYSTEM_DOCUMENTATION.md). For routes and validation, see [API Documentation](./API_DOCUMENTATION.md); for observed test outcomes, see [Testing Report](./TESTING_REPORT.md).
