# AdPulse

Full-stack advertising campaign management platform with Admin, Advertiser and Publisher roles.

## Quick start

1. Create a Clerk application, then copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`. Set the MongoDB URI, Clerk keys, and optionally Cloudinary / Groq values.
2. Run `npm.cmd run install:all` from the repository root.
3. Set `CLERK_ADMIN_EMAILS` to the verified Clerk email(s) that should receive the admin role.
4. Run `npm.cmd run dev`.
5. Open `http://localhost:5173` and sign up. Clerk handles password, session, and email verification; AdPulse asks for advertiser or publisher profile details afterward.

## Included platform features

- Role-based Admin, Advertiser, and Publisher workflows.
- Live campaign delivery, publisher earnings, and Socket.IO metric updates.
- Target-aware ad auction using country, age, keywords, bid type, and eCPM.
- Daily analytics charts and downloadable campaign CSV reports.
- Fraud Shield rules for click velocity, unnatural CTR, and self-click activity.
- Admin fraud-alert review and resolution controls.
- AI campaign-brief generation using Groq when configured, with an offline fallback.
- AI performance coach compares the latest two weeks of real campaign/publisher metrics and gives evidence-based actions (metrics-based fallback when Groq is unavailable).
- Clerk-hosted sign-in, sign-up, email verification, account recovery, and session management; MongoDB stores only the AdPulse profile and role linked to the Clerk user ID.

## Free-first project policy

Keep future project changes on free features or free tiers; do not add a paid service or custom domain as a requirement. Clerk offers a free Hobby tier, but its development instance is limited and not recommended for production; Clerk production instances require an associated domain. For this review, use development keys on the existing Vercel URL and do not treat that setup as production-ready. Configure verified Clerk admin email(s) using `CLERK_ADMIN_EMAILS`; users cannot grant themselves administrator access. The existing `adpulse` MongoDB database was cleared as requested, so previous accounts, campaigns, sites, and notifications are gone.

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
- `CLERK_SECRET_KEY`: the secret key from the Clerk application. Keep it only on the server.
- `CLERK_PUBLISHABLE_KEY`: the publishable key from the same Clerk application.
- `CLERK_ADMIN_EMAILS`: comma-separated verified email addresses that should receive the Admin role (for example, your own verified address).
- Cloudinary variables only when creative uploads are required.

### Web app on Vercel

Import the same repository, choose `client` as the Root Directory, and set:

```env
VITE_API_URL=https://your-render-api.onrender.com/api
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
```

For the review deployment without a custom domain, use the matching Clerk development keys (`pk_test_…` and `sk_test_…`) in Vercel and Render. Never expose `CLERK_SECRET_KEY` in Vercel or any `VITE_` variable. Development keys have relaxed security and are for demos, not public production accounts.

`client/vercel.json` keeps React routes working when a visitor refreshes or opens a URL directly.
