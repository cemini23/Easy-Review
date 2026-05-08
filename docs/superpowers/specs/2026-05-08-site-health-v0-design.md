# Easy Review — Site Health v0 Design

**Status:** approved (in-conversation)
**Date:** 2026-05-08
**Author:** Claudio Barone (cjbarone23@gmail.com) + Claude
**Wiki workspace:** [SEO:GEO B&M Business](../../../../SEO:GEO%20B%26M%20Business/)

## Context

Easy Review currently does one thing: it surfaces unanswered GBP reviews and helps the operator approve AI-drafted replies (with brief writeback to the wiki). The operator running it has signaled they also want help with **site optimization** for their B&M website.

Architecturally, "site optimization" is a different shape from review replies:

- **Reviews** — high-frequency, API-driven (GBP), benefit from a phone-friendly Tinder-style approve/edit UI, daily-touch loop.
- **Site optimization** — low-frequency (quarterly audit at most), CMS-fragmented (each operator's WordPress / Wix / Squarespace requires manual edits), desktop-research workflow.

Bolting full site-optimization tooling into Easy Review would dilute its review-reply focus. The right primary surfaces for site optimization are the wiki + [`claude-seo-agrici`](../../../../SEO:GEO%20B%26M%20Business/wiki/entities/tools/claude-seo-agrici.md) Claude Code skill (already adopted GO 2026-05-07).

But Easy Review can usefully add a **read-only Site Health tab** that surfaces *signals* about the operator's site without offering any editing UI. The operator gets a daily glance at site health alongside the existing review-reply loop; when something needs fixing, they fall through to the wiki + Claude Code workflow.

A separate companion app for full site optimization is planned for later. This spec covers v0 read-only only.

## Goals

1. **Surface public-fetchable signals** about the operator's website + (optionally) GBP listing in a single read-only tab.
2. **Zero new auth surface** in v0 — no Google OAuth, no per-operator credential prompt. One optional env-level API key (`GOOGLE_MAPS_API_KEY`) unlocks GBP + PageSpeed data.
3. **Graceful degradation** — if the optional key is missing, website-only signals still render. If a fetch fails, the failure is shown per-signal without breaking the page.
4. **Operator-controlled refresh** — manual button only; no auto-fetch on every page load (keeps Place Details API costs predictable).
5. **Each signal links to the wiki** — every row has a "Learn more" link to the relevant `wiki/concepts/...` page so the operator can read the playbook for fixing the issue.

## Non-goals (v0)

- Any editing UI (no posting to GBP, no schema-JSON-LD generator, no on-site auto-fixes)
- Google OAuth or any per-user delegated access
- GSC / GA4 data (requires OAuth or the operator's GCP project)
- Schema validation against Google's spec (just detection: present/absent)
- Competitor SERP analysis (use [claude-seo-agrici](../../../../SEO:GEO%20B%26M%20Business/wiki/entities/tools/claude-seo-agrici.md) `/seo competitors`)
- Local-pack rank tracking (use [Local Falcon](../../../../SEO:GEO%20B%26M%20Business/wiki/entities/tools/local-falcon.md) or `/seo grid`)
- Citation NAP-consistency sweep (use `/seo nap`)
- Multi-location switching (Easy Review's existing Operator model is single-shop; matching that)
- AI-engine citation tracking
- Historical trend graphs (just the latest snapshot in v0)

## Architecture

### Data flow

```
Operator settings page
  ├── website_url (text input)
  └── gbp_place_id (text input, optional)

[Refresh button]
  ↓
Server action: fetchSiteSnapshot(operatorId)
  ↓
src/lib/site-health.ts
  ├── fetchHttps(url)              → boolean
  ├── fetchSchema(url)             → { hasLocalBusiness: bool, types: string[] }
  ├── fetchSitemap(url)            → boolean
  ├── fetchRobots(url)             → boolean
  ├── fetchHomepageMeta(url)       → { title, description }
  ├── fetchPlaceDetails(placeId)   → GbpSignals | null  (skipped if no key)
  └── fetchPageSpeed(url)          → PsiSignals | null  (skipped if no key)
  ↓
PocketBase: site_health_snapshots collection
  (cached snapshot keyed by operator_id)
  ↓
UI: /site-health route reads cached snapshot, renders cards
```

### New / modified types

```typescript
// In src/lib/types.ts:

export interface Operator {
  // ... existing fields ...
  website_url?: string;        // NEW — e.g., "https://barones.com"
  gbp_place_id?: string;       // NEW — e.g., "ChIJN1t_tDeuEmsRUsoyG83frY4"
}

export interface SiteHealthSnapshot {
  id: string;
  operator_id: string;
  fetched_at: string;          // ISO 8601
  website: {
    https: boolean | null;
    schema: { hasLocalBusiness: boolean; types: string[] } | null;
    sitemap: boolean | null;
    robots: boolean | null;
    homepage: { title: string; description: string; titleLength: number; descriptionLength: number } | null;
    error: string | null;
  };
  gbp: {
    rating: number | null;
    user_ratings_total: number | null;
    photo_count: number | null;
    business_status: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | null;
    has_opening_hours: boolean | null;
    has_phone: boolean | null;
    has_website: boolean | null;
    error: string | null;
  } | null;                    // null if GOOGLE_MAPS_API_KEY not configured
  pagespeed: {
    mobile_score: number | null;        // 0-100
    lcp_ms: number | null;
    cls: number | null;
    error: string | null;
  } | null;                    // null if GOOGLE_MAPS_API_KEY not configured
}
```

### New PocketBase collection: `site_health_snapshots`

```
fields:
  - operator_id      text     required
  - snapshot_data    json     required
  - fetched_at       date     required (autodate not used so we can write past timestamps if we backfill)
  - created          date     autodate (created)
  - updated          date     autodate (created + updated)

rules:
  - listRule:    @request.auth.id != ""
  - viewRule:    @request.auth.id != ""
  - createRule:  @request.auth.id != ""
  - updateRule:  @request.auth.id != ""
  - deleteRule:  @request.auth.id != ""
```

Single row per operator (latest snapshot). Refresh upserts.

### New file structure

```
src/
  app/
    actions/
      site-health.ts              ← NEW (server action: fetchSiteSnapshot, getSnapshot)
    site-health/
      page.tsx                    ← NEW (route)
  components/
    SiteHealthCard.tsx            ← NEW (per-shop card, reusable shape)
    SiteHealthSignalRow.tsx       ← NEW (icon + label + value + learn-more)
  lib/
    site-health.ts                ← NEW (fetchers — all the lib-level fetch logic)
docs/superpowers/specs/
  2026-05-08-site-health-v0-design.md   ← THIS FILE
docs/superpowers/plans/
  2026-05-08-site-health-v0.md          ← TO BE WRITTEN BY writing-plans
tests/lib/
  site-health.test.ts             ← NEW (TDD coverage on each fetcher)
.env.example                      ← MODIFIED (add GOOGLE_MAPS_API_KEY)
docs/deploy.md                    ← MODIFIED (Step for getting GCP key)
```

## v0 Signals (full list)

### Website signals (always shown — no key required)

| # | Signal | Status states | What it checks |
|---|--------|---------------|----------------|
| 1 | HTTPS | ✓ / ✗ | Site URL begins with `https://` AND `fetch()` returns 200 over TLS without certificate error |
| 2 | LocalBusiness JSON-LD | ✓ / ⚠ | Homepage HTML contains `<script type="application/ld+json">` with parsed `@type` matching `LocalBusiness` or any subtype (e.g., `BarberShop`, `BeautySalon`, `Restaurant`) |
| 3 | Sitemap.xml | ✓ / ⚠ | `fetch(${origin}/sitemap.xml)` returns 200 with `application/xml` or `text/xml` content-type |
| 4 | Robots.txt | ✓ / ⚠ | `fetch(${origin}/robots.txt)` returns 200 |
| 5 | Title + meta description | ✓ / ⚠ | Homepage `<title>` exists and is 30-60 chars; `<meta name="description">` exists and is 70-160 chars. Two separate sub-rows. |

### GBP signals (shown only if `GOOGLE_MAPS_API_KEY` configured AND `gbp_place_id` set)

Source: Google Places API "Place Details" — `https://maps.googleapis.com/maps/api/place/details/json`
Required fields: `place_id, name, business_status, rating, user_ratings_total, photos, opening_hours, formatted_phone_number, website`

| # | Signal | Status states | What it checks |
|---|--------|---------------|----------------|
| 6 | Average rating | numeric | `rating` (1.0-5.0) |
| 7 | Total reviews | numeric | `user_ratings_total` |
| 8 | Photo count | numeric | `photos.length` |
| 9 | Business status | ✓ (OPERATIONAL) / ⚠ | `business_status` |
| 10 | Opening hours configured | ✓ / ⚠ | `opening_hours` is present and non-empty |
| 11 | Phone number on file | ✓ / ⚠ | `formatted_phone_number` is present |
| 12 | Website on file | ✓ / ⚠ | `website` is present |

### PageSpeed signals (shown only if `GOOGLE_MAPS_API_KEY` configured AND `website_url` set)

Source: PageSpeed Insights API v5 — `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile`

| # | Signal | Status states | What it checks |
|---|--------|---------------|----------------|
| 13 | Mobile performance | numeric (0-100) | `lighthouseResult.categories.performance.score` × 100 |
| 14 | Largest Contentful Paint | numeric (ms) | `lighthouseResult.audits['largest-contentful-paint'].numericValue` |
| 15 | Cumulative Layout Shift | numeric | `lighthouseResult.audits['cumulative-layout-shift'].numericValue` |

If `GOOGLE_MAPS_API_KEY` is missing: GBP + PageSpeed sections show a banner "Optional API key not configured. See [setup](../docs/deploy.md) to unlock these signals." Website signals always render.

## "Learn more" link mapping

Each signal links to a wiki concept page on GitHub (the wiki's public repo, [cemini23/SEO-GEO-B-M-Wiki](https://github.com/cemini23/SEO-GEO-B-M-Wiki)). Concrete mapping:

| Signal | Wiki concept page |
|--------|-------------------|
| HTTPS | `wiki/concepts/website-essentials-local-business.md#https--core-web-vitals` (anchor TBD if missing) |
| LocalBusiness JSON-LD | `wiki/concepts/schema-markup-local.md` |
| Sitemap.xml | `wiki/entities/tools/google-search-console.md#indexing--pages` |
| Robots.txt | `wiki/concepts/on-page-seo-local.md` |
| Title + meta | `wiki/concepts/on-page-seo-local.md#title-tags--meta-descriptions` |
| Average rating + total reviews | `wiki/concepts/reviews-reputation-management.md` |
| Photo count | `wiki/concepts/google-business-profile.md` |
| Business status | `wiki/entities/platforms/google-business-profile.md` |
| Opening hours | `wiki/entities/platforms/google-business-profile.md` |
| Phone / website on file | `wiki/concepts/local-seo-foundations.md#nap-consistency` |
| Mobile performance / LCP / CLS | `wiki/concepts/website-essentials-local-business.md#core-web-vitals` |

For v0 we link to the page (not the anchor). Anchors are a v0.1 polish item.

## Refresh model

- On `/site-health` route load: server-rendered with the latest `site_health_snapshots` row (or empty state if none yet). Header shows "Last checked: Xh ago" or "Never refreshed."
- Manual "Refresh now" button → server action `fetchSiteSnapshot(operatorId)` runs all fetchers in parallel, upserts the snapshot, returns updated data, page re-renders.
- No auto-refresh in v0. Operator controls every Place Details + PageSpeed call.
- Each fetcher has a 10-second timeout. If a fetcher fails, the snapshot still saves with that signal's `error` field set.

## .env.example addition

```
# Site Health tab — optional. If set, unlocks GBP + PageSpeed signals.
# Without this, only website-side signals (HTTPS, schema, sitemap, robots, title/meta) render.
#
# Setup:
# 1. Create a Google Cloud project at console.cloud.google.com (or use existing)
# 2. Enable APIs: "Places API" AND "PageSpeed Insights API"
# 3. Create an API key under "APIs & Services > Credentials"
# 4. (Recommended) Restrict the key to those two APIs and to your server IP
# 5. Paste the key below
#
# Cost: $200/mo free credit (renews monthly). Place Details ~$17/1000 calls;
# manual refresh keeps usage well within free tier for a single operator.
GOOGLE_MAPS_API_KEY=
```

## docs/deploy.md addition

A new step between current Step 4 (env vars) and Step 5 (PocketBase setup):

> **Step 4.5: (Optional) Get a Google Maps Platform API key**
>
> The Site Health tab works without this — you'll see HTTPS, schema, sitemap, robots, and homepage meta signals from your website. Add a key to also see your GBP listing's rating, review count, photos, hours, and your website's PageSpeed Insights score.
>
> 1. Go to console.cloud.google.com → New Project
> 2. APIs & Services → Library → enable "Places API" + "PageSpeed Insights API"
> 3. APIs & Services → Credentials → Create Credentials → API Key
> 4. (Recommended) Restrict the key to those two APIs
> 5. Add to `.env.local`: `GOOGLE_MAPS_API_KEY=...`
> 6. Add to your operator settings: the GBP `place_id` for your shop (find at https://developers.google.com/maps/documentation/places/web-service/place-id)

## Self-review

- **Spec coverage** — every goal has at least one signal supporting it; non-goals are explicitly listed
- **Placeholder scan** — no TBDs; all signals have specified status states + check definitions
- **Internal consistency** — signal IDs in the table match the table column "What it checks"; types in `Operator` and `SiteHealthSnapshot` match what the fetchers will return
- **Scope check** — single feature (read-only tab), one new collection, ~6 implementation tasks, fits one plan
- **Ambiguity** — "Learn more" anchor mapping noted as v0.1 polish (page-only links for v0); CMS-specific mobile-friendly check NOT in v0 (PageSpeed already covers it)

Approved in-conversation 2026-05-08. Proceeding to plan.
