# Vercel Deployment Guide

This guide details how to deploy the Hospital Supply Chain Management System (HSCMS) as a single unified project on Vercel (static frontend served from `/public` and Express backend running as a serverless function via `/api/index.js`).

---

## 1. Prerequisites

1. A hosted PostgreSQL database instance (e.g., [Neon](https://neon.tech), [Supabase](https://supabase.com), [AWS RDS](https://aws.amazon.com/rds/), or [Render Postgres](https://render.com)).
2. A [Vercel](https://vercel.com) account.
3. Node.js 18+ installed locally.

---

## 2. Remote Database Setup

Before deploying to Vercel, initialize the database schema and seed the initial data against your hosted database. Run the following commands locally pointing to your remote `DATABASE_URL`:

```bash
# Initialize database tables
DATABASE_URL="postgres://<user>:<password>@<host>:<port>/<database>?sslmode=require" npm run db:init

# Seed initial medical supplies, demo users, orders, requests, and disposals
DATABASE_URL="postgres://<user>:<password>@<host>:<port>/<database>?sslmode=require" npm run db:seed
```

> **Note:** The database pool automatically applies SSL (`rejectUnauthorized: false`) when connecting to remote databases with `sslmode=require` or in production.

---

## 3. Environment Variables

Configure the following environment variables in your Vercel Project Settings (**Settings > Environment Variables**):

| Variable Name | Description | Example / Recommended Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:password@ep-xyz.neon.tech/hscms?sslmode=require` |
| `SESSION_SECRET` | Secret key for signing session cookies | Any random 32+ character string (e.g. `openssl rand -hex 32`) |
| `NODE_ENV` | Environment identifier | `production` |
| `DEMO_MODE` | Enables demo accounts banner and helper | `true` |

---

## 4. Deploying to Vercel

### Option A: Using the Vercel CLI

1. Install the Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. Log in to your Vercel account:
   ```bash
   vercel login
   ```

3. Deploy preview:
   ```bash
   vercel
   ```

4. Deploy to production:
   ```bash
   vercel --prod
   ```

### Option B: Using Git Integration (GitHub / GitLab / Bitbucket)

1. Push this repository to your Git provider.
2. In the Vercel Dashboard, click **Add New > Project** and import your repository.
3. Keep default build settings (`vercel.json` automatically configures static files and serverless routes).
4. Add the 4 environment variables listed in Section 3.
5. Click **Deploy**.

---

## 5. Post-Deployment Verification

Verify your live deployment by running the smoke test suite against your Vercel production URL:

```bash
npm run smoke https://<your-project-name>.vercel.app
```

The smoke test will authenticate each of the 5 demo roles, query their respective endpoints, verify role-based access control, and validate vendor data isolation.
