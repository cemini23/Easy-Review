# EasyReview Deploy Guide

End-to-end setup to get the v0 paste-flow running for a real operator. Roughly 30 minutes.

This is the operational counterpart to the [v0 plan](superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md). The plan covers what got built; this doc covers how to run it.

## Prereqs

- Node 20+
- A GitHub account
- A Google account (for Gemini API)
- A laptop or wherever you'll run the dev server / deploy from

## Step 1 — Provision PocketBase (5 min)

EasyReview uses PocketBase as its backend (operators table, drafts table, audit_log table). Three paths, pick what fits:

| Path | Cost | When to use |
|------|------|-------------|
| **A. Local binary** | $0 | Evaluating the loop on your laptop. Not always-on, so unsuitable for an operator who'll click during business hours from anywhere. |
| **B. PocketHost (managed)** | $5/mo per instance | Production. Fully managed, daily backups, admin UI, zero DevOps. Trial is 7 days. |
| **C. Self-host on a VPS** | ~$4-6/mo (Hetzner / DigitalOcean / Fly) | You already run a VPS or want to consolidate hosting. More control, more ops work. |

### Option A: Local binary (free, dev/eval)

1. Download the PocketBase binary for your OS from https://pocketbase.io/docs/
2. Run `./pocketbase serve` — it'll print a URL (default `http://127.0.0.1:8090`)
3. Visit `<url>/_/` and create your admin account
4. `POCKETBASE_URL=http://127.0.0.1:8090` for `.env.local`

Caveat: replies you "Post" only commit briefs to GitHub if your laptop is running and reachable. Fine for testing the loop end-to-end; not fine for an operator who needs to triage reviews from a phone.

### Option B: PocketHost ($5/mo, managed)

1. Sign up at https://pockethost.io (7-day trial, then $5/mo per instance on the Starter plan)
2. Create a new instance — pick any subdomain (`easyreview-<yourshop>` works)
3. Note the URL — it'll look like `https://easyreview-yourshop.pockethost.io`
4. Open the admin UI at `<your-url>/_/`
5. Create an admin account when prompted — save the email + password, you'll need them as env vars

### Option C: Self-host on a VPS

1. Provision a small VPS (Hetzner CX11 ~€4/mo, DigitalOcean basic droplet $4/mo, Fly.io shared-CPU ~$2-5/mo depending on usage)
2. Download the PocketBase binary, run behind a reverse proxy (Caddy is easiest for auto-TLS), persist the `pb_data/` directory on a volume
3. Set up nightly backups of `pb_data/` (PocketBase has a built-in `--backupsDir` flag and an admin UI snapshot button)

PocketBase's official deploy guide is at https://pocketbase.io/docs/going-to-production/.

### Create the collections

In the admin UI (`<url>/_/`), create three collections:

**`operators`** (Auth collection):
- `business_name` (text, required)
- `vertical` (select, required, options: `barbershop`, `dental`, `salon`, `gym`, `retail`, `restaurant`, `auto_shop`, `other`)
- `sign_off` (text)
- `services` (json, default `[]`)
- `staff_names` (json, default `[]`)
- `active` (bool, default true)
- `created` (autodate, on create only)
- `updated` (autodate, on create + on update)

**`drafts`** (Base collection):
- `operator` (relation → operators, required, cascadeDelete)
- `review_author` (text, required)
- `review_rating` (number, required, min 1, max 5)
- `review_date` (date, required)
- `review_text` (text, required)
- `category` (text, required)
- `ai_draft` (text)
- `operator_edited_text` (text)
- `status` (select, options: `pending`, `posted`, `skipped`, default `pending`)
- `gbp_review_id` (text)
- `posted_at` (date)
- `brief_status` (text)
- `brief_sha` (text)
- `brief_html_url` (text)
- `created` (autodate, on create only)
- `updated` (autodate, on create + on update)

**`audit_log`** (Base collection):
- `operator` (relation → operators)
- `draft` (relation → drafts)
- `event` (text, required)
- `payload` (json)
- `created` (autodate, on create only)

Set API rules to `@request.auth.id != ""` on all three (superuser-only access for v0).

**Important — PocketBase v0.23+ change.** Older docs assumed `created` and `updated` were auto-added system fields. They are not anymore. You must add them explicitly as `autodate` fields, otherwise sorting by `+created` (which the app does) returns HTTP 400. The schemas above already include them.

**Optional-feature collections.** The Site Health and Schema tabs each need one extra collection. Instead of building them by hand, run the idempotent setup scripts after Step 4 (they read the same `.env.local`):

