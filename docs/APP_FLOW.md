# Application Flow

This flow reflects current routes and frontend workflows:

1. A visitor registers through `/register` or logs in through `/login`.
2. The frontend stores the returned login token in browser `localStorage` and loads the authenticated workspace.
3. The user manages profile, education, experience, skills, projects, and certificates through protected API routes.
4. CV Builder loads saved data for a browser preview; user can select a template, toggle sections, and request a separate server-generated PDF.
5. Optional AI requests use stored CV context and persist recommendations; user may edit, accept, or reject them. No recommendation is intended to change stored CV content without acceptance.
6. User configures and saves one portfolio, then publishes or unpublishes it.
7. Public visitors open the frontend route `/portfolio/:slug`; its API request returns the public portfolio only when published.

The API endpoint list and precise route contracts are in [API Documentation](./API_DOCUMENTATION.md). Deployment and browser validation are not established by this flow description.
