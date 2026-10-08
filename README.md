# AdPulse

Full-stack advertising campaign management platform with Admin, Advertiser and Publisher roles.

## Quick start

1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, `JWT_SECRET`, and optionally Cloudinary / Groq values.
2. Run `npm.cmd run install:all` from the repository root.
3. Run `npm.cmd run seed --prefix server` once to create demo accounts.
4. Run `npm.cmd run dev`.
4. Open `http://localhost:5173`.

## Deployment

### API on Render

Use the repository's `render.yaml` Blueprint. Set these Render environment variables:

- `MONGODB_URI`: your MongoDB Atlas connection string.
- `CLIENT_URL`: the deployed Vercel web-app URL.
- `AD_SERVER_URL`: the deployed Render API URL, for example `https://adpulse-api.onrender.com`.
- Cloudinary variables only when creative uploads are required.

### Web app on Vercel

Import the same repository, choose `client` as the Root Directory, and set:

```env
VITE_API_URL=https://your-render-api.onrender.com/api
```

`client/vercel.json` keeps React routes working when a visitor refreshes or opens a URL directly.
