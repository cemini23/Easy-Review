# Site Health v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/site-health` tab to Easy Review that surfaces public-fetchable signals about the operator's website + (optionally) GBP listing + PageSpeed score, with each signal linking to the relevant wiki concept page.

**Architecture:** New `site_health_snapshots` PocketBase collection (one row per operator, upserted on refresh). New `src/lib/site-health.ts` exports seven typed fetchers (HTTPS, schema, sitemap, robots, homepage meta, Place Details, PageSpeed) — each isolated, each with a 10-second AbortController timeout, each returning a result-or-error shape. Server action `fetchSiteSnapshot` runs them in parallel and upserts the snapshot. UI is a single route at `/site-health` with a manual Refresh button; GBP + PageSpeed sections gracefully degrade when `GOOGLE_MAPS_API_KEY` is unset.

**Tech Stack:** Next.js 15 App Router (server actions + force-dynamic pages), TypeScript, Vitest (tests in `tests/lib/`, vitest aliases `@/` → `src/`), PocketBase v0.23+ (with `_superusers` admin auth), Tailwind 4. Reference spec: [docs/superpowers/specs/2026-05-08-site-health-v0-design.md](../specs/2026-05-08-site-health-v0-design.md).

**File map (locked-in decomposition):**
- `src/lib/site-health.ts` — fetchers only (no PB, no React). Pure functions over `fetch()` returning typed snapshot fragments.
- `src/app/actions/site-health.ts` — server action layer. Composes fetchers in parallel, talks to PB.
- `src/app/site-health/page.tsx` — server component. Reads cached snapshot, renders cards.
- `src/components/SiteHealthCard.tsx` — section wrapper (Website / GBP / PageSpeed).
- `src/components/SiteHealthSignalRow.tsx` — per-signal row (icon + label + value + Learn more).
- `src/lib/types.ts` — extend `Operator`, add `SiteHealthSnapshot`.
- `src/app/actions/operators.ts` — pass through new fields.
- `src/components/OnboardingForm.tsx` — collect new fields.
- `src/components/Dashboard.tsx` — add nav link.
- `scripts/add-site-health-schema.mjs` — one-shot PB migration script (matches the prior `/tmp/fix-easyreview-schema.mjs` pattern).
- `.env.example` — add `GOOGLE_MAPS_API_KEY` with full setup comment.
- `docs/deploy.md` — add Step 4.5.
- `tests/lib/site-health.test.ts` — TDD coverage of all seven fetchers (mocked `fetch`).

---

## Task 1: PocketBase schema — operator fields + new collection

**Files:**
- Create: `scripts/add-site-health-schema.mjs`

**Why this task first:** every later task touches the schema (typed reads/writes). Get the live PB instance to match the spec before any code uses it.

- [ ] **Step 1: Create the migration script**

```bash
touch "/Users/claudiobarone/Desktop/projects/easy review/easyreview/scripts/add-site-health-schema.mjs"
```

Then write its contents:

```javascript
// scripts/add-site-health-schema.mjs
// One-shot migration: adds website_url + gbp_place_id to operators,
// creates site_health_snapshots collection. Idempotent — safe to re-run.
//
// Usage:  node scripts/add-site-health-schema.mjs
// Reads:  POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
// from .env.local (same as the dev server).

import { config as loadEnv } from 'dotenv';
import PocketBase from 'pocketbase';

loadEnv({ path: '.env.local' });

const url = process.env.POCKETBASE_URL;
const email = process.env.POCKETBASE_ADMIN_EMAIL;
const password = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!url || !email || !password) {
  console.error('Missing POCKETBASE_URL / POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD in .env.local');
  process.exit(1);
}

const pb = new PocketBase(url);
await pb.collection('_superusers').authWithPassword(email, password);

// 1. Extend operators collection with the two new optional text fields.
const operators = await pb.collections.getFirstListItem('name="operators"');
const operatorFields = operators.fields ?? operators.schema ?? [];
const fieldNames = new Set(operatorFields.map((f) => f.name));

const newOperatorFields = [];
if (!fieldNames.has('website_url')) {
  newOperatorFields.push({ name: 'website_url', type: 'text', required: false });
}
if (!fieldNames.has('gbp_place_id')) {
  newOperatorFields.push({ name: 'gbp_place_id', type: 'text', required: false });
}

if (newOperatorFields.length > 0) {
  const merged = [...operatorFields, ...newOperatorFields];
  await pb.collections.update(operators.id, { fields: merged });
  console.log(`operators: added ${newOperatorFields.map((f) => f.name).join(', ')}`);
} else {
  console.log('operators: website_url and gbp_place_id already present, skipping');
}

// 2. Create site_health_snapshots if missing.
let exists = true;
try {
  await pb.collections.getFirstListItem('name="site_health_snapshots"');
} catch (e) {
  if (e?.status === 404) exists = false;
  else throw e;
}

if (exists) {
  console.log('site_health_snapshots: already exists, skipping');
} else {
  await pb.collections.create({
    name: 'site_health_snapshots',
    type: 'base',
    fields: [
      { name: 'operator_id', type: 'text', required: true },
      { name: 'snapshot_data', type: 'json', required: true },
      { name: 'fetched_at', type: 'date', required: true },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  console.log('site_health_snapshots: created');
}

console.log('Done.');
```

- [ ] **Step 2: Add a one-line dotenv dev-dep if missing**

Run:
```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
node -e "console.log(require('./package.json').devDependencies?.dotenv ?? 'absent')"
```
Expected: prints `absent` → run `npm install --save-dev dotenv`. If it prints a version, skip the install.

- [ ] **Step 3: Run the migration against the live PB**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
node scripts/add-site-health-schema.mjs
```
Expected output (first run):
```
operators: added website_url, gbp_place_id
site_health_snapshots: created
Done.
```
Re-run should print "already present, skipping" / "already exists, skipping" — confirms idempotency.

- [ ] **Step 4: Verify in the PB admin UI**

Open `<POCKETBASE_URL>/_/` → Collections sidebar. Confirm:
- `operators` shows two new optional text fields `website_url` and `gbp_place_id`.
- `site_health_snapshots` exists with fields `operator_id`, `snapshot_data`, `fetched_at`, `created`, `updated`, all four API rules set to `@request.auth.id != ""`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add scripts/add-site-health-schema.mjs package.json package-lock.json
git commit -m "schema: add site-health PB collection + operator website fields

Adds an idempotent migration script that extends the operators collection
with optional website_url + gbp_place_id and creates the new
site_health_snapshots collection per the v0 design spec."
```

---

## Task 2: Extend types

**Files:**
- Modify: `src/lib/types.ts:38-47` (Operator interface) and `src/lib/types.ts:99` (append SiteHealthSnapshot)
- Test: `tests/lib/types.test.ts` (new file — type-shape sanity)

- [ ] **Step 1: Write the failing type-shape test**

Create `tests/lib/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Operator, SiteHealthSnapshot } from '@/lib/types';

describe('Operator type', () => {
  it('accepts new optional website_url + gbp_place_id', () => {
    const op: Operator = {
      id: '1',
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      services: [],
      staff_names: [],
      active: true,
      website_url: 'https://example.com',
      gbp_place_id: 'ChIJxxx',
    };
    expect(op.website_url).toBe('https://example.com');
    expect(op.gbp_place_id).toBe('ChIJxxx');
  });

  it('accepts an Operator without the new fields (backward compat)', () => {
    const op: Operator = {
      id: '1',
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      services: [],
      staff_names: [],
      active: true,
    };
    expect(op.website_url).toBeUndefined();
  });
});

describe('SiteHealthSnapshot type', () => {
  it('represents a fully-populated snapshot', () => {
    const s: SiteHealthSnapshot = {
      id: 'r1',
      operator_id: 'op1',
      fetched_at: '2026-05-08T10:00:00Z',
      website: {
        https: true,
        schema: { hasLocalBusiness: true, types: ['BarberShop'] },
        sitemap: true,
        robots: true,
        homepage: { title: 'Barone Cuts', description: 'Best fades in town', titleLength: 12, descriptionLength: 19 },
        error: null,
      },
      gbp: {
        rating: 4.8, user_ratings_total: 120, photo_count: 30,
        business_status: 'OPERATIONAL', has_opening_hours: true,
        has_phone: true, has_website: true, error: null,
      },
      pagespeed: { mobile_score: 82, lcp_ms: 2400, cls: 0.05, error: null },
    };
    expect(s.website.https).toBe(true);
    expect(s.gbp?.rating).toBe(4.8);
    expect(s.pagespeed?.mobile_score).toBe(82);
  });

  it('allows null gbp + pagespeed when API key is missing', () => {
    const s: SiteHealthSnapshot = {
      id: 'r1',
      operator_id: 'op1',
      fetched_at: '2026-05-08T10:00:00Z',
      website: { https: true, schema: null, sitemap: null, robots: null, homepage: null, error: null },
      gbp: null,
      pagespeed: null,
    };
    expect(s.gbp).toBeNull();
    expect(s.pagespeed).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/types.test.ts
```
Expected: TS error / compilation failure — `SiteHealthSnapshot` not exported, `website_url`/`gbp_place_id` not on `Operator`.

