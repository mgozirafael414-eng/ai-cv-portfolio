# User Manual

## Before you begin

The repository documents a local development application, not a deployed service. A project maintainer must install dependencies, configure PostgreSQL and environment variables, apply migrations, and start both servers. Do not assume a public URL exists. See [System Documentation](./SYSTEM_DOCUMENTATION.md) for setup.

### System requirements

- A modern browser with JavaScript and `localStorage` enabled.
- For a local installation: Node.js/npm and PostgreSQL versions compatible with the package set; exact minimum versions are not specified in the repository.
- A running frontend and backend; a configured database for account and CV data.
- Groq provider credentials are only needed for live AI features.

## Access the application locally

1. Ask the maintainer to complete local setup and start the backend and frontend.
2. Open the Vite development URL shown in the terminal (typically `http://localhost:5173`).
3. If you have not been given a hosted address by the project owner, do not treat the local URL as a deployed service.

## Register and log in

1. Choose **Register** from the sign-in screen.
2. Enter your name, a valid email address, and a password of at least 8 characters and no more than 128 characters.
3. Submit the form. Registration creates the account; it returns to the application flow, but does not itself return a login token.
4. Open **Login**, enter the same email and password, and submit.
5. After successful login, the workspace dashboard appears. The browser stores the access token locally to keep the session active.

## Navigate the dashboard

1. Use the workspace sidebar to open **Overview**, **Profile**, **Education**, **Experience**, **Skills**, **Projects**, or **Certificates**.
2. The overview summarizes saved sections and provides quick links.
3. Use the career tools links for **CV Builder**, **AI Assistant**, and **Portfolio**.
4. On smaller screens, open the navigation menu button to show the sidebar.

## Update profile information

1. Open **Profile**.
2. Enter any supported contact or professional fields: phone, location, headline, bio, LinkedIn URL, GitHub URL, and website URL.
3. Use HTTP or HTTPS for social/website addresses.
4. Save the profile. Optional text fields can be cleared.
5. To add a profile image, select a JPEG, PNG, or WEBP image no larger than 5 MB, then upload it.
6. Use the remove-image action if you want to delete the current profile image.

## Manage education, experience, skills, projects, and certificates

For each collection:

1. Open its dashboard section.
2. Choose the action to add a record and complete the required fields.
3. Use ISO-style date values (`YYYY-MM-DD`) where dates are requested.
4. Save the record. Select an existing record to edit it or remove it.
5. Keep projects' technology names and URLs accurate. URLs must use HTTP or HTTPS.
6. Skills can optionally include a category and proficiency from 0 to 100.

Records are private to the signed-in account in authenticated API operations. Deleting a record removes it from future CV/portfolio output.

## Build and download a CV

1. Add or update the profile and career records that you want included.
2. Open **CV Builder** from the dashboard's Career tools section.
3. Edit the CV title if desired.
4. Choose **Classic**, **Modern**, or **Minimal**.
5. Toggle the available sections: summary, experience, education, skills, projects, certificates, and contact information.
6. Choose **Preview** to inspect the browser-rendered preview; use **Controls** to return to settings.
7. Choose **Download CV PDF** to request a PDF.

The CV Builder's title, template, and section toggles are stored in browser `localStorage` per account and browser. The current PDF endpoint builds a PDF from saved profile and career data; it does not receive the browser's title/template/section settings. Treat the PDF as a separate server-generated output rather than assuming it exactly matches the current preview controls.

## Manage and publish a portfolio

1. Open **Portfolio** from the dashboard.
2. Enter a portfolio title and a slug using lowercase letters, digits, and hyphens; choose **Professional**, **Modern**, or **Minimal**.
3. Choose **Preview** to display the current portfolio preview.
4. Choose **Save** before publishing. The system allows one portfolio per account.
5. Choose **Publish** to make its public URL available. Confirm that the content shown publicly is appropriate.
6. Use **Open public URL** to view the published page. Its browser URL follows `/portfolio/<slug>` on the frontend origin.
7. Choose **Unpublish** and confirm if you want the public route to stop returning the portfolio. Unpublished portfolios return a not-found response to public visitors.

The public portfolio URL uses the configured frontend origin and saved slug, for example `http://localhost:5173/portfolio/safe-example` in local development. Do not use this sample as a real account URL. Public portfolio data includes profile and career content returned by the public endpoint. Review personal contact information before publishing.

## AI Assistant

1. Open **AI Assistant** and choose an action such as summary improvement, experience/project improvement, skill suggestions, CV optimization, or job analysis.
2. For job analysis, enter a job title and description; for experience/project suggestions, select a saved record.
3. Review the generated recommendation. AI use requires a configured provider; otherwise the request may be unavailable.
4. Edit or reject a recommendation as appropriate. Choose **Accept** only after reviewing it for factual accuracy.
5. Check the affected profile or record after accepting.

The AI assistant may make mistakes. Do not accept invented claims, metrics, dates, skills, credentials, employers, or outcomes. Recommendations are stored as AI generation records.

## Security and logout

1. Do not share your password or leave your account signed in on a shared device.
2. Review all sensitive profile data before portfolio publication.
3. Choose **Sign out** in the sidebar or profile menu when finished, especially on a shared device.
4. Sign out removes the browser's saved token and user cache. Clearing browser storage also ends the local browser session.

## Troubleshooting

- **Login fails:** check email/password, network, backend status, and ask the maintainer to verify JWT/database configuration.
- **A section does not load:** refresh and confirm connectivity; a `401` means sign in again.
- **Image rejected:** confirm the real file type is JPG/JPEG, PNG, or WEBP and size is no more than 5 MB.
- **PDF download fails:** ensure a profile exists and ask the maintainer to check the backend logs.
- **AI action unavailable:** the provider may not be configured, may be disabled, or may have a quota/rate-limit issue.
- **Public portfolio is not found:** check the spelling of the slug and confirm publication is on.
- **Frontend cannot connect:** ask the maintainer to verify API URL, backend port, and CORS origins.

## Screenshots to capture later

No screenshots are included because no shared authenticated browser session was available and no browser acceptance run was performed. Recommended captures:

1. Registration/login screen with sample-only data.
2. Dashboard overview with a synthetic account.
3. Profile and career-record edit forms.
4. CV Builder controls and preview in each template.
5. AI recommendation before and after review, using synthetic CV data.
6. Portfolio settings, preview, published state, and public page using synthetic data.
7. PDF output generated from synthetic account content.
