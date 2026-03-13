# LinkedIn Intro Finder — Build Guide

Follow these steps in order. Each step builds on the last.

---

## Step 1: Create the GitHub Repo

```bash
# Create a new repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/linkedin-intro-finder.git
cd linkedin-intro-finder
```

Copy all the files from this project into your repo. The structure looks like this:

```
linkedin-intro-finder/
├── src/
│   ├── index.js                  # Express server + cron scheduler
│   ├── config/
│   │   ├── database.js           # PostgreSQL connection pool
│   │   ├── openai.js             # OpenAI client
│   │   ├── unipile.js            # Unipile SDK client
│   │   └── logger.js             # Winston logger
│   ├── middleware/
│   │   └── auth.js               # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js               # Register + login endpoints
│   │   ├── accounts.js           # Connect LinkedIn, list accounts, sync
│   │   ├── search.js             # Semantic + keyword search
│   │   └── webhooks.js           # Unipile webhook handler
│   ├── services/
│   │   ├── embeddingService.js   # OpenAI embedding generation
│   │   ├── searchService.js      # pgvector similarity search
│   │   └── unipileService.js     # Fetch + upsert connections
│   └── jobs/
│       └── dailyReindex.js       # Daily re-sync all accounts
├── frontend/
│   └── index.html                # Single-page app (login + search + accounts)
├── scripts/
│   └── migrate.js                # Database schema creation
├── .github/workflows/
│   ├── deploy.yml                # CI/CD pipeline
│   └── daily-reindex.yml         # Scheduled GitHub Action for daily sync
├── docker-compose.yml            # PostgreSQL (pgvector) + app
├── Dockerfile
├── package.json
├── .env.example
└── .gitignore
```

---

## Step 2: Set Up PostgreSQL with pgvector

**Option A: Docker (recommended for local dev)**

```bash
docker compose up db -d
```

This starts PostgreSQL 16 with the pgvector extension pre-installed.

**Option B: Cloud database**

Use Supabase (free tier includes pgvector), Neon, or Railway PostgreSQL.
After creating the database, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Step 3: Configure Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `UNIPILE_API_KEY` | Unipile dashboard → API Keys |
| `UNIPILE_DSN` | Unipile gives you this (e.g. `https://api1.unipile.com`) |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `JWT_SECRET` | Any random string (use `openssl rand -hex 32`) |

---

## Step 4: Install Dependencies and Run Migration

```bash
npm install
npm run migrate
```

The migration creates 3 tables: `users`, `connected_accounts`, and `connections` (with a vector column for embeddings and an IVFFlat index for fast search).

---

## Step 5: Start the Server

```bash
npm run dev
```

Open http://localhost:3000. You should see the login/register screen.

---

## Step 6: Create Your Account

Register through the UI, or via curl:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword", "name": "Nachi"}'
```

Save the `token` from the response — you'll need it for API calls.

---

## Step 7: Connect a Friend's LinkedIn via Unipile

**From the UI:** Click "+ Connect LinkedIn". This opens Unipile's hosted auth page where your friend signs into their LinkedIn. Once they complete it, Unipile fires a webhook to your app.

**Or manually via API:**

1. Get the connect URL:
```bash
curl http://localhost:3000/api/accounts/connect-url \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. Send that URL to your friend. They sign in to LinkedIn through it.

3. After they connect, register the account:
```bash
curl -X POST http://localhost:3000/api/accounts/connect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"unipile_account_id": "ACCOUNT_ID_FROM_UNIPILE", "linkedin_name": "Friend Name"}'
```

This triggers the initial sync — pulling all their connections and generating embeddings.

---

## Step 8: Search for Introductions

Once the sync completes, search from the UI or via API:

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query": "I want to reach customers of VeriPark. Give me all connections that can make introductions."}'
```

Response:
```json
{
  "query": "I want to reach customers of VeriPark...",
  "count": 12,
  "results": [
    {
      "name": "Jane Smith",
      "headline": "VP Sales at VeriPark",
      "company": "VeriPark",
      "position": "VP Sales",
      "linkedin_url": "https://www.linkedin.com/in/janesmith",
      "introduced_by": "Your Friend's Name",
      "similarity": "0.8234"
    }
  ]
}
```

---

## Step 9: Daily Reindexing

Connections are automatically re-synced in three ways:

1. **In-process cron:** The server runs a reindex at 2:00 AM daily (see `src/index.js`)
2. **GitHub Action:** `.github/workflows/daily-reindex.yml` runs at 7:00 AM UTC daily
3. **Manual:** Run `npm run reindex` or click "Sync now" in the UI

For the GitHub Action to work, add these secrets in your repo settings (Settings → Secrets → Actions):
- `DATABASE_URL`
- `UNIPILE_API_KEY`
- `UNIPILE_DSN`
- `OPENAI_API_KEY`

---

## Step 10: Deploy

**Railway (easiest):**
1. Push your repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add a PostgreSQL service (enable pgvector extension)
4. Set your environment variables
5. Railway auto-deploys on every push to `main`

**Render:**
1. Create a Web Service from your GitHub repo
2. Add a PostgreSQL database
3. Set environment variables
4. Enable auto-deploy

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/accounts` | List connected LinkedIn accounts |
| GET | `/api/accounts/connect-url` | Get Unipile OAuth URL |
| POST | `/api/accounts/connect` | Register a connected account |
| POST | `/api/accounts/:id/sync` | Trigger manual sync |
| POST | `/api/search` | Semantic search (main feature) |
| GET | `/api/search/keyword?q=VeriPark` | Keyword fallback search |
| GET | `/api/health` | Health check |

---

## Cost Estimate

| Service | Cost |
|---|---|
| Unipile | ~$55/mo for up to 10 accounts |
| OpenAI embeddings | ~$0.02 per 1M tokens (~$0.10 to embed 10K connections) |
| Railway/Render hosting | Free tier or ~$5/mo |
| PostgreSQL | Free tier (Supabase/Neon) or included with Railway |
| **Total** | **~$55–65/mo** |
