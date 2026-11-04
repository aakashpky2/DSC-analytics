# Deployment Guide: Hostinger Cloud (Node.js Application Manager)

This single full-stack web app runs Next.js (React frontend + API backend routes) talking directly to Supabase via server-side credentials.

---

## 1. Hostinger hPanel Configuration

1. In **Hostinger hPanel**, navigate to **Websites** &rarr; **Manage** &rarr; **Node.js**.
2. Click **Create Application** (or manage existing):
   - **Node.js version**: `20.x` or `22.x`
   - **Application Mode**: `Production`
   - **Application Root**: `public_html` (or your project subfolder, e.g. `public_html/dsc-analytics`)
   - **Application Startup File**: `server.js` (Already prepared in repository root)

---

## 2. Environment Variables in Hostinger

In the Node.js application settings under **Environment Variables**, add:
- `NODE_ENV` = `production`
- `PORT` = `3000` (or the port Hostinger assigns)
- `SUPABASE_URL` = `https://yuzcsbqbnmnwdvyqbkpv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `your_secret_supabase_key`

> ⚠️ Note: Neither `SUPABASE_URL` nor the key are exposed to client browsers.

---

## 3. Deployment Steps via Git / SSH

### Option A: Via Hostinger Git Integration
1. Go to **Git** in hPanel.
2. Connect your repo: `https://github.com/aakashpky2/DSC-analytics.git`
3. Branch: `main`
4. Directory: `public_html`

### Option B: Via SSH Terminal
```bash
cd ~/public_html
git pull origin main
npm install --production=false
npm run build
```

Then in Hostinger hPanel Node.js section, click **Restart Application**.

