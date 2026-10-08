# Deploying AdPulse

AdPulse uses two services:

- **Vercel** hosts the React web application in `client`.
- **Render** hosts the Express API in `server`.
- **MongoDB Atlas** remains the database.

## 1. Publish the code

Create a GitHub repository and push this project. Do not upload `server/.env`.

## 2. Deploy the API to Render

1. In Render, choose **New +** → **Blueprint** and select the GitHub repository.
2. Render detects `render.yaml` and creates `adpulse-api`.
3. Add these environment variables in the service settings:

   ```env
   MONGODB_URI=your MongoDB Atlas connection string
   CLIENT_URL=https://your-vercel-project.vercel.app
   AD_SERVER_URL=https://your-render-api.onrender.com
   ```

4. Optionally add Cloudinary variables for banner uploads:

   ```env
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   ```

5. Deploy and open `https://your-render-api.onrender.com/api/health`. It should return `{ "status": "ok" }`.

## 3. Deploy the web app to Vercel

1. In Vercel, choose **Add New Project** and import the same GitHub repository.
2. Set **Root Directory** to `client`.
3. Add the environment variable below before deploying:

   ```env
   VITE_API_URL=https://your-render-api.onrender.com/api
   ```

4. Deploy. Copy the Vercel URL into Render as `CLIENT_URL`, then redeploy the Render service once.

## 4. Verify production

1. Register an Advertiser and a Publisher.
2. Sign in as an Admin and approve their accounts.
3. Create a campaign with a public banner image and landing-page URL, then approve it.
4. Register and approve a Publisher website.
5. Copy its ad script into a test HTML page. Confirm impressions, clicks, spend, and publisher earnings change.

## Improving AdPulse

1. Add transactional email using Resend, Postmark, or SendGrid for approval, password-reset, and budget alerts.
2. Add rate limiting, request validation with Zod, Helmet security headers, and audit logs.
3. Implement email verification before enabling new accounts.
4. Add a real click-fraud service using Redis to detect repeated IP/device clicks.
5. Use Redis with Socket.IO for scalable real-time dashboard updates.
6. Add Stripe or Razorpay for advertiser payments and publisher payouts.
7. Add a background-job system such as BullMQ for scheduled campaign activation/completion and report generation.
8. Add Sentry error monitoring and PostHog product analytics.
9. Integrate Groq or Gemini for genuine AI campaign copy and analysis.
10. Add automated tests with Vitest, React Testing Library, Supertest, and Playwright.