- [ ] **Step 3: Add the new fields + new interface to `src/lib/types.ts`**

Replace lines 38-47 (existing Operator interface) with:

```typescript
export interface Operator {
  id: string;
  email: string;
  business_name: string;
  vertical: Vertical;
  sign_off?: string;
  services: string[];
  staff_names: string[];
  active: boolean;
  website_url?: string;
  gbp_place_id?: string;
}
```

Then append at the end of the file (after the existing `TemplatesJson` interface):

```typescript
export interface SiteHealthSnapshot {
  id: string;
  operator_id: string;
  fetched_at: string;
  website: {
    https: boolean | null;
    schema: { hasLocalBusiness: boolean; types: string[] } | null;
    sitemap: boolean | null;
    robots: boolean | null;
    homepage: {
      title: string;
      description: string;
      titleLength: number;
      descriptionLength: number;
    } | null;
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
  } | null;
  pagespeed: {
    mobile_score: number | null;
    lcp_ms: number | null;
    cls: number | null;
    error: string | null;
  } | null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/types.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add src/lib/types.ts tests/lib/types.test.ts
git commit -m "types: extend Operator with website_url + gbp_place_id; add SiteHealthSnapshot"
```

---

## Task 3: Wire new fields through createOperator + onboarding form

**Files:**
- Modify: `src/app/actions/operators.ts`
- Modify: `src/components/OnboardingForm.tsx`
- Test: `tests/lib/operators.test.ts` (new file)

- [ ] **Step 1: Write the failing test for `createOperator` field passthrough**

Create `tests/lib/operators.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const collectionMock = {
  create: vi.fn(),
};
vi.mock('@/lib/pocketbase', () => ({
  authAsAdmin: vi.fn(async () => ({
    collection: vi.fn(() => collectionMock),
  })),
}));

import { createOperator } from '@/app/actions/operators';

describe('createOperator', () => {
  beforeEach(() => {
    collectionMock.create.mockReset();
    collectionMock.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'op1', ...data,
    }));
  });

  it('passes website_url and gbp_place_id through to PocketBase', async () => {
    await createOperator({
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      website_url: 'https://example.com',
      gbp_place_id: 'ChIJabc',
    });
    expect(collectionMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        website_url: 'https://example.com',
        gbp_place_id: 'ChIJabc',
      }),
    );
  });

  it('omits new fields when not provided (backward compat)', async () => {
    await createOperator({
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
    });
    const call = collectionMock.create.mock.calls[0][0] as Record<string, unknown>;
    expect(call.website_url).toBe('');
    expect(call.gbp_place_id).toBe('');
  });

  it('returned Operator includes the new fields when set', async () => {
    const result = await createOperator({
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      website_url: 'https://example.com',
      gbp_place_id: 'ChIJabc',
    });
    expect(result.website_url).toBe('https://example.com');
    expect(result.gbp_place_id).toBe('ChIJabc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/operators.test.ts
```
Expected: FAIL — `createOperator` doesn't accept `website_url`/`gbp_place_id`, returned Operator doesn't expose them.

- [ ] **Step 3: Update `src/app/actions/operators.ts`**

Replace the entire file with:

```typescript
'use server';

import { authAsAdmin } from '@/lib/pocketbase';
import type { Operator, Vertical } from '@/lib/types';

export interface CreateOperatorInput {
  email: string;
  business_name: string;
  vertical: Vertical;
  sign_off?: string;
  services?: string[];
  staff_names?: string[];
  website_url?: string;
  gbp_place_id?: string;
}

export async function createOperator(input: CreateOperatorInput): Promise<Operator> {
  const pb = await authAsAdmin();
  const password = cryptoRandomPassword();
  const created = await pb.collection('operators').create({
    email: input.email,
    business_name: input.business_name,
    vertical: input.vertical,
    sign_off: input.sign_off ?? '',
    services: input.services ?? [],
    staff_names: input.staff_names ?? [],
    website_url: input.website_url ?? '',
    gbp_place_id: input.gbp_place_id ?? '',
    active: true,
    password,
    passwordConfirm: password,
  });
  return mapOperator(created);
}

function cryptoRandomPassword(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCurrentOperator(): Promise<Operator | null> {
  const pb = await authAsAdmin();
  const list = await pb.collection('operators').getList(1, 1, { sort: '+created' });
  if (list.items.length === 0) return null;
  return mapOperator(list.items[0]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOperator(row: any): Operator {
  return {
    id: row.id,
    email: row.email,
    business_name: row.business_name,
    vertical: row.vertical,
    sign_off: row.sign_off || undefined,
    services: row.services ?? [],
    staff_names: row.staff_names ?? [],
    active: row.active ?? true,
    website_url: row.website_url || undefined,
    gbp_place_id: row.gbp_place_id || undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/operators.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Add fields to OnboardingForm**

In `src/components/OnboardingForm.tsx`, add two more inputs to the `submit` callback after the existing `staff_names` block (around line 33):

```typescript
website_url: String(formData.get('website_url') || '').trim() || undefined,
gbp_place_id: String(formData.get('gbp_place_id') || '').trim() || undefined,
```

Then add two new field blocks in the JSX, immediately before the `{error && ...}` line (around line 84):

```tsx
<div>
  <label htmlFor="website_url" className={labelCls}>Website URL <span className="text-slate-400 font-normal">(optional, for Site Health)</span></label>
  <input id="website_url" name="website_url" type="url" placeholder="https://yourshop.com" className={inputCls} />
</div>

<div>
  <label htmlFor="gbp_place_id" className={labelCls}>Google place_id <span className="text-slate-400 font-normal">(optional, for Site Health)</span></label>
  <input id="gbp_place_id" name="gbp_place_id" placeholder="ChIJ..." className={inputCls} />
</div>
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add src/app/actions/operators.ts src/components/OnboardingForm.tsx tests/lib/operators.test.ts
git commit -m "feat: collect website_url + gbp_place_id during onboarding

Wires the two new optional Operator fields through createOperator and the
onboarding form so Site Health has the inputs it needs."
```

---

## Task 4: Website fetchers — TDD

**Files:**
- Create: `src/lib/site-health.ts`
- Create: `tests/lib/site-health.test.ts`

This task implements the five always-shown website fetchers: `fetchHttps`, `fetchSchema`, `fetchSitemap`, `fetchRobots`, `fetchHomepageMeta`. Each takes a URL and returns the corresponding `SiteHealthSnapshot['website']` fragment.

- [ ] **Step 1: Write failing tests for `fetchHttps`**

Create `tests/lib/site-health.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchHttps,
  fetchSchema,
  fetchSitemap,
  fetchRobots,
  fetchHomepageMeta,
} from '@/lib/site-health';

