# AdPulse

Full-stack advertising campaign management platform with Admin, Advertiser and Publisher roles.

## Quick start

1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, `JWT_SECRET`, and optionally Cloudinary / Groq values.
2. Run `npm.cmd run install:all` from the repository root.
3. Run `npm.cmd run seed --prefix server` once to create demo accounts.
4. Run `npm.cmd run dev`.
5. Open `http://localhost:5173`.

## Included platform features

- Role-based Admin, Advertiser, and Publisher workflows.
- Live campaign delivery, publisher earnings, and Socket.IO metric updates.
- Target-aware ad auction using country, age, keywords, bid type, and eCPM.
- Daily analytics charts and downloadable campaign CSV reports.
- Fraud Shield rules for click velocity, unnatural CTR, and self-click activity.
- Admin fraud-alert review and resolution controls.
- AI campaign-brief generation using Groq when configured, with an offline fallback.
- AI performance coach compares the latest two weeks of real campaign/publisher metrics and gives evidence-based actions (metrics-based fallback when Groq is unavailable).
- Demo verification flow, local one-time password-reset links, 24-hour JWTs, and sign-in throttling.

## Free-first project policy

Keep future project changes usable with free tiers or local features; do not add a paid service as a requirement without asking first. This demo intentionally has no email vendor: sign-up displays a one-time demo verification link in the app. This demonstrates the flow but does not prove ownership of the email address. In the deployed free demo, password-reset links are not exposed by the API; contact the project administrator for account recovery. Do not use this no-email setup for public production accounts.

## Local traffic demos

With a local MongoDB connection and test Advertiser/Publisher accounts, generate analytics data with:

```powershell
npm.cmd run simulate --prefix server
```

Generate sample fraud alerts with:

```powershell
npm.cmd run simulate:fraud --prefix server
```

`test-ad.html` is a local publisher-page harness for testing a copied ad tag, live delivery, and fraud rules. Do not use the simulation scripts against production data.

## Deployment

### API on Render

Use the repository's `render.yaml` Blueprint. Set these Render environment variables:

- `MONGODB_URI`: your MongoDB Atlas connection string.
- `CLIENT_URL`: the deployed Vercel web-app URL.
- `AD_SERVER_URL`: the deployed Render API URL, for example `https://adpulse-api.onrender.com`.
- Cloudinary variables only when creative uploads are required.
No email-provider or custom-domain variables are required for the review demo. Sign-up shows a demo verification link in the app; password-reset preview links are available only in local development.

### Web app on Vercel

Import the same repository, choose `client` as the Root Directory, and set:

```env
VITE_API_URL=https://your-render-api.onrender.com/api
```

`client/vercel.json` keeps React routes working when a visitor refreshes or opens a URL directly.
