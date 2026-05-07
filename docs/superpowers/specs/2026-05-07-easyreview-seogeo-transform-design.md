# EasyReview — SEO/GEO Transform Design

**Status:** draft
**Date:** 2026-05-07
**Author:** Claudio Barone (cjbarone23@gmail.com) + Claude

## Context

The "Davie Pilot" Next.js app at `easy review/easyreview/` was scaffolded as a restaurant-specific micro-SaaS for Fort Lauderdale operators. It contains a partly-built Tinder-style review-response composer (3 hardcoded tones) plus a CSV-based "VIP Re-Engager." The review composer is ~80% built; the rest is mock scaffolding.

This design transforms it into a **vertical-agnostic SEO/GEO tool** that complements the wiki at `SEO:GEO B&M Business/`. The wiki is a knowledge hub for local SEO + GEO/AEO disciplines (the wiki uses a barbershop running example, but the principles generalize to any B&M operator). The app becomes the operator-facing surface for one specific discipline: **review-response management**.

The wiki holds the *discipline* (the 5-category review-response framework, policy rules, do/don'ts). The app applies that discipline to live reviews from the operator's Google Business Profile.

## Goals

1. **Operator-usable on a phone.** A B&M operator (barbershop owner, dental clinic manager, salon owner, etc.) signs in with Google, sees their unanswered GBP reviews, and approves AI-drafted replies between customers.
2. **Wiki-as-source-of-truth for templates.** The app's reply templates and the 5-category framework are *baked from* `wiki/concepts/review-response-templates.md` at deploy time. Editing the wiki is how the templates evolve.
3. **Closed loop back to the wiki.** Every approved reply gets committed to `wiki/briefs/<YYYY-MM-DD>_<slug>.md` as a brief artifact (per CLAUDE.md's distribution model).
4. **Operator clicks every Post.** No auto-post, no scheduled queue, no review gating. Honors the wiki's "Hands-on rules" section.
5. **$0/mo recurring** infrastructure cost. Free FOSS stack only.

## Non-goals (v1)

- Multi-location/multi-shop switching (single shop only)
- Restaurant-specific features (insights cards like "Sea Bass Special")
- VIP Re-Engager / guest CSV ingestion (delete this feature)
- Schema markup generator, rank tracker, AI-engine cite-checker, social calendar, NAP audit (separate sub-projects later)
- Multi-LLM router (Gemini Flash only)
- Review acquisition / review gating / auto-post in any form
- Internationalization (English-only v1)

## Architecture

### Stack

| Slot | Choice | Cost |
|---|---|---|
| Frontend | Next.js 15 + Tailwind 4 + framer-motion + lucide-react (existing deps), deployed on **Cloudflare Pages** | $0 |
| Backend | **PocketBase** on **PocketHost** free tier (50MB DB ≫ what we need). Stores `operators`, `drafts`, `audit_log` collections. Fallback: Fly.io free tier. | $0 |
| AI | **Gemini 2.0 Flash** free tier (1.5K req/day) via Next.js server action | $0 |
| GBP API | **Test-user OAuth mode** — operator's Gmail added as test user in Google Cloud project. No verification process required. | $0 |
| Wiki writeback | **Octokit** commits to wiki's GitHub repo via fine-scoped PAT | $0 |
| Local wiki sync | **Claude Code SessionStart hook** runs `git pull --rebase --autostash` in wiki dir on every session | $0 |

**Total recurring cost:** $0/mo for friends-and-family scale (1-3 operators, ≤100 reviews/mo each).

**Critical-path risk:** Google Business Profile API access requires per-project approval from Google. Application takes 1-3 weeks. Mitigation: ship a **paste-flow v0 milestone** that works without GBP API access, in parallel with the application.

### Repo layout

- App: `easy review/easyreview/` (existing, rename `package.json:name` from `davie-pilot` to `easyreview-seogeo`)
- Wiki: `SEO:GEO B&M Business/` (existing, sibling directory)
- Sync script: `easyreview/scripts/sync-wiki.mjs` (new, Node, runs pre-deploy)

### Brand

Rename app to **EasyReview** (matches existing folder, scope-honest).

## Data Model

### Wiki-baked templates (`src/data/templates.json`)

Sync script parses `wiki/concepts/review-response-templates.md` → structured JSON:

```json
{
  "version": "2026-05-08",
  "source": "wiki/concepts/review-response-templates.md",
  "categories": [
    {
      "id": "5star_specific",
      "label": "5-star with specific praise",
      "trigger": { "rating": 5, "has_specific_praise": true },
      "response_goal": "Reinforce + thank, vary wording",
      "templates": [{
        "example_inbound": "Joey was great! Got me cleaned up...",
        "example_response": "Thanks for the love, Mike — appreciate you...",
        "rules": [
          "Reference specific service in 1 of every 3 responses",
          "If staff name in review, name them back",
          "First name only",
          "1-2 sentences max",
          "No URLs, prices, or promo codes"
        ]
      }]
    }
    // + 5star_generic, 4star, 3star_mixed, 1_2star_complaint, 1star_fake
  ]
}
```

Categorization is **rule-based** at draft creation time (no LLM). Gemini is only invoked to generate the draft text given the matched template.

### PocketBase collections

**`operators`** — one row per logged-in operator
- `id`, `created`, `updated`, `email` (unique, from Google OAuth), `name`
- `business_name` (e.g. "Barone Cuts")
- `vertical` (enum: `barbershop | dental | salon | gym | retail | restaurant | auto | other`)
- `gbp_account_id`, `gbp_location_id` (single-shop v1)
- `gbp_access_token`, `gbp_refresh_token`, `gbp_expires_at` — **encrypted at rest** (AES-256-GCM, key in Cloudflare Pages env var)
- `sign_off` (e.g. "— Joey", optional)
- `services` (text array, optional, drives "specific praise" detection)
- `staff_names` (text array, optional, drives "name them back" rule)
- `tone_overrides` (JSON, optional, per-category prefs)
- `active` (bool, false if OAuth revoked)

**`drafts`** — in-flight per review
- `id`, `operator_id` (relation), `gbp_review_id` (string, unique with `operator_id`)
- Review snapshot: `review_author`, `review_rating`, `review_text`, `review_date`
- Categorization: `category` (string), `suggested_template_id`
- Drafting: `ai_draft`, `operator_edited_text` (nullable)
- `status` (enum: `pending | edited | approved | posted | skipped | obsolete`)

**`audit_log`** — immutable record after posting
- `id`, `operator_id`, `gbp_review_id`
- `review_snapshot` (JSON, frozen at post time)
- `posted_text`, `category`, `posted_at`
- `gbp_api_response` (JSON, raw)
- `brief_path` (relative path to brief markdown in wiki repo)
- `brief_status` (enum: `committed | failed | pending_retry`)

### Token encryption

OAuth tokens are sensitive — a leaked refresh token = unauthorized GBP posts. Encryption pattern:
- AES-256-GCM via Node's built-in `crypto`
- Key stored in Cloudflare Pages env var `TOKEN_ENCRYPTION_KEY` (32 bytes, base64)
- `gbp_token_encryption_version` field on `operators` for future key rotation

## Review-composer flow

### Happy path

```
Operator opens app
  ↓
"Sign in with Google" → OAuth (test-user mode) → tokens encrypted into operators row
  ↓
First-run onboarding (one-time):
  • Business name, vertical, sign-off
  • Optional: services, staff names
  • App fetches GBP locations → operator picks one
  ↓
Dashboard load → server action:
  • Fetch GBP reviews for selected location
  • For each new review (not in drafts or audit_log):
    • Categorize (rule-based) → one of 5 categories
    • Look up template from src/data/templates.json
    • Call Gemini Flash with: template + review + operator config → ONE draft
    • Insert draft (status=pending)
  • Render list (newest unanswered first)
  ↓
Operator clicks a card:
  • Sees review + AI draft + applicable wiki rules
  • Edits inline OR clicks "Regenerate" for a fresh draft
  ↓
Operator clicks "Post" → server action:
  1. POST to GBP API: PUT accounts/.../reviews/{id}/reply { comment: text }
  2. Mark draft as posted, insert audit_log
  3. Octokit commit to wiki repo: briefs/<YYYY-MM-DD>_<slug>.md
```

### Categorization rules

| Category | Trigger |
|---|---|
| `5star_specific` | rating=5 AND (mentions service/staff from operator config OR body > 60 chars) |
| `5star_generic` | rating=5 AND body ≤ 60 chars AND no specific praise |
| `4star` | rating=4 |
| `3star_mixed` | rating=3 |
| `1_2star_complaint` | rating ∈ {1,2} AND specific complaint language |
| `1star_fake` | rating=1 AND body < 20 chars AND sus signals (off-topic / policy violation) |

When uncertain, default to the more-conservative category and flag for operator attention.

### Special handling per wiki policy

- **`1star_fake`:** **No pre-drafted reply.** Card shows: *"This looks like a likely fake or policy-violating review. Per wiki guidance, don't engage emotionally. Options: [Don't reply] [Flag to GBP] [Override & draft anyway]."*
- **`3star_mixed`:** Public draft acknowledges + invites private follow-up; UI surfaces a "Send private message" reminder (no auto-DM).

### Draft generation: ONE draft, not 3 tones

The wiki's 5-category framework already encodes tone via per-category rules (e.g., 5-star generic → "1 sentence is enough; padding looks auto-generated"). Layering 3 tone variants on top adds noise and 3× LLM calls. Operator gets one good draft + a "Regenerate" button.

### Posting boundary (locked v1)

The "Post" click is the **only** path to a GBP write. Explicitly absent:
- Auto-post on draft generation
- Bulk "approve all"
- Scheduled queue
- Background polling (poll only when dashboard is loaded; debounce to once / 5 min)

### Brief writeback shape

When `Post` succeeds, this gets committed via Octokit to `wiki/briefs/<YYYY-MM-DD>_<gbp-review-id-short>.md`:

```markdown
---
title: GBP reply — {author} ({rating}★) — {YYYY-MM-DD}
type: brief
tags: [reviews, {vertical}, gbp-posted]
target: GBP (posted)
operator: {email}
gbp_review_id: {id}
posted_at: {iso}
category: {category}
created: {YYYY-MM-DD}
---

## Target
GBP — posted via API

## Body
**Inbound:**
> {review_text}
> — ★{rating}, {author}, GBP, {review_date}

**Posted reply:**
> {posted_text}

## Sources
[Source: GBP API review {gbp_review_id} (posted {posted_at})]
```

This shape mirrors the wiki's brief schema from CLAUDE.md.

## Auth + GBP API

### One-time Google Cloud setup (wiki maintainer does once)

1. Create Google Cloud project (e.g. `easyreview-seogeo`)
2. Enable APIs: My Business Account Management API, My Business Business Information API, Google Business Profile API (reviews-capable)
3. Configure OAuth consent screen (External, Testing mode)
4. Add operator Gmails as test users (cap: 100)
5. Create OAuth Web client with redirect URIs:
   - `https://easyreview-seogeo.pages.dev/auth/callback` (prod)
   - `http://localhost:3000/auth/callback` (dev)
6. Drop client ID + secret into Cloudflare Pages env vars

### Required scope

Single scope: `https://www.googleapis.com/auth/business.manage` — covers read + reply. "Restricted" scope, but test-user mode bypasses the security-assessment requirement.

### Token lifecycle

- **Initial:** OAuth callback exchanges code for `access_token` (1h) + `refresh_token` (long-lived) → AES-256-GCM encrypt → write to `operators` row
- **Refresh:** every server action that touches GBP first checks `expires_at`; if < 5 min from expiry, calls Google's token endpoint, updates encrypted fields
- **Revoke:** if refresh fails, set `operators.active=false`, show "Reconnect to Google" CTA. `audit_log` rows persist (immutable record).

### GBP API calls used (just 4)

| Call | Purpose |
|---|---|
| `GET accounts` | List operator's GBP accounts (onboarding) |
| `GET accounts/{id}/locations` | List locations (onboarding) |
| `GET accounts/{id}/locations/{id}/reviews` | List reviews (dashboard refresh) |
| `PUT .../reviews/{reviewId}/reply` body `{comment: text}` | Post a reply |

No bulk endpoints, no insights, no posts API, no Q&A, no media — out of scope.

### Critical-path risk

Google has tightened GBP Reviews API access in recent years; access can be denied. Mitigation:

1. Apply for Google Business Profile API access on day one (separate from build effort)
2. Build the **paste-flow v0 milestone** in parallel — works without API access. Operator pastes reviews from their GBP dashboard; app drafts replies; operator copies replies back. Same UI, no API integration. Wiki maintainer can drive this on the operator's behalf if needed.
3. If/when API approval lands, swap the paste flow for live GBP polling (the v1 milestone).

## Vertical generalization

### What stops being restaurant-specific

| File | Action |
|---|---|
| `src/lib/mockData.ts` | Delete (paste-flow uses pasted JSON; GBP-flow uses live API) |
| `src/data/mock-reviews.json` | Delete or keep as test fixture only |
| `src/data/mock-guests.csv` | Delete (VIP Re-Engager out of scope) |
| `src/app/page.tsx` heading "Barone's Reviews" | Replace with `{operator.business_name}` from PocketBase |
| `src/app/page.tsx` insights cards (Sea Bass / Pasta) | Kill v1; future feature derived from review themes |
| `src/app/actions/reviews.ts` `generateResponses` | Replace with Gemini call: template + review + operator config → ONE draft |
| `src/components/ReviewCenter.tsx` 3-tone selection | Replace with single-draft + Edit + Regenerate |
| `src/app/guests/`, `GuestList.tsx`, `actions/guests.ts` | Delete entirely |
| `GEMINI.md` | Rewrite as generic B&M brief, or delete |

### What gets parameterized

- `vertical` → injected into Gemini system prompt: *"You are drafting a reply for a {vertical}."*
- `business_name` → page header
- `sign_off` → appended to drafts
- `services[]` → "specific praise" detection vocabulary
- `staff_names[]` → enables "name them back" rule

### Per-vertical specialization (v1: minimal)

V1 ships ONE generic template set (the wiki's `review-response-templates.md`), parameterized by vertical only via prompt injection. The barbershop-specific examples in the wiki page (Joey / wedding / fade) get retained as exemplars in the JSON — useful for Gemini's few-shot regardless of operator vertical.

Defer per-vertical wiki concept pages and per-vertical override systems until a second operator in a meaningfully different vertical reports the generic templates feel off.

### Onboarding form

```
Welcome to EasyReview — let's set up your shop.

Business name: [_____________]      (e.g. "Barone Cuts")
Vertical:      [▾ barbershop]       (dropdown)
Sign-off:      [_____________]      (optional, e.g. "— Joey")
Services:      [comma-separated]    (optional, e.g. "fade, beard trim, line-up")
Staff names:   [comma-separated]    (optional, e.g. "Joey, Mike, Tony")

[Sign in with Google → connect GBP]
```

## Error handling & edge cases

### Auth + GBP API

| Failure | Behavior |
|---|---|
| OAuth callback denied | Redirect to login + error toast |
| Token refresh fails (revoked at Google) | Mark `operators.active=false`, show "Reconnect" CTA |
| GBP rate limit | Exponential backoff: 1s/2s/4s, max 3 retries |
| 401 expired token | Trigger refresh once, retry call |
| 404 (review deleted at source) | Mark draft `obsolete`, hide |
| Post-reply call fails | Draft stays `edited`, retry button + toast |
| 5xx | User-visible "GBP is having a moment" + retry button |

### Wiki writeback

- GitHub commit fails → audit_log still records `posted`, `brief_status=failed`, queued for retry on next successful post (or manual "Retry brief" button).
- **Never block the operator's flow on writeback failure.** The post is what matters; the brief is housekeeping.

### AI draft

- Gemini timeout / 429 → fallback to **static template** (the wiki's `example_response` + operator sign-off, no LLM)
- Gemini output fails server-side validator (URL / price / > 3 sentences / promo language) → regenerate up to 2x → if still bad, surface raw template

### Categorization edge cases

- Review with no rating → flag for manual category assignment
- Non-English review → v1 is English-only; flag in known-limitations doc
- Old unanswered reviews → surface in "older inbox" section

### Race conditions

- Operator drafts in tab A, posts in tab B → optimistic concurrency on `drafts.updated_at`; later wins

### Privacy

- Customer names in reviews never go to client-side error toasts, console logs, or non-owner queries
- `audit_log` queryable only by the owning operator (PocketBase row-level rules)

## Testing strategy

### Unit (vitest)

- Categorization rules: mock reviews → assert category for all 5 buckets + edge cases (empty body, multilingual, no rating)
- AES-GCM encrypt/decrypt roundtrip
- Wiki sync script: known markdown fixture → assert JSON shape matches `templates.json` schema
- Brief markdown serializer: audit_log row → assert markdown matches the schema in §Brief writeback shape

### Integration

- PocketBase: spin up local instance, exercise CRUD on `operators` / `drafts` / `audit_log`
- GBP API: mock with `msw` (Mock Service Worker), exercise draft → post → audit flow end-to-end
- Octokit: mock commits, assert commit body matches expected brief markdown

### Manual smoke test (the v0 paste flow milestone)

1. Paste 5 mock reviews covering all 5 categories
2. Walk: categorize → AI draft → operator edit → "Post" (v0 = copy-to-clipboard + commit brief to wiki repo)
3. Verify wiki repo receives the brief commit
4. Verify SessionStart hook in local wiki dir runs `git pull` and the brief shows up

### Mobile responsive check

Manual on iPhone Safari + Android Chrome — operator uses this on a phone.

### Out of scope for tests

- Tailwind styling, framer-motion animations, Next.js boilerplate

### CI

- GitHub Actions: lint + unit tests on every push to `easyreview` repo
- Cloudflare Pages handles deploys on push to `main`

## Milestones

### v0 — Paste-flow (no GBP API dependency)

Ships before GBP API approval lands. Operator (or wiki maintainer on operator's behalf) inputs reviews one at a time via an inline form (rating, author, text, date, source). App categorizes, drafts, operator edits + clicks "Post" (which in v0 means: copy reply to clipboard + commit brief to wiki). Validates the entire pipeline except the live GBP integration.

**Includes:**
- Restaurant-specific cleanup (delete VIP Re-Engager, mock data, hardcoded insights)
- Rename to EasyReview
- Sync script: `wiki/concepts/review-response-templates.md` → `src/data/templates.json`
- Onboarding form + PocketBase `operators` collection
- Categorization engine + 5 categories
- Gemini Flash integration for draft generation
- Single-draft + Edit + Regenerate UI (replaces 3-tone)
- 1star_fake special handling (no pre-draft)
- Octokit brief writeback to wiki repo
- SessionStart hook in wiki dir for auto-pull

### v1 — Live GBP API integration

Ships after GBP API approval. Adds:
- Google OAuth flow (test-user mode)
- Token encryption + lifecycle
- GBP API calls (list accounts, list locations, list reviews, post reply)
- Replace paste flow with live polling (debounced)
- "Reconnect to Google" failure path

### Deferred (later sub-projects, not v1)

- Multi-shop switcher
- Per-vertical template overlays
- Insights cards (review-theme extraction)
- Schema markup generator
- Local-pack rank tracker
- AI-engine citation checker (GEO/AEO)
- Social media calendar
- NAP audit
- Multi-LLM router

## Success criteria

- v0: Operator (or wiki maintainer on operator's behalf) processes a 5-review batch end-to-end in under 10 minutes, including the brief writeback to the wiki landing on the laptop via SessionStart hook.
- v1: Operator opens the app on their phone, sees a new GBP review within 5 minutes of it being posted, drafts + approves a reply within 30 seconds, and sees it live on GBP.
- $0/mo recurring infrastructure cost maintained.
- No auto-posts ever ship. Every Post requires an operator click.
- Every approved reply produces a brief in `wiki/briefs/` within 60 seconds of posting (or `brief_status=failed` for retry).

## Open questions

1. **Wiki repo's GitHub status.** Confirmed during brainstorming: the wiki will be pushed to a private GitHub repo specifically to enable the writeback. Setup task for wiki maintainer before v0 ships.
2. **PAT scoping.** The Octokit PAT used for brief writeback should be scoped to *only* the wiki repo with *only* contents:write — not a broad-scope token. Setup task.
3. **PocketHost reliability.** Free tier is fine at small scale; if it becomes a bottleneck, swap to Fly.io. Decision deferred until issue surfaces.
4. **GBP API approval outcome.** Unknown until applied. v0 paste flow is the hedge.

## Related

- Wiki: `SEO:GEO B&M Business/CLAUDE.md` (schema)
- Wiki: `SEO:GEO B&M Business/wiki/concepts/review-response-templates.md` (template source)
- Wiki: `SEO:GEO B&M Business/wiki/concepts/reviews-reputation-management.md` (policy)
- Wiki: `SEO:GEO B&M Business/wiki/entities/platforms/google-business-profile.md` (platform reference)
- App: `easy review/easyreview/` (current codebase)
- App: `easy review/easyreview/GEMINI.md` (current restaurant-specific brief; to be rewritten or deleted)