describe('fetchHttps', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true when URL is https and 200 OK', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('ok', { status: 200 }));
    expect(await fetchHttps('https://example.com')).toBe(true);
  });

  it('returns false when URL is http (no TLS)', async () => {
    expect(await fetchHttps('http://example.com')).toBe(false);
  });

  it('returns false when fetch throws (cert error, DNS failure, etc.)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('cert invalid'));
    expect(await fetchHttps('https://example.com')).toBe(false);
  });

  it('returns false when response is non-2xx', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('boom', { status: 500 }));
    expect(await fetchHttps('https://example.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts
```
Expected: FAIL — `@/lib/site-health` does not exist.

- [ ] **Step 3: Create `src/lib/site-health.ts` with `fetchHttps` + a 10s timeout helper**

```typescript
const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHttps(url: string): Promise<boolean> {
  if (!url.startsWith('https://')) return false;
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t fetchHttps
```
Expected: PASS (4 tests).

- [ ] **Step 5: Add tests for `fetchSchema`**

Append to `tests/lib/site-health.test.ts`:

```typescript
describe('fetchSchema', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('detects LocalBusiness JSON-LD on the homepage', async () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'X',
    })}</script></head><body></body></html>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result).toEqual({ hasLocalBusiness: true, types: ['LocalBusiness'] });
  });

  it('detects LocalBusiness subtypes (BarberShop, BeautySalon, Restaurant)', async () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BarberShop', name: 'X',
    })}</script></head><body></body></html>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result.hasLocalBusiness).toBe(true);
    expect(result.types).toContain('BarberShop');
  });

  it('returns hasLocalBusiness=false when only an unrelated type is present', async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'X',
    })}</script>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result.hasLocalBusiness).toBe(false);
    expect(result.types).toEqual(['WebSite']);
  });

  it('handles multiple JSON-LD blocks', async () => {
    const html = `
      <script type="application/ld+json">${JSON.stringify({ '@type': 'WebSite' })}</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'BarberShop' })}</script>
    `;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result.types).toContain('WebSite');
    expect(result.types).toContain('BarberShop');
    expect(result.hasLocalBusiness).toBe(true);
  });

  it('returns null on fetch failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const result = await fetchSchema('https://example.com');
    expect(result).toBeNull();
  });

  it('returns hasLocalBusiness=false types=[] when no JSON-LD blocks exist', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('<html></html>', { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result).toEqual({ hasLocalBusiness: false, types: [] });
  });
});
```

- [ ] **Step 6: Run test to verify failure**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t fetchSchema
```
Expected: FAIL — `fetchSchema` not exported.

- [ ] **Step 7: Implement `fetchSchema`**

Append to `src/lib/site-health.ts`:

```typescript
const LOCAL_BUSINESS_TYPES = new Set([
  'LocalBusiness', 'AnimalShelter', 'AutomotiveBusiness', 'AutoDealer', 'AutoRepair',
  'BeautySalon', 'BarberShop', 'HairSalon', 'NailSalon', 'HealthAndBeautyBusiness',
  'ChildCare', 'DryCleaningOrLaundry', 'EmergencyService', 'EmploymentAgency',
  'EntertainmentBusiness', 'FinancialService', 'FoodEstablishment', 'Bakery',
  'BarOrPub', 'CafeOrCoffeeShop', 'FastFoodRestaurant', 'IceCreamShop', 'Restaurant',
  'GovernmentOffice', 'HealthClub', 'DaySpa', 'Dentist', 'Hospital', 'MedicalClinic',
  'Optician', 'Physician', 'VeterinaryCare', 'HomeAndConstructionBusiness', 'Electrician',
  'GeneralContractor', 'HVACBusiness', 'HousePainter', 'Locksmith', 'MovingCompany',
  'Plumber', 'RoofingContractor', 'InternetCafe', 'LegalService', 'Attorney', 'Notary',
  'Library', 'LodgingBusiness', 'BedAndBreakfast', 'Hostel', 'Hotel', 'Motel',
  'ProfessionalService', 'AccountingService', 'RadioStation', 'RealEstateAgent',
  'RecyclingCenter', 'SelfStorage', 'ShoppingCenter', 'SportsActivityLocation',
  'GolfCourse', 'Gym', 'StadiumOrArena', 'Store', 'BikeStore', 'BookStore',
  'ClothingStore', 'ConvenienceStore', 'DepartmentStore', 'ElectronicsStore',
  'Florist', 'FurnitureStore', 'GardenStore', 'GroceryStore', 'HardwareStore',
  'HobbyShop', 'HomeGoodsStore', 'JewelryStore', 'LiquorStore', 'MensClothingStore',
  'MobilePhoneStore', 'MovieRentalStore', 'MusicStore', 'OfficeEquipmentStore',
  'OutletStore', 'PawnShop', 'PetStore', 'ShoeStore', 'SportingGoodsStore',
  'TireShop', 'ToyStore', 'WholesaleStore', 'TelevisionStation', 'TouristInformationCenter',
  'TravelAgency',
]);

export async function fetchSchema(url: string): Promise<{ hasLocalBusiness: boolean; types: string[] } | null> {
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    const types: string[] = [];
    for (const m of matches) {
      try {
        const data = JSON.parse(m[1]);
        const blocks = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const block of blocks) {
          const t = block?.['@type'];
          if (Array.isArray(t)) types.push(...t.filter((x) => typeof x === 'string'));
          else if (typeof t === 'string') types.push(t);
        }
      } catch {
        // malformed JSON-LD block — ignore
      }
    }
    const hasLocalBusiness = types.some((t) => LOCAL_BUSINESS_TYPES.has(t));
    return { hasLocalBusiness, types };
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: Run test to verify pass**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t fetchSchema
```
Expected: PASS (6 tests).

- [ ] **Step 9: Add tests for `fetchSitemap` and `fetchRobots`**

Append to `tests/lib/site-health.test.ts`:

```typescript
describe('fetchSitemap', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true when /sitemap.xml exists with XML content-type', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('<urlset/>', { status: 200, headers: { 'content-type': 'application/xml' } }),
    );
    expect(await fetchSitemap('https://example.com')).toBe(true);
  });

  it('returns true with text/xml content-type', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('<urlset/>', { status: 200, headers: { 'content-type': 'text/xml' } }),
    );
    expect(await fetchSitemap('https://example.com')).toBe(true);
  });

  it('returns false on 404', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('not found', { status: 404 }));
    expect(await fetchSitemap('https://example.com')).toBe(false);
  });

  it('returns false on non-XML content-type', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('<html/>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    expect(await fetchSitemap('https://example.com')).toBe(false);
  });

  it('handles paths under /sitemap.xml', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response('<urlset/>', { status: 200, headers: { 'content-type': 'application/xml' } }));
    await fetchSitemap('https://example.com/some/path');
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/sitemap.xml', expect.any(Object));
  });
});

describe('fetchRobots', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true when /robots.txt is 200', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('User-agent: *', { status: 200 }));
    expect(await fetchRobots('https://example.com')).toBe(true);
  });

  it('returns false on 404', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('404', { status: 404 }));
    expect(await fetchRobots('https://example.com')).toBe(false);
  });

  it('hits the origin /robots.txt regardless of input path', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response('User-agent: *', { status: 200 }));
    await fetchRobots('https://example.com/some/path');
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/robots.txt', expect.any(Object));
  });
});
```

- [ ] **Step 10: Run tests to verify failure**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t "fetchSitemap|fetchRobots"
```
Expected: FAIL — both functions not exported.

- [ ] **Step 11: Implement `fetchSitemap` and `fetchRobots`**

Append to `src/lib/site-health.ts`:

```typescript
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/.*$/, '');
  }
}

