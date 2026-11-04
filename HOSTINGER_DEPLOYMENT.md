# Deployment Guide: Hostinger Cloud (Node.js Application Manager)

## Architecture Overview
- **Frontend**: Next.js Server Components (SSR) with TypeScript & Tailwind CSS.
- **Backend**: Node.js + Express API (`src/server/`) with TypeScript.
- **Database**: Supabase client strictly integrated inside Express server routes (`src/server/db.ts`).
- **Entry point**: `server.js` (Unified HTTP listener serving both Express API and Next.js SSR).

---

## 1. Hostinger hPanel Configuration

1. Log in to **Hostinger hPanel** &rarr; **Websites** &rarr; **Manage** &rarr; **Node.js**.
2. Set configuration:
   - **Node.js version**: `20.x` or `22.x`
   - **Application Mode**: `Production`
   - **Application Root**: `public_html` (or your subdirectory)
   - **Application Startup File**: `server.js`

---

## 2. Environment Variables in Hostinger

In the Node.js settings under **Environment Variables**, add:
- `NODE_ENV` = `production`
- `PORT` = `3000` (or the port assigned by Hostinger)
- `SUPABASE_URL` = `https://yuzcsbqbnmnwdvyqbkpv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key>`

---

## 3. Build & Run Steps on Hostinger (via SSH / Git)

```bash
cd ~/public_html
git pull origin main
npm install
npm run build
```

Then click **Restart Application** in Hostinger hPanel.

---

## 4. Local Development

Run the unified full-stack dev server:
```bash
npm run dev
```
- App UI (Next.js SSR): `http://localhost:3000`
- Express API endpoints: `http://localhost:3000/api/health`, `http://localhost:3000/api/analytics/overview`
