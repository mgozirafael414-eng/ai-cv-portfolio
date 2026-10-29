# UI and User Workflows

## Implemented frontend areas

- Registration and login.
- Authenticated dashboard overview and navigation.
- Profile editing and image upload/removal.
- Education, experience, skills, project, and certificate forms/lists.
- CV Builder with Classic, Modern, and Minimal previews; section toggles; PDF request.
- AI Assistant action forms and recommendation review controls.
- Portfolio configuration, preview, publish/unpublish, and public page.

## Workflow notes

The authenticated workspace and public portfolio are separate views. CV Builder settings are stored in browser `localStorage`; they are not server-persisted or sent with the PDF request. Portfolio public output uses saved profile and career data and should be reviewed for privacy before publication.

## Evidence gaps

No screenshots, usability study, browser acceptance record, accessibility audit, responsive-device test, or formal design-system specification is present in the repository. Recommended screenshots and manual test gaps are listed in [User Manual](./USER_MANUAL.md) and [Testing Report](./TESTING_REPORT.md).