export async function fetchSitemap(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${originOf(url)}/sitemap.xml`, { method: 'GET' });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    return ct.includes('xml');
  } catch {
    return false;
  }
}

export async function fetchRobots(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${originOf(url)}/robots.txt`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 12: Run tests to verify pass**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t "fetchSitemap|fetchRobots"
```
Expected: PASS (8 tests).

- [ ] **Step 13: Add tests for `fetchHomepageMeta`**

Append to `tests/lib/site-health.test.ts`:

```typescript
describe('fetchHomepageMeta', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('extracts title and meta description', async () => {
    const html = `<html><head>
      <title>Barone Cuts — best fades in Northeast Philly</title>
      <meta name="description" content="Walk-in barbershop. Fades, beard trims, kids cuts. 7 days.">
    </head></html>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result).toEqual({
      title: 'Barone Cuts — best fades in Northeast Philly',
      description: 'Walk-in barbershop. Fades, beard trims, kids cuts. 7 days.',
      titleLength: 44,
      descriptionLength: 58,
    });
  });

  it('handles missing description gracefully', async () => {
    const html = '<html><head><title>X</title></head></html>';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result).toEqual({
      title: 'X',
      description: '',
      titleLength: 1,
      descriptionLength: 0,
    });
  });

  it('handles missing title gracefully', async () => {
    const html = '<html><head><meta name="description" content="X"></head></html>';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result?.title).toBe('');
    expect(result?.description).toBe('X');
  });

  it('returns null on fetch failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    expect(await fetchHomepageMeta('https://example.com')).toBeNull();
  });

  it('decodes HTML entities in title (e.g. &amp;)', async () => {
    const html = '<html><head><title>Joe &amp; Sons</title></head></html>';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result?.title).toBe('Joe & Sons');
  });
});
```

- [ ] **Step 14: Run tests to verify failure**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t fetchHomepageMeta
```
Expected: FAIL — `fetchHomepageMeta` not exported.

- [ ] **Step 15: Implement `fetchHomepageMeta`**

Append to `src/lib/site-health.ts`:

```typescript
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function fetchHomepageMeta(url: string): Promise<{
  title: string;
  description: string;
  titleLength: number;
  descriptionLength: number;
} | null> {
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) return null;
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : '';
    const description = descMatch ? decodeEntities(descMatch[1].trim()) : '';
    return {
      title,
      description,
      titleLength: title.length,
      descriptionLength: description.length,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 16: Run tests to verify pass**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts
```
Expected: PASS (all website-fetcher suites — `fetchHttps`, `fetchSchema`, `fetchSitemap`, `fetchRobots`, `fetchHomepageMeta`).

- [ ] **Step 17: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add src/lib/site-health.ts tests/lib/site-health.test.ts
git commit -m "feat(site-health): website-side fetchers (HTTPS, schema, sitemap, robots, meta)

Five public-fetchable signal fetchers, each with a 10s AbortController
timeout, each returning a typed result-or-null. No third-party API keys
required."
```

---

## Task 5: Place Details + PageSpeed fetchers — TDD

**Files:**
- Modify: `src/lib/site-health.ts`
- Modify: `tests/lib/site-health.test.ts`

- [ ] **Step 1: Add failing tests for `fetchPlaceDetails`**

Append to `tests/lib/site-health.test.ts`:

```typescript
import { fetchPlaceDetails, fetchPageSpeed } from '@/lib/site-health';

describe('fetchPlaceDetails', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const happyResponse = {
    status: 'OK',
    result: {
      name: 'Barone Cuts',
      business_status: 'OPERATIONAL',
      rating: 4.8,
      user_ratings_total: 142,
      photos: [{ photo_reference: 'a' }, { photo_reference: 'b' }, { photo_reference: 'c' }],
      opening_hours: { weekday_text: ['Mon: 9-5'] },
      formatted_phone_number: '(215) 555-1234',
      website: 'https://baronecuts.com',
    },
  };

  it('returns the typed GBP fragment on a successful response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(happyResponse), { status: 200 }),
    );
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result).toEqual({
      rating: 4.8,
      user_ratings_total: 142,
      photo_count: 3,
      business_status: 'OPERATIONAL',
      has_opening_hours: true,
      has_phone: true,
      has_website: true,
      error: null,
    });
  });

  it('returns has_*=false when fields are missing', async () => {
    const partial = {
      status: 'OK',
      result: { name: 'X', business_status: 'OPERATIONAL', rating: 4, user_ratings_total: 10 },
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(partial), { status: 200 }),
    );
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result?.has_opening_hours).toBe(false);
    expect(result?.has_phone).toBe(false);
    expect(result?.has_website).toBe(false);
    expect(result?.photo_count).toBe(0);
  });

  it('returns error fragment when status != OK', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ status: 'NOT_FOUND', error_message: 'No record' }), { status: 200 }),
    );
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result?.error).toMatch(/NOT_FOUND/);
    expect(result?.rating).toBeNull();
  });

  it('returns error fragment when fetch throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result?.error).toContain('network');
  });

  it('passes the API key + place_id in the URL', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(happyResponse), { status: 200 }));
    await fetchPlaceDetails('ChIJxyz', 'thekey');
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('place_id=ChIJxyz');
    expect(calledUrl).toContain('key=thekey');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t fetchPlaceDetails
```
Expected: FAIL — `fetchPlaceDetails` not exported.

- [ ] **Step 3: Implement `fetchPlaceDetails`**

Append to `src/lib/site-health.ts`:

```typescript
import type { SiteHealthSnapshot } from '@/lib/types';

type GbpFragment = NonNullable<SiteHealthSnapshot['gbp']>;

export async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<GbpFragment | null> {
  const fields = [
    'place_id', 'name', 'business_status', 'rating', 'user_ratings_total',
    'photos', 'opening_hours', 'formatted_phone_number', 'website',
  ].join(',');
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${encodeURIComponent(apiKey)}`;
  const empty: GbpFragment = {
    rating: null, user_ratings_total: null, photo_count: null,
    business_status: null, has_opening_hours: null, has_phone: null,
    has_website: null, error: null,
  };
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (data.status !== 'OK') return { ...empty, error: `${data.status}: ${data.error_message ?? 'unknown'}` };
    const r = data.result ?? {};
    return {
      rating: typeof r.rating === 'number' ? r.rating : null,
      user_ratings_total: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : null,
      photo_count: Array.isArray(r.photos) ? r.photos.length : 0,
      business_status: r.business_status ?? null,
      has_opening_hours: Boolean(r.opening_hours),
      has_phone: Boolean(r.formatted_phone_number),
      has_website: Boolean(r.website),
      error: null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'unknown' };
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t fetchPlaceDetails
```
Expected: PASS (5 tests).

- [ ] **Step 5: Add failing tests for `fetchPageSpeed`**

Append to `tests/lib/site-health.test.ts`:

```typescript
describe('fetchPageSpeed', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const happy = {
    lighthouseResult: {
      categories: { performance: { score: 0.82 } },
      audits: {
        'largest-contentful-paint': { numericValue: 2400 },
        'cumulative-layout-shift': { numericValue: 0.05 },
      },
    },
  };

  it('extracts mobile_score, lcp_ms, cls', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(happy), { status: 200 }),
    );
    const result = await fetchPageSpeed('https://example.com', 'fakeKey');
    expect(result).toEqual({ mobile_score: 82, lcp_ms: 2400, cls: 0.05, error: null });
  });

  it('rounds the score to a whole number', async () => {
    const r = JSON.parse(JSON.stringify(happy));
    r.lighthouseResult.categories.performance.score = 0.876;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(r), { status: 200 }));
    const result = await fetchPageSpeed('https://example.com', 'k');
    expect(result?.mobile_score).toBe(88);
  });

  it('returns error when fetch throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
    const result = await fetchPageSpeed('https://example.com', 'k');
    expect(result?.error).toContain('timeout');
    expect(result?.mobile_score).toBeNull();
  });

  it('returns error when API returns non-2xx', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 }),
    );
    const result = await fetchPageSpeed('https://example.com', 'k');
    expect(result?.error).toMatch(/HTTP 429/);
  });

  it('passes url + strategy=mobile + key in the request', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(happy), { status: 200 }));
    await fetchPageSpeed('https://example.com', 'thekey');
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('url=https%3A%2F%2Fexample.com');
    expect(calledUrl).toContain('strategy=mobile');
    expect(calledUrl).toContain('key=thekey');
  });
});
```

- [ ] **Step 6: Run tests to verify failure**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts -t fetchPageSpeed
```
Expected: FAIL — `fetchPageSpeed` not exported.

- [ ] **Step 7: Implement `fetchPageSpeed`**

