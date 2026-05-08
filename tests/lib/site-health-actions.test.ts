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

  it('falls back to update when create races with another writer (unique-constraint)', async () => {
    // Initial read: no row exists.
    // create(): fails with a unique-constraint error (mimicking PocketBase's
    // 400 response when the unique index on operator_id is violated by a
    // concurrent insert).
    // Fallback re-read: now finds the row the racing writer inserted.
    // Final update: succeeds against that row.
    mocks.fetchHttps.mockResolvedValue(true);
    mocks.fetchSchema.mockResolvedValue(null);
    mocks.fetchSitemap.mockResolvedValue(false);
    mocks.fetchRobots.mockResolvedValue(false);
    mocks.fetchHomepageMeta.mockResolvedValue(null);
    snapshotsCollection.getFirstListItem
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ id: 'racing-snap' });
    snapshotsCollection.create.mockRejectedValue({
      status: 400,
      data: { operator_id: { code: 'validation_not_unique' } },
    });
    snapshotsCollection.update.mockResolvedValue({ id: 'racing-snap' });

    const result = await fetchSiteSnapshot('op1');
    expect(snapshotsCollection.getFirstListItem).toHaveBeenCalledTimes(2);
    expect(snapshotsCollection.create).toHaveBeenCalledOnce();
    expect(snapshotsCollection.update).toHaveBeenCalledWith('racing-snap', expect.any(Object));
    expect(result.id).toBe('racing-snap');
  });

  it('propagates create error when fallback re-read also fails', async () => {
    // create() fails for some reason other than a winnable race; the
    // re-read also returns 404 (i.e. truly no row). The original create
    // error should propagate so callers see the real failure cause.
    mocks.fetchHttps.mockResolvedValue(true);
    mocks.fetchSchema.mockResolvedValue(null);
    mocks.fetchSitemap.mockResolvedValue(false);
    mocks.fetchRobots.mockResolvedValue(false);
    mocks.fetchHomepageMeta.mockResolvedValue(null);
    snapshotsCollection.getFirstListItem
      .mockRejectedValueOnce({ status: 404 })
      .mockRejectedValueOnce({ status: 404 });
    const createErr = { status: 400, data: { snapshot_data: { code: 'invalid_json' } } };
    snapshotsCollection.create.mockRejectedValue(createErr);

    await expect(fetchSiteSnapshot('op1')).rejects.toEqual(createErr);
    expect(snapshotsCollection.update).not.toHaveBeenCalled();
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