- `node scripts/add-site-health-schema.mjs` — adds `website_url` / `gbp_place_id` to `operators` and creates `site_health_snapshots`
- `node scripts/add-schema-profiles.mjs` — creates `schema_profiles` (persists the Schema tab's JSON-LD profile across devices)

Both are safe to skip if you don't use those tabs, and safe to re-run.

## Step 2 — Get an LLM API key (2 min)

EasyReview supports a 3-tier provider fallback: **Gemini → Groq → DeepSeek**. Set at least one. If multiple are configured, providers are tried in that order; if a provider returns a rate-limit / 5xx / validation failure, the next one is tried automatically.

| Provider | Free tier? | Get a key |
|----------|-----------|-----------|
| **Gemini** (`gemini-flash-lite-latest`) | Yes — generous daily quota, can exhaust during heavy testing | https://aistudio.google.com/apikey (key starts `AIza...`) |
| **Groq** (`llama-3.3-70b-versatile`) | Yes — much higher per-minute quota than Gemini, comparable quality | https://console.groq.com/keys (key starts `gsk_...`) |
| **DeepSeek** (`deepseek-chat`) | No — pay-as-you-go, very cheap | https://platform.deepseek.com/api_keys (key starts `sk-...`) |

For a single operator's paste flow, **Gemini alone is enough**. For dev / smoke testing where you'll burn through quota fast, add Groq as a fallback. DeepSeek is the paid bottom-tier safety net.

Per-provider model overrides: `GEMINI_MODEL`, `GROQ_MODEL`, `DEEPSEEK_MODEL` env vars.

## Step 3 — Create a fine-scoped GitHub PAT (3 min)

EasyReview commits approved replies back to the wiki repo. It needs the narrowest possible token.

1. Visit https://github.com/settings/tokens?type=beta (Fine-grained tokens — NOT classic)
2. Click "Generate new token"
3. Token name: `easyreview-wiki-writeback`
4. Expiration: 90 days (rotate quarterly)
5. Repository access: **Only select repositories** → choose **only** the wiki repo (e.g. `cemini23/SEO-GEO-B-M-Wiki`)
6. Repository permissions: set **Contents** to **Read and write**. Leave everything else at default (no access).
7. Generate. Copy the token (`github_pat_...`) — you only see it once.

Sanity check: the PAT should NOT have access to your other repos and should NOT have any permissions besides Contents on the one wiki repo. If the EasyReview app got compromised, the blast radius is limited to that one repo.

## Step 4 — Wire up local config (1 min)

```bash
cd easyreview
cp .env.example .env.local
```

Edit `.env.local` with the values from steps 1-3:

```bash
# At least one LLM key required (tried in order: Gemini → Groq → DeepSeek)
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...        # optional fallback
DEEPSEEK_API_KEY=sk-...     # optional fallback

POCKETBASE_URL=https://easyreview-yourshop.pockethost.io
POCKETBASE_ADMIN_EMAIL=admin@yourshop.com
POCKETBASE_ADMIN_PASSWORD=<the password you saved in step 1>
WIKI_GITHUB_OWNER=cemini23
WIKI_GITHUB_REPO=SEO-GEO-B-M-Wiki
WIKI_GITHUB_PAT=github_pat_...
WIKI_GITHUB_BRANCH=main
```

Leave the v1-only OAuth vars blank.

## Step 4.5 — (Optional) Get a Google Maps Platform API key (3 min)

The Site Health tab works without this — you'll see HTTPS, schema, sitemap, robots, and homepage meta signals from your website. Add a key to also see your GBP listing's rating, review count, photos, hours, and your website's PageSpeed Insights score.

1. Go to https://console.cloud.google.com → New Project (or pick an existing one)
2. APIs & Services → Library → enable both **Places API** and **PageSpeed Insights API**
3. APIs & Services → Credentials → Create Credentials → API Key
4. (Recommended) Restrict the key to those two APIs and to your server IP
5. Add to `.env.local`: `GOOGLE_MAPS_API_KEY=...`
6. Add to your operator settings: the GBP `place_id` for your shop. Look it up at https://developers.google.com/maps/documentation/places/web-service/place-id

For a single operator with manual refresh, expect to stay well within the $200/month free credit Google grants on Maps Platform.

## Step 5 — Sync the wiki templates + run the dev server (3 min)

```bash
npm install
npm run sync-wiki   # bakes wiki/concepts/review-response-templates.md into src/data/templates.json
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/onboarding` since no operator exists yet.

Onboard yourself:
- Email: your operator email (matches the brand voice you'll use)
- Business name: e.g. "Barone Cuts"
- Vertical: `barbershop`
- Sign-off: optional (e.g. "— Joey at Barone Cuts")
- Services: comma-separated (e.g. "fade, beard trim, kids cut")
- Staff names: comma-separated (e.g. "Joey, Mike, Tony")

Submit. You should land on the dashboard with an empty drafts list.

## Step 6 — Smoke test the loop (5 min)

This is Task 20 from the v0 plan, deferred until now.

### Test 1 — 5-star specific praise (happy path)

Paste:

```
Author: Mike R.
Rating: 5
Date: 2026-05-07
Text: Joey was great! Got me cleaned up for my brother's wedding next week. Quick fade, beard trim. Will be back.
```

Expected:
- Categorizes as `5star_specific`
- AI drafts a reply mentioning Joey + the wedding context
- Edit / Regenerate / Post buttons available
- Hit **Post** → toast confirms; the wiki repo should have a new commit at `briefs/2026-05-07_<id>.md`
- Verify on GitHub: `https://github.com/<owner>/<repo>/commits/main` shows `add: brief — 2026-05-07_<id>.md`

### Test 2 — 1-star likely fake (boundary discipline)

Paste:

```
Author: Anonymous
Rating: 1
Date: 2026-05-07
Text: Worst place ever do not go.
```

Expected:
- Categorizes as `1star_fake`
- **No AI draft** — the card shows "Don't reply / Flag to GBP / Override" instead
- This is correct: the wiki forbids AI-drafting fake-likely reviews per @concepts/reviews-reputation-management.md
- Click "Don't reply" → draft is skipped, audit_log captures it

### Test 3 — Brief-commit failure (resilience)

Temporarily break `WIKI_GITHUB_PAT` (set to `garbage`) and paste a 5-star review. Approve.

Expected:
- Post action returns `ok: false`
- Amber warning appears in the card: "Brief commit failed: ..."
- audit_log captures the failure
- Operator is not misled into thinking the brief was committed

Restore the PAT after the test.

## Step 7 — Deploy to Vercel (5 min)

For real operator use, deploy somewhere always-on:

```bash
npm i -g vercel  # if not installed
vercel login
vercel --prod
```

When prompted:
- Link to existing project? **No** (first deploy)
- Project name: `easyreview-<yourshop>`
- Framework: auto-detected as Next.js
- Override defaults? **No**

After deploy, set the env vars in the Vercel dashboard (Project → Settings → Environment Variables). Paste the same values from `.env.local`. Re-deploy: `vercel --prod`.

Operator-facing URL: `https://easyreview-<yourshop>.vercel.app`

## Troubleshooting

**Onboarding never completes / redirect loop on `/onboarding`**
PocketBase superuser auth is failing. Verify `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD` exactly. Test directly:
```
curl -X POST -H "Content-Type: application/json" \
  -d '{"identity":"<email>","password":"<password>"}' \
  <POCKETBASE_URL>/api/collections/_superusers/auth-with-password
```
A 200 with a `token` field means auth is fine; check the dev server log for downstream errors instead.

**`HTTP 400 Something went wrong` on `/api/collections/operators/records?sort=+created`**
The `created` / `updated` autodate fields are missing from the collection. PocketBase v0.23+ no longer adds them automatically. Edit the operators (and drafts, audit_log) collections in the admin UI and add `created` / `updated` as `autodate` fields per the Step 1 schemas.

**"Brief commit failed: Resource not accessible by personal access token"**
PAT scope is wrong. Re-create with **Contents: Read and write** and verify the repository is in "Only select repositories" → wiki repo.

**Build succeeds but `/` returns 500 in production**
Check Vercel logs. Most common: missing env var. The build skips runtime env validation; runtime fails when the env is touched.

**`npm run sync-wiki` fails with "wiki/concepts/review-response-templates.md not found"**
Run `git submodule update --init` if the wiki is a submodule, or check that the SYNC_WIKI_PATH env var points to a local clone of the wiki repo. The script reads from a local checkout, not from GitHub.

**Gemini drafts include a URL or phone number**
This is a known anti-pattern the wiki forbids. Check `src/lib/gemini.ts:validateDraft` — it should reject these and trigger a fallback to the example_response. If it's letting them through, file an issue and pin the model version.

## Operating notes

- **Rotation:** rotate the GitHub PAT every 90 days. Set a calendar reminder.
- **Backup:** PocketBase data lives only in PocketHost (or your self-host). Snapshot weekly: `<url>/_/#/settings/backups`. Briefs are durable on GitHub.
- **Cost:** for a single operator, expect ~$5/mo total — PocketHost Starter ($5/mo) is the only paid line; Gemini Flash free tier (1.5K req/day) and Vercel Hobby ($0) cover the rest. Self-hosting PocketBase on an existing VPS drops it to $0 marginal.
- **Wiki ingestion cadence:** monthly, or any time `briefs/*.md` count meaningfully exceeds the last ingest. Run via the prompt at [`prompts/ingest-easy-review-briefs.md`](https://github.com/cemini23/SEO-GEO-B-M-Wiki/blob/main/prompts/ingest-easy-review-briefs.md) in the wiki repo.
- **Adding a second operator:** v0 doesn't ship multi-tenant. To run a second operator, deploy a second instance with a separate PocketBase + GitHub PAT.

## Going to v1

The v1 milestone replaces paste-flow with live GBP API integration:
- OAuth scoping via `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET`
- Token encryption via `TOKEN_ENCRYPTION_KEY`
- Reviews flow in automatically; replies post directly to GBP

v1 is not yet built. The env vars are reserved; the integration code is not.