Append to `src/lib/site-health.ts`:

```typescript
type PsiFragment = NonNullable<SiteHealthSnapshot['pagespeed']>;

const PSI_TIMEOUT_MS = 60_000;

export async function fetchPageSpeed(url: string, apiKey: string): Promise<PsiFragment | null> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${encodeURIComponent(apiKey)}`;
  const empty: PsiFragment = { mobile_score: null, lcp_ms: null, cls: null, error: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };
    const data = await res.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    const lcp = data?.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue;
    const cls = data?.lighthouseResult?.audits?.['cumulative-layout-shift']?.numericValue;
    return {
      mobile_score: typeof score === 'number' ? Math.round(score * 100) : null,
      lcp_ms: typeof lcp === 'number' ? Math.round(lcp) : null,
      cls: typeof cls === 'number' ? cls : null,
      error: null,
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}
```

Note: PageSpeed responses can take 30-50s on slow sites — we use a longer 60s timeout for this fetcher only. Document this inline.

- [ ] **Step 8: Run all site-health tests to verify pass**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health.test.ts
```
Expected: PASS (all suites: fetchHttps, fetchSchema, fetchSitemap, fetchRobots, fetchHomepageMeta, fetchPlaceDetails, fetchPageSpeed).

- [ ] **Step 9: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add src/lib/site-health.ts tests/lib/site-health.test.ts
git commit -m "feat(site-health): Place Details + PageSpeed Insights fetchers

Both gated by GOOGLE_MAPS_API_KEY at the call site (server action).
Place Details uses the v3 web-service endpoint. PageSpeed uses a
60s timeout to accommodate slow sites; everything else is 10s."
```

---

## Task 6: Server action — orchestrator + reader

**Files:**
- Create: `src/app/actions/site-health.ts`
- Create: `tests/lib/site-health-actions.test.ts`

The server action does three things: read the operator's settings (website_url, gbp_place_id), call the seven fetchers in parallel, upsert the resulting snapshot to PocketBase. It also exposes `getSnapshot(operatorId)` for the page to read.

- [ ] **Step 1: Write failing test for the orchestrator**

Create `tests/lib/site-health-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fetchers — orchestrator test doesn't care how they fetch.
vi.mock('@/lib/site-health', () => ({
  fetchHttps: vi.fn(),
  fetchSchema: vi.fn(),
  fetchSitemap: vi.fn(),
  fetchRobots: vi.fn(),
  fetchHomepageMeta: vi.fn(),
  fetchPlaceDetails: vi.fn(),
  fetchPageSpeed: vi.fn(),
}));

// Mock PocketBase admin auth.
const operatorRow = {
  id: 'op1', email: 'a@b.com', business_name: 'X', vertical: 'barbershop',
  services: [], staff_names: [], active: true,
  website_url: 'https://example.com', gbp_place_id: 'ChIJabc',
};
const snapshotsCollection = {
  getFirstListItem: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const operatorsCollection = { getOne: vi.fn(async () => operatorRow) };
vi.mock('@/lib/pocketbase', () => ({
  authAsAdmin: vi.fn(async () => ({
    collection: vi.fn((name: string) => {
      if (name === 'site_health_snapshots') return snapshotsCollection;
      if (name === 'operators') return operatorsCollection;
      throw new Error(`unmocked collection ${name}`);
    }),
  })),
}));

import { fetchSiteSnapshot, getSnapshot } from '@/app/actions/site-health';
import * as fetchers from '@/lib/site-health';

const mocks = fetchers as unknown as Record<keyof typeof fetchers, ReturnType<typeof vi.fn>>;

describe('fetchSiteSnapshot', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    snapshotsCollection.getFirstListItem.mockReset();
    snapshotsCollection.create.mockReset();
    snapshotsCollection.update.mockReset();
    operatorsCollection.getOne.mockClear();
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it('runs all website fetchers and saves a snapshot', async () => {
    mocks.fetchHttps.mockResolvedValue(true);
    mocks.fetchSchema.mockResolvedValue({ hasLocalBusiness: true, types: ['BarberShop'] });
    mocks.fetchSitemap.mockResolvedValue(true);
    mocks.fetchRobots.mockResolvedValue(true);
    mocks.fetchHomepageMeta.mockResolvedValue({ title: 'X', description: 'Y', titleLength: 1, descriptionLength: 1 });
    snapshotsCollection.getFirstListItem.mockRejectedValue({ status: 404 });
    snapshotsCollection.create.mockResolvedValue({ id: 'snap1' });

    const result = await fetchSiteSnapshot('op1');
    expect(result.website.https).toBe(true);
    expect(result.website.schema?.hasLocalBusiness).toBe(true);
    expect(result.gbp).toBeNull();
    expect(result.pagespeed).toBeNull();
    expect(snapshotsCollection.create).toHaveBeenCalledOnce();
  });

  it('runs Place Details + PageSpeed when GOOGLE_MAPS_API_KEY is set', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'thekey';
    mocks.fetchHttps.mockResolvedValue(true);
    mocks.fetchSchema.mockResolvedValue({ hasLocalBusiness: true, types: [] });
    mocks.fetchSitemap.mockResolvedValue(true);
    mocks.fetchRobots.mockResolvedValue(true);
    mocks.fetchHomepageMeta.mockResolvedValue({ title: 'X', description: 'Y', titleLength: 1, descriptionLength: 1 });
    mocks.fetchPlaceDetails.mockResolvedValue({
      rating: 4.8, user_ratings_total: 100, photo_count: 5,
      business_status: 'OPERATIONAL', has_opening_hours: true,
      has_phone: true, has_website: true, error: null,
    });
    mocks.fetchPageSpeed.mockResolvedValue({ mobile_score: 82, lcp_ms: 2400, cls: 0.05, error: null });
    snapshotsCollection.getFirstListItem.mockRejectedValue({ status: 404 });
    snapshotsCollection.create.mockResolvedValue({ id: 'snap1' });

    const result = await fetchSiteSnapshot('op1');
    expect(mocks.fetchPlaceDetails).toHaveBeenCalledWith('ChIJabc', 'thekey');
    expect(mocks.fetchPageSpeed).toHaveBeenCalledWith('https://example.com', 'thekey');
    expect(result.gbp?.rating).toBe(4.8);
    expect(result.pagespeed?.mobile_score).toBe(82);
  });

  it('skips Place Details when gbp_place_id is missing even if key is set', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'thekey';
    operatorsCollection.getOne.mockResolvedValueOnce({ ...operatorRow, gbp_place_id: '' });
    mocks.fetchHttps.mockResolvedValue(true);
    mocks.fetchSchema.mockResolvedValue({ hasLocalBusiness: false, types: [] });
    mocks.fetchSitemap.mockResolvedValue(false);
    mocks.fetchRobots.mockResolvedValue(false);
    mocks.fetchHomepageMeta.mockResolvedValue(null);
    mocks.fetchPageSpeed.mockResolvedValue({ mobile_score: 50, lcp_ms: 5000, cls: 0.1, error: null });
    snapshotsCollection.getFirstListItem.mockRejectedValue({ status: 404 });
    snapshotsCollection.create.mockResolvedValue({ id: 'snap1' });

    const result = await fetchSiteSnapshot('op1');
    expect(mocks.fetchPlaceDetails).not.toHaveBeenCalled();
    expect(result.gbp).toBeNull();
    expect(result.pagespeed?.mobile_score).toBe(50);
  });

  it('updates an existing snapshot row instead of creating a duplicate', async () => {
    mocks.fetchHttps.mockResolvedValue(true);
    mocks.fetchSchema.mockResolvedValue(null);
    mocks.fetchSitemap.mockResolvedValue(false);
    mocks.fetchRobots.mockResolvedValue(false);
    mocks.fetchHomepageMeta.mockResolvedValue(null);
    snapshotsCollection.getFirstListItem.mockResolvedValue({ id: 'existing-snap' });
    snapshotsCollection.update.mockResolvedValue({ id: 'existing-snap' });

    await fetchSiteSnapshot('op1');
    expect(snapshotsCollection.update).toHaveBeenCalledWith('existing-snap', expect.any(Object));
    expect(snapshotsCollection.create).not.toHaveBeenCalled();
  });

  it('returns an empty website snapshot when website_url is missing', async () => {
    operatorsCollection.getOne.mockResolvedValueOnce({ ...operatorRow, website_url: '' });
    snapshotsCollection.getFirstListItem.mockRejectedValue({ status: 404 });
    snapshotsCollection.create.mockResolvedValue({ id: 'snap1' });

    const result = await fetchSiteSnapshot('op1');
    expect(result.website.https).toBeNull();
    expect(result.website.error).toBe('website_url not configured');
    expect(mocks.fetchHttps).not.toHaveBeenCalled();
  });
});

