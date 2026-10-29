# SpeakUp English

SpeakUp English is a mobile-first English sentence practice app for Turkish speakers. The browser app uses Firebase Authentication and Firestore; Gemini calls and all progress writes run through authenticated Vercel functions.

## 1. Requirements

- Node.js 20 or newer and npm
- A Firebase project with Authentication and Cloud Firestore enabled
- A Google AI Studio API key for the Gemini API
- A Vercel account for hosting and serverless functions

The default model is `gemini-3.8-flash`, listed as a stable Flash model in the [Gemini model guide](https://ai.google.dev/gemini-api/docs/models). Set `GEMINI_MODEL` in Vercel to select another model available to your Google AI project. The model is read from the environment at runtime.

## 2. Create and configure Firebase

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Open **Build → Authentication → Get started → Sign-in method**. Enable **Email/Password** and **Google**. For Google, select the project support email and save.
3. In **Authentication → Settings → Authorized domains**, add the Vercel production domain and your custom domain. Add `localhost` for local development if it is not already listed.
4. Open **Project settings → General → Your apps**, add a Web app, and copy its Firebase configuration.
5. Replace the public `YOUR_…` values in `js/firebase-init.js` with that configuration. The Firebase web configuration is public; it is not an AI secret. Firestore Rules protect user data.
6. Open **Build → Firestore Database**, create a database, then publish the supplied `firestore.rules`. With the Firebase CLI installed and authenticated, run:

   ~~~sh
   firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ~~~

7. Create a service account for the server functions. In Google Cloud IAM, grant it the permissions needed to read/write Firestore and delete Firebase Authentication users (the predefined **Cloud Datastore User** and **Firebase Authentication Admin** roles are a practical starting point). Create a JSON key and keep it outside the repository.

The browser may create the user profile and update only `settings`. It cannot write stats, badges, daily progress, word history, session state, or rate-limit counters. The Firebase Admin SDK in the server functions performs those writes.

## 3. Configure Gemini

Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey). Store it only as the Vercel environment variable `GEMINI_API_KEY`. The browser never receives this value. The server uses Gemini's structured JSON output with `responseMimeType: application/json` and a response schema, validates the result, and retries once if it is malformed.

## 4. Configure Vercel environment variables

Import this repository into Vercel. Under **Project → Settings → Environment Variables**, add these values for Production, Preview, and Development as appropriate:

| Variable | Value |
| --- | --- |
| `GEMINI_API_KEY` | The private Google AI Studio API key |
| `GEMINI_MODEL` | Optional; defaults to `gemini-3.8-flash` |
| `FIREBASE_SERVICE_ACCOUNT` | The complete service account JSON, as one environment variable; preserve the JSON escaping for `private_key` newlines |
| `ALLOWED_ORIGIN` | Exact allowed site origin, such as `https://speakup.example.com`; multiple exact origins may be comma-separated |

Do not set `ALLOWED_ORIGIN` to `*`. For a Vercel Preview deployment, add that exact preview origin as well if you want to test it. Never add service account credentials or Gemini keys to `js/`, HTML files, or commits. `.gitignore` ignores `.env*` while allowing the placeholder `.env.example`.

## 5. Run locally

1. Install dependencies and link the project to Vercel:

   ~~~sh
   npm install
   npx vercel link
   ~~~

2. Add local environment variables in Vercel or create a local `.env.local` from `.env.example`. Use `ALLOWED_ORIGIN=http://localhost:3000` and real server credentials. Keep the file untracked.
3. Start the local Vercel server:

   ~~~sh
   npm run dev
   ~~~

4. Visit `http://localhost:3000`. Create a Firebase user, complete onboarding, and start a lesson.

Run the server-side unit tests with:

~~~sh
npm test
~~~

The unit tests cover XP awards, local-date streak changes (including the UTC date boundary), both rate limits, and Gemini response validation. They do not require live Firebase or Gemini credentials.

## 6. Deploy and connect a custom domain

1. Push the project to a Git repository and import it into Vercel. Vercel serves the static HTML/CSS/ES modules and deploys the files under `api/` as Node serverless functions.
2. Add the four environment variables above, then deploy. A deployment will not complete a lesson until the Firebase web config and server credentials are real and point to the same Firebase project.
3. In Vercel, open **Project → Settings → Domains**, add your domain, and follow the DNS records Vercel displays. DNS values depend on the registrar and Vercel project; use the values shown in the dashboard.
4. Add the production domain to Firebase Authentication's authorized domains and set `ALLOWED_ORIGIN` to the exact `https://` origin. Redeploy after changing environment variables.

## Data and security notes

- `/api/chat` verifies a Firebase ID token on every request. It rejects invalid tokens, limits a learner to 15 AI requests per minute and 300 per UTC day, and rejects empty or over-500-character answers.
- Word selection is from the checked-in level pools in `data/`. Due review words are prioritized; new words are used before future-due learned words.
- XP, streaks, badges, daily progress, attempts, review dates, session state, and rate counters are written with Firebase Admin on the server. The web client can only read its own user data and update validated settings.
- Correct answers earn 10 XP, first-try answers earn 5 extra XP, and reaching the daily goal earns 20 bonus XP. Six server-awarded badges are shown in the sidebar.
- User-facing AI content is inserted with `textContent`; it is displayed as plain text so model output cannot execute as HTML.
- The app screen is hidden behind a Firebase client-side route guard. Because this is a static site, `app.html` itself is a public static asset; Firestore Rules and authenticated APIs enforce data access even if someone requests that file directly.
- Account deletion calls `/api/account`, recursively removes the user's Firestore documents, and deletes their Firebase Authentication account.
- Local-day streaks use the learner's IANA timezone, defaulting to `Europe/Istanbul`. Rate-limit days use UTC. The stored `nextReview` value is a local calendar-date string to avoid daylight-saving boundary drift.

## Project layout

~~~text
index.html, app.html
api/                 Vercel serverless endpoints
css/                 Base styles, themes, and components
data/                A1–B2 word pools (100+ entries each)
js/                  Firebase client, auth, chat, settings, and UI modules
server/              Admin, AI validation, rate limits, learning state, and scoring
tests/               Node.js built-in test suite
firestore.rules      Client read/settings write policy
vercel.json          Hosting headers and function file tracing
~~~
