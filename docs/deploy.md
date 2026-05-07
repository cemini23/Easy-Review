# EasyReview Deploy Guide

End-to-end setup to get the v0 paste-flow running for a real operator. Roughly 30 minutes.

This is the operational counterpart to the [v0 plan](superpowers/plans/2026-05-07-easyreview-seogeo-v0-paste-flow.md). The plan covers what got built; this doc covers how to run it.

## Prereqs

- Node 20+
- A GitHub account
- A Google account (for Gemini API)
- A laptop or wherever you'll run the dev server / deploy from

## Step 1 — Provision PocketBase (5 min)

EasyReview uses PocketBase as its backend (operators table, drafts table, audit_log table). Easiest path is the hosted free tier; self-host is also fine.

### Option A: PocketHost (free tier)

1. Sign up at https://pockethost.io
2. Create a new instance — pick any subdomain (`easyreview-<yourshop>` works)
3. Note the URL — it'll look like `https://easyreview-yourshop.pockethost.io`
4. Open the admin UI at `<your-url>/_/`
5. Create an admin account when prompted — save the email + password, you'll need them as env vars

### Option B: Self-host

1. Download the PocketBase binary for your OS from https://pocketbase.io/docs/
2. Run `./pocketbase serve` — it'll print a URL (default `http://127.0.0.1:8090`)
3. Visit `<url>/_/` and create your admin account

### Create the collections

In the admin UI (`<url>/_/`), create three collections:

**`operators`** (Auth collection):
- `business_name` (text, required)
- `vertical` (select, required, options: `barbershop`, `dental`, `salon`, `gym`, `retail`, `restaurant`, `auto_shop`, `other`)
- `sign_off` (text)
- `services` (json, default `[]`)
- `staff_names` (json, default `[]`)
- `active` (bool, default true)

**`drafts`** (Base collection):
- `operator` (relation → operators, required)
- `review_author` (text, required)
- `review_rating` (number, required)
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

**`audit_log`** (Base collection):
- `operator` (relation → operators)
- `draft` (relation → drafts)
- `event` (text, required)
- `payload` (json)

Set API rules to `@request.auth.id != ""` on all three (admin-only access for v0).

## Step 2 — Get a Gemini API key (2 min)

1. Visit https://aistudio.google.com/apikey
2. Click "Create API key"
3. Copy the key — starts with `AIza...`

The free tier is generous; v0's paste flow will not exhaust it for a single operator.

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
GEMINI_API_KEY=AIza...
POCKETBASE_URL=https://easyreview-yourshop.pockethost.io
POCKETBASE_ADMIN_EMAIL=admin@yourshop.com
POCKETBASE_ADMIN_PASSWORD=<the password you saved in step 1>
WIKI_GITHUB_OWNER=cemini23
WIKI_GITHUB_REPO=SEO-GEO-B-M-Wiki
WIKI_GITHUB_PAT=github_pat_...
WIKI_GITHUB_BRANCH=main
```

Leave the v1-only OAuth vars blank.

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
PocketBase admin auth is failing. Verify `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD` exactly. Test by curling `<url>/api/admins/auth-with-password` with your creds.

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
- **Cost:** PocketHost free tier + Gemini free tier + Vercel free tier = $0/mo for a single operator. Scale would push PocketHost into a paid tier (~$5/mo) first.
- **Wiki ingestion cadence:** monthly, or any time `briefs/*.md` count meaningfully exceeds the last ingest. Run via the prompt at [`prompts/ingest-easy-review-briefs.md`](https://github.com/cemini23/SEO-GEO-B-M-Wiki/blob/main/prompts/ingest-easy-review-briefs.md) in the wiki repo.
- **Adding a second operator:** v0 doesn't ship multi-tenant. To run a second operator, deploy a second instance with a separate PocketBase + GitHub PAT.

## Going to v1

The v1 milestone replaces paste-flow with live GBP API integration:
- OAuth scoping via `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET`
- Token encryption via `TOKEN_ENCRYPTION_KEY`
- Reviews flow in automatically; replies post directly to GBP

v1 is not yet built. The env vars are reserved; the integration code is not.