describe('getSnapshot', () => {
  beforeEach(() => {
    snapshotsCollection.getFirstListItem.mockReset();
  });

  it('returns the cached snapshot when one exists', async () => {
    const fetched_at = '2026-05-08T10:00:00.000Z';
    snapshotsCollection.getFirstListItem.mockResolvedValue({
      id: 'snap1',
      operator_id: 'op1',
      fetched_at,
      snapshot_data: {
        website: { https: true, schema: null, sitemap: null, robots: null, homepage: null, error: null },
        gbp: null, pagespeed: null,
      },
    });
    const result = await getSnapshot('op1');
    expect(result?.id).toBe('snap1');
    expect(result?.fetched_at).toBe(fetched_at);
    expect(result?.website.https).toBe(true);
  });

  it('returns null when no snapshot exists', async () => {
    snapshotsCollection.getFirstListItem.mockRejectedValue({ status: 404 });
    expect(await getSnapshot('op1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health-actions.test.ts
```
Expected: FAIL — `@/app/actions/site-health` does not exist.

- [ ] **Step 3: Create `src/app/actions/site-health.ts`**

```typescript
'use server';

import { authAsAdmin } from '@/lib/pocketbase';
import {
  fetchHttps,
  fetchSchema,
  fetchSitemap,
  fetchRobots,
  fetchHomepageMeta,
  fetchPlaceDetails,
  fetchPageSpeed,
} from '@/lib/site-health';
import type { SiteHealthSnapshot } from '@/lib/types';

export async function fetchSiteSnapshot(operatorId: string): Promise<SiteHealthSnapshot> {
  const pb = await authAsAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const op: any = await pb.collection('operators').getOne(operatorId);
  const websiteUrl: string = op.website_url || '';
  const placeId: string = op.gbp_place_id || '';
  const apiKey: string | undefined = process.env.GOOGLE_MAPS_API_KEY;

  const [website, gbp, pagespeed] = await Promise.all([
    runWebsite(websiteUrl),
    apiKey && placeId ? fetchPlaceDetails(placeId, apiKey) : Promise.resolve(null),
    apiKey && websiteUrl ? fetchPageSpeed(websiteUrl, apiKey) : Promise.resolve(null),
  ]);

  const fetched_at = new Date().toISOString();
  const snapshotData = { website, gbp, pagespeed };

  let row: { id: string } | null = null;
  try {
    row = await pb.collection('site_health_snapshots').getFirstListItem(`operator_id="${operatorId}"`);
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.status !== 404) throw e;
  }

  let saved;
  if (row) {
    saved = await pb.collection('site_health_snapshots').update(row.id, {
      snapshot_data: snapshotData,
      fetched_at,
    });
  } else {
    saved = await pb.collection('site_health_snapshots').create({
      operator_id: operatorId,
      snapshot_data: snapshotData,
      fetched_at,
    });
  }

  return {
    id: saved.id,
    operator_id: operatorId,
    fetched_at,
    ...snapshotData,
  };
}

export async function getSnapshot(operatorId: string): Promise<SiteHealthSnapshot | null> {
  const pb = await authAsAdmin();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = await pb.collection('site_health_snapshots').getFirstListItem(`operator_id="${operatorId}"`);
    return {
      id: row.id,
      operator_id: row.operator_id,
      fetched_at: row.fetched_at,
      ...row.snapshot_data,
    };
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.status === 404) return null;
    throw e;
  }
}

async function runWebsite(websiteUrl: string): Promise<SiteHealthSnapshot['website']> {
  if (!websiteUrl) {
    return { https: null, schema: null, sitemap: null, robots: null, homepage: null, error: 'website_url not configured' };
  }
  const [https, schema, sitemap, robots, homepage] = await Promise.all([
    fetchHttps(websiteUrl),
    fetchSchema(websiteUrl),
    fetchSitemap(websiteUrl),
    fetchRobots(websiteUrl),
    fetchHomepageMeta(websiteUrl),
  ]);
  return { https, schema, sitemap, robots, homepage, error: null };
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx vitest run tests/lib/site-health-actions.test.ts
```
Expected: PASS (all 7 cases — 5 in `fetchSiteSnapshot`, 2 in `getSnapshot`).

- [ ] **Step 5: Run the full test suite to confirm nothing else regressed**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npm test
```
Expected: PASS (all suites — categorize, gemini, templates, wiki-brief, types, operators, site-health, site-health-actions).

- [ ] **Step 6: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add src/app/actions/site-health.ts tests/lib/site-health-actions.test.ts
git commit -m "feat(site-health): server action — fetchSiteSnapshot + getSnapshot

Orchestrates the seven fetchers in parallel, gates GBP + PageSpeed
behind GOOGLE_MAPS_API_KEY (and gbp_place_id / website_url presence),
upserts the result into site_health_snapshots."
```

---

## Task 7: UI — route + components

**Files:**
- Create: `src/components/SiteHealthSignalRow.tsx`
- Create: `src/components/SiteHealthCard.tsx`
- Create: `src/app/site-health/page.tsx`

The UI is presentational only — no client-side fetching, no client-side state beyond a `useTransition` for the Refresh button. Server component reads the cached snapshot; client component handles the refresh. No new tests at the UI layer in v0 (the action layer carries the contract tests).

- [ ] **Step 1: Create `src/components/SiteHealthSignalRow.tsx`**

```tsx
import Link from 'next/link';

export type SignalStatus = 'ok' | 'warn' | 'fail' | 'info';

export interface SiteHealthSignalRowProps {
  label: string;
  value: string;
  status: SignalStatus;
  learnMoreUrl: string;
}

const STATUS_BADGE: Record<SignalStatus, string> = {
  ok:   'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  fail: 'bg-red-100 text-red-800',
  info: 'bg-slate-100 text-slate-800',
};

const STATUS_GLYPH: Record<SignalStatus, string> = {
  ok: '✓', warn: '⚠', fail: '✗', info: '·',
};

export default function SiteHealthSignalRow({ label, value, status, learnMoreUrl }: SiteHealthSignalRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          aria-label={status}
          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${STATUS_BADGE[status]}`}
        >
          {STATUS_GLYPH[status]}
        </span>
        <div>
          <div className="text-sm font-medium text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">{value}</div>
        </div>
      </div>
      <Link href={learnMoreUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800">
        Learn more →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/SiteHealthCard.tsx`**

```tsx
import { ReactNode } from 'react';

export interface SiteHealthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function SiteHealthCard({ title, subtitle, children }: SiteHealthCardProps) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Create `src/app/site-health/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { getCurrentOperator } from '@/app/actions/operators';
import { fetchSiteSnapshot, getSnapshot } from '@/app/actions/site-health';
import SiteHealthCard from '@/components/SiteHealthCard';
import SiteHealthSignalRow, { SignalStatus } from '@/components/SiteHealthSignalRow';
import type { SiteHealthSnapshot } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const WIKI_BASE = 'https://github.com/cemini23/SEO-GEO-B-M-Wiki/blob/main';
const LINKS = {
  https: `${WIKI_BASE}/wiki/concepts/website-essentials-local-business.md`,
  schema: `${WIKI_BASE}/wiki/concepts/schema-markup-local.md`,
  sitemap: `${WIKI_BASE}/wiki/entities/tools/google-search-console.md`,
  robots: `${WIKI_BASE}/wiki/concepts/on-page-seo-local.md`,
  meta: `${WIKI_BASE}/wiki/concepts/on-page-seo-local.md`,
  reviews: `${WIKI_BASE}/wiki/concepts/reviews-reputation-management.md`,
  gbp: `${WIKI_BASE}/wiki/entities/platforms/google-business-profile.md`,
  nap: `${WIKI_BASE}/wiki/concepts/local-seo-foundations.md`,
  cwv: `${WIKI_BASE}/wiki/concepts/website-essentials-local-business.md`,
};

export default async function SiteHealthPage() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/onboarding');

  const snapshot = await getSnapshot(operator.id);
  const hasKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);

  async function refresh() {
    'use server';
    const op = await getCurrentOperator();
    if (!op) return;
    await fetchSiteSnapshot(op.id);
    revalidatePath('/site-health');
  }

  const ageLabel = snapshot ? `Last checked ${ageFromIso(snapshot.fetched_at)}` : 'Never refreshed';

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Site Health</h1>
            <p className="text-sm text-slate-500">{operator.business_name} · {ageLabel}</p>
          </div>
          <form action={refresh}>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md transition-colors">
              Refresh now
            </button>
          </form>
        </header>

        {!operator.website_url && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-900">
            No website URL configured. Add one in onboarding to start fetching website signals.
          </div>
        )}

        <WebsiteSection snapshot={snapshot} links={LINKS} hasUrl={Boolean(operator.website_url)} />

        {hasKey && operator.gbp_place_id && (
          <GbpSection snapshot={snapshot} links={LINKS} />
        )}

        {hasKey && operator.website_url && (
          <PageSpeedSection snapshot={snapshot} links={LINKS} />
        )}

        {!hasKey && (
          <div className="bg-slate-100 border border-slate-200 rounded-md p-4 text-sm text-slate-700">
            Optional API key not configured. <a href={`${WIKI_BASE}/wiki/sources/site-health-setup.md`} className="text-indigo-600 underline">See setup</a> to unlock GBP + PageSpeed signals.
          </div>
        )}
      </div>
    </main>
  );
}

function ageFromIso(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function WebsiteSection({ snapshot, links, hasUrl }: {
  snapshot: SiteHealthSnapshot | null;
  links: typeof LINKS;
  hasUrl: boolean;
}) {
  if (!hasUrl) return null;
  const w = snapshot?.website;
  return (
    <SiteHealthCard title="Website" subtitle="Public-fetchable signals from your site">
      <SiteHealthSignalRow
        label="HTTPS"
        value={w?.https === true ? 'Encrypted' : w?.https === false ? 'Not encrypted or unreachable' : '—'}
        status={statusBool(w?.https)}
        learnMoreUrl={links.https}
      />
      <SiteHealthSignalRow
        label="LocalBusiness JSON-LD"
        value={
          w?.schema?.hasLocalBusiness
            ? `Found: ${w.schema.types.join(', ')}`
            : w?.schema
            ? `Other schema present: ${w.schema.types.join(', ') || 'none'}`
            : '—'
        }
        status={w?.schema?.hasLocalBusiness ? 'ok' : 'warn'}
        learnMoreUrl={links.schema}
      />
      <SiteHealthSignalRow
        label="Sitemap.xml"
        value={w?.sitemap === true ? 'Found' : w?.sitemap === false ? 'Missing' : '—'}
        status={statusBool(w?.sitemap)}
        learnMoreUrl={links.sitemap}
      />
      <SiteHealthSignalRow
        label="Robots.txt"
        value={w?.robots === true ? 'Found' : w?.robots === false ? 'Missing' : '—'}
        status={statusBool(w?.robots)}
        learnMoreUrl={links.robots}
      />
      <SiteHealthSignalRow
        label="Title tag"
        value={w?.homepage ? `${w.homepage.title} (${w.homepage.titleLength} chars)` : '—'}
        status={titleStatus(w?.homepage?.titleLength)}
        learnMoreUrl={links.meta}
      />
      <SiteHealthSignalRow
        label="Meta description"
        value={w?.homepage ? `${w.homepage.description || '(missing)'} (${w.homepage.descriptionLength} chars)` : '—'}
        status={descStatus(w?.homepage?.descriptionLength)}
        learnMoreUrl={links.meta}
      />
    </SiteHealthCard>
  );
}

function GbpSection({ snapshot, links }: { snapshot: SiteHealthSnapshot | null; links: typeof LINKS }) {
  const g = snapshot?.gbp ?? null;
  return (
    <SiteHealthCard title="Google Business Profile" subtitle="From the Google Places API">
      <SiteHealthSignalRow
        label="Average rating"
        value={g?.rating != null ? `${g.rating.toFixed(1)} / 5.0` : '—'}
        status={ratingStatus(g?.rating)}
        learnMoreUrl={links.reviews}
      />
      <SiteHealthSignalRow
        label="Total reviews"
        value={g?.user_ratings_total != null ? String(g.user_ratings_total) : '—'}
        status="info"
        learnMoreUrl={links.reviews}
      />
      <SiteHealthSignalRow
        label="Photos"
        value={g?.photo_count != null ? `${g.photo_count} on file` : '—'}
        status={g?.photo_count != null && g.photo_count >= 10 ? 'ok' : 'warn'}
        learnMoreUrl={links.gbp}
      />
      <SiteHealthSignalRow
        label="Business status"
        value={g?.business_status ?? '—'}
        status={g?.business_status === 'OPERATIONAL' ? 'ok' : 'warn'}
        learnMoreUrl={links.gbp}
      />
      <SiteHealthSignalRow
        label="Opening hours"
        value={g?.has_opening_hours ? 'Configured' : g === null ? '—' : 'Missing'}
        status={statusBool(g?.has_opening_hours)}
        learnMoreUrl={links.gbp}
      />
      <SiteHealthSignalRow
        label="Phone number"
        value={g?.has_phone ? 'Configured' : g === null ? '—' : 'Missing'}
        status={statusBool(g?.has_phone)}
        learnMoreUrl={links.nap}
      />
      <SiteHealthSignalRow
        label="Website on file"
        value={g?.has_website ? 'Configured' : g === null ? '—' : 'Missing'}
        status={statusBool(g?.has_website)}
        learnMoreUrl={links.nap}
      />
      {g?.error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">{g.error}</div>
      )}
    </SiteHealthCard>
  );
}

function PageSpeedSection({ snapshot, links }: { snapshot: SiteHealthSnapshot | null; links: typeof LINKS }) {
  const p = snapshot?.pagespeed ?? null;
  return (
    <SiteHealthCard title="PageSpeed Insights" subtitle="Mobile, from Lighthouse">
      <SiteHealthSignalRow
        label="Mobile performance"
        value={p?.mobile_score != null ? `${p.mobile_score} / 100` : '—'}
        status={scoreStatus(p?.mobile_score)}
        learnMoreUrl={links.cwv}
      />
      <SiteHealthSignalRow
        label="Largest Contentful Paint"
        value={p?.lcp_ms != null ? `${(p.lcp_ms / 1000).toFixed(1)}s` : '—'}
        status={lcpStatus(p?.lcp_ms)}
        learnMoreUrl={links.cwv}
      />
      <SiteHealthSignalRow
        label="Cumulative Layout Shift"
        value={p?.cls != null ? p.cls.toFixed(2) : '—'}
        status={clsStatus(p?.cls)}
        learnMoreUrl={links.cwv}
      />
      {p?.error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">{p.error}</div>
      )}
    </SiteHealthCard>
  );
}

