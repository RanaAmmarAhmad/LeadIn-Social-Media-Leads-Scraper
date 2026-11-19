# Leadin

Leadin is a social-media freelance lead discovery workspace. Search for public posts that may indicate a hiring need, qualify prospects with Gemini, organize results in a lead sheet, and export or send selected leads as Gmail alerts.

## Features

- Discover public freelance opportunities on LinkedIn, Facebook, X, Reddit, or a custom URL using Gemini and Google Search grounding.
- Search Reddit directly, or import post data from the Leadin Chrome extension or pasted feed content.
- Extract a consistent lead record: account, date, work, post, link, and contact.
- Score prospects with Gemini, review AI rationales and suggested pitches, and tag leads for follow-up.
- Save campaigns, leads, and alert history to Firestore under the signed-in user's account.
- Export lead lists to Excel and PDF.
- Configure a score threshold and send confirmed prospect alerts through Gmail.
- Download the Chrome extension package from the workspace.

> Leadin discovers public posts and processes imported content; it is not an authenticated scraper for private or logged-in social-media content. Check each platform's terms and applicable laws before using it.

## Requirements

- Node.js and npm
- A Firebase project with Authentication and Firestore configured
- A Gemini API key with access to the Gemini model and Google Search grounding used by the app
- A Google account for sign-in; Gmail alerts also require Gmail API access

## Getting started

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a Firebase web app and copy the placeholder configuration:

   ```sh
   cp firebase-applet-config.example.json firebase-applet-config.json
   ```

   Replace the placeholder values in `firebase-applet-config.json` with your Firebase web app configuration, including the Firestore database ID. This local runtime file is intentionally ignored by Git.

3. Configure Firebase Authentication:

   - Enable Google as a sign-in provider.
   - Add your local development URL (usually `http://localhost:3000`) to the authorized domains.
   - Configure the OAuth consent screen and Gmail API access if you plan to send alerts. The app requests the `gmail.send` OAuth scope.

4. Configure Firestore:

   - Create the database specified by `firestoreDatabaseId`.
   - Deploy the included security rules to your Firebase project:

     ```sh
     firebase deploy --only firestore:rules
     ```

5. Set the Gemini API key in `.env.local`:

   ```dotenv
   GEMINI_API_KEY=your_gemini_api_key
   ```

   The key is used by the server, not the browser bundle. Do not commit `.env.local` or share API keys. `APP_URL` may also be set when running behind a deployed service.

6. Start the development server:

   ```sh
   npm run dev
   ```

   Open the local URL printed by the server (normally `http://localhost:3000`).

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production frontend build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run the TypeScript compiler without emitting files |

## Using Leadin

1. Sign in with Google.
2. In **Scrape Console**, choose a platform, date range, and keywords, then launch a search. For imported data, open **Import Extension JSON / Paste Feed** and paste content or upload a JSON file.
3. Review scored prospects in **Lead Sheet**. Filter by campaign, update statuses and tags, or inspect a lead for its rationale and suggested pitch.
4. Export the visible leads to Excel or PDF.
5. Set the alert recipient and score threshold in **Gmail Alerts**. Connect Google/Gmail, review the confirmation dialog, and confirm before sending an email.
6. To use the browser extension, download its ZIP from **Chrome Extension**, extract it, then load the extracted folder as an unpacked extension in Chrome.

## Security

- `firebase-applet-config.json` is excluded from Git; use `firebase-applet-config.example.json` as a local template.
- Keep Gemini API keys in `.env.local` or your hosting provider's secret manager. Never commit credentials, service-account files, or OAuth client secrets.
- Firestore access is governed by [firestore.rules](./firestore.rules). Review the rules and [security_spec.md](./security_spec.md) before deploying changes.
- Gmail access tokens are held in memory by the app and are not written to browser storage.
"# LeadIn-Social-Media-Leads-Scraper" 