function statusBool(b: boolean | null | undefined): SignalStatus {
  if (b === true) return 'ok';
  if (b === false) return 'warn';
  return 'info';
}
function ratingStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 4.5) return 'ok';
  if (n >= 4.0) return 'warn';
  return 'fail';
}
function titleStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 30 && n <= 60) return 'ok';
  return 'warn';
}
function descStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 70 && n <= 160) return 'ok';
  return 'warn';
}
function scoreStatus(n: number | null | undefined): SignalStatus {
  if (n == null) return 'info';
  if (n >= 90) return 'ok';
  if (n >= 50) return 'warn';
  return 'fail';
}
function lcpStatus(ms: number | null | undefined): SignalStatus {
  if (ms == null) return 'info';
  if (ms <= 2500) return 'ok';
  if (ms <= 4000) return 'warn';
  return 'fail';
}
function clsStatus(cls: number | null | undefined): SignalStatus {
  if (cls == null) return 'info';
  if (cls <= 0.1) return 'ok';
  if (cls <= 0.25) return 'warn';
  return 'fail';
}
```

- [ ] **Step 4: Verify the page builds and renders**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx tsc --noEmit
```
Expected: no TS errors.

Then start the dev server:
```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npm run dev
```

Open `http://localhost:3000/site-health` in a browser. Expected:
- If no operator exists: redirected to `/onboarding`.
- If operator exists with no `website_url`: yellow "No website URL configured" banner.
- If operator exists with `website_url`: empty website card (snapshot is null on first load), Refresh button visible.
- Click "Refresh now": page reloads with populated rows.

Stop the dev server (Ctrl-C).

- [ ] **Step 5: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add src/components/SiteHealthSignalRow.tsx src/components/SiteHealthCard.tsx src/app/site-health/page.tsx
git commit -m "feat(site-health): /site-health route + presentational components

Server-rendered route reads the cached snapshot, presents three optional
sections (Website / GBP / PageSpeed). Manual Refresh button calls the
fetchSiteSnapshot server action and revalidates the page."
```

---

## Task 8: Wiring — nav link, .env.example, deploy.md

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `.env.example`
- Modify: `docs/deploy.md`

- [ ] **Step 1: Read current Dashboard top to find the right insertion point**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
head -40 src/components/Dashboard.tsx
```
Expected: prints the header / nav region of the dashboard (`<header>` or similar). Note the line that holds the title or business-name display — that's where we add the link.

- [ ] **Step 2: Add the `/site-health` nav link**

In `src/components/Dashboard.tsx`, identify the header element rendering the business name. Add a `<Link href="/site-health">Site Health</Link>` next to it (use the same `Link` import pattern as elsewhere in the file — `import Link from 'next/link'` if not already imported). Concrete edit:

If the dashboard has a header block like:
```tsx
<header>
  <h1>{operator.business_name}</h1>
</header>
```
change it to:
```tsx
<header className="flex items-center justify-between">
  <h1>{operator.business_name}</h1>
  <nav>
    <Link href="/site-health" className="text-sm text-indigo-600 hover:text-indigo-800">Site Health →</Link>
  </nav>
</header>
```

If the existing structure uses different class names, preserve them and only add the `<nav>` block. Add `import Link from 'next/link';` to the top of the file if not already present.

- [ ] **Step 3: Verify the dashboard still builds**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npx tsc --noEmit
```
Expected: no errors. Then `npm run dev`, open `http://localhost:3000/`, confirm a "Site Health →" link appears in the dashboard header.

- [ ] **Step 4: Update `.env.example`**

Append to the bottom of `.env.example`:

```

# Site Health tab — optional. If set, unlocks GBP + PageSpeed signals.
# Without this, only website-side signals (HTTPS, schema, sitemap, robots,
# title/meta) render.
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

- [ ] **Step 5: Update `docs/deploy.md` with Step 4.5**

Find the section `## Step 5 — Sync the wiki templates...` (around line 146) and insert a new section immediately above it:

```markdown
## Step 4.5 — (Optional) Get a Google Maps Platform API key (3 min)

The Site Health tab works without this — you'll see HTTPS, schema, sitemap, robots, and homepage meta signals from your website. Add a key to also see your GBP listing's rating, review count, photos, hours, and your website's PageSpeed Insights score.

1. Go to https://console.cloud.google.com → New Project (or pick an existing one)
2. APIs & Services → Library → enable both **Places API** and **PageSpeed Insights API**
3. APIs & Services → Credentials → Create Credentials → API Key
4. (Recommended) Restrict the key to those two APIs and to your server IP
5. Add to `.env.local`: `GOOGLE_MAPS_API_KEY=...`
6. Add to your operator settings: the GBP `place_id` for your shop. Look it up at https://developers.google.com/maps/documentation/places/web-service/place-id

For a single operator with manual refresh, expect to stay well within the $200/month free credit Google grants on Maps Platform.

```

- [ ] **Step 6: Run the full test suite + build**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npm test
npm run build
```
Expected: all tests pass; build succeeds (after sync-wiki step). If `sync-wiki` fails because the wiki path env var isn't set in this environment, that's pre-existing and not relevant to the Site Health changes — note it but don't fix here.

- [ ] **Step 7: Commit**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git add src/components/Dashboard.tsx .env.example docs/deploy.md
git commit -m "docs+nav: wire Site Health into dashboard, .env.example, deploy guide

Adds the dashboard nav link, documents the optional GOOGLE_MAPS_API_KEY in
.env.example, and adds Step 4.5 to docs/deploy.md for the GCP setup flow."
```

---

## Final verification

- [ ] **Step 1: Confirm nothing regressed on the existing review-reply path**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npm test
```
Expected: all suites green (categorize, gemini, templates, wiki-brief, types, operators, site-health, site-health-actions, sync-wiki).

- [ ] **Step 2: End-to-end manual smoke test**

```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
npm run dev
```

In a browser:
1. Visit `http://localhost:3000/onboarding` (or fresh state). Fill in operator with `website_url=https://baronescuts.com` (or any reachable HTTPS site you'd like to test against) and leave `gbp_place_id` blank. Submit.
2. Land on dashboard. Click "Site Health →".
3. See "Never refreshed" header + empty Website card.
4. Click "Refresh now". Wait up to ~10s.
5. See populated rows: HTTPS ✓, Schema (depending on the site), Sitemap (depending), Robots (depending), Title + Meta lengths.
6. No GBP / PageSpeed card visible (no API key configured).
7. Set `GOOGLE_MAPS_API_KEY=<your-test-key>` in `.env.local`, restart dev server, set `gbp_place_id` on the operator (via PB admin UI), click Refresh — both new cards now render.

- [ ] **Step 3: Push the branch**

If we're on `main`:
```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git push origin main
```

If on a feature branch:
```bash
cd "/Users/claudiobarone/Desktop/projects/easy review/easyreview"
git push -u origin <branch-name>
```

---

## Self-review

**Spec coverage:**
- Goal 1 (public-fetchable signals) → Tasks 4 + 5 implement all seven fetchers ✓
- Goal 2 (zero new auth surface, env-level optional key) → Task 5 + Task 8 ✓
- Goal 3 (graceful degradation) → Task 6's `runWebsite` returns null fields with `error` set; Task 7's UI conditionally renders GBP / PageSpeed cards ✓
- Goal 4 (operator-controlled refresh) → Task 7's `refresh` server action only runs on form submit ✓
- Goal 5 (each signal links to wiki) → Task 7 `LINKS` map + `learnMoreUrl` prop on every row ✓

Non-goals are explicitly avoided: no editing UI (Task 7 components are presentation-only); no OAuth (no token columns added); no GSC/GA4 (not present in any fetcher); no historical trends (single-row upsert in Task 6).

**Placeholder scan:** Searched for "TBD", "TODO", "fill in", "implement later". None present. All test bodies, fetcher bodies, and component bodies are concrete.

**Type consistency:** `SiteHealthSnapshot` is defined once in Task 2; Tasks 5-7 import the same type and the fetcher return shapes match exactly (`fetchPlaceDetails` → `NonNullable<SiteHealthSnapshot['gbp']>`; `fetchPageSpeed` → `NonNullable<SiteHealthSnapshot['pagespeed']>`). The `SignalStatus` type is defined in Task 7 and used in the same file. Names are consistent: `fetchSiteSnapshot` in Task 6 matches the action call from Task 7. The `LINKS` keys (`https`, `schema`, `sitemap`, `robots`, `meta`, `reviews`, `gbp`, `nap`, `cwv`) are all referenced in the same file they're defined.

Approved 2026-05-08. Ready to execute via subagent-driven-development.
