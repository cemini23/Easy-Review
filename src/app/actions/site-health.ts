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
  isValidPublicHttpUrl,
} from '@/lib/site-health';
import type { SiteHealthSnapshot } from '@/lib/types';

/**
 * PocketBase v0.23+ surfaces unique-constraint failures as 400 with a
 * `data` object whose field entries carry `code: 'validation_not_unique'`.
 * Anything else (other 400s, 5xx, network) is a real failure that should
 * propagate, not get masked by the race-recovery path.
 */
function isUniqueConstraintError(e: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  if (err?.status !== 400) return false;
  if (!err?.data || typeof err.data !== 'object') return false;
  return Object.values(err.data).some(
    (v) =>
      typeof v === 'object' &&
      v !== null &&
      (v as { code?: string }).code === 'validation_not_unique',
  );
}

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

  const collection = pb.collection('site_health_snapshots');
  const filter = `operator_id="${operatorId}"`;

  let row: { id: string } | null = null;
  try {
    row = await collection.getFirstListItem(filter);
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.status !== 404) throw e;
  }

  let saved;
  if (row) {
    saved = await collection.update(row.id, { snapshot_data: snapshotData, fetched_at });
  } else {
    try {
      saved = await collection.create({
        operator_id: operatorId,
        snapshot_data: snapshotData,
        fetched_at,
      });
    } catch (createErr) {
      // Race-safety: only attempt re-read+update when the create failure is
      // identifiably a unique-constraint violation (i.e. a concurrent writer
      // won the insert). Any other failure — validation error, server error,
      // network — must propagate so callers see the real cause instead of
      // having it silently masked by an update against an unrelated row.
      if (!isUniqueConstraintError(createErr)) {
        throw createErr;
      }
      let raceRow: { id: string } | null = null;
      try {
        raceRow = await collection.getFirstListItem(filter);
      } catch {
        // fall through — original error wins
      }
      if (raceRow) {
        saved = await collection.update(raceRow.id, { snapshot_data: snapshotData, fetched_at });
      } else {
        throw createErr;
      }
    }
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
  if (!isValidPublicHttpUrl(websiteUrl)) {
    return {
      https: null, schema: null, sitemap: null, robots: null, homepage: null,
      error: 'website_url must be a public http(s) URL (no localhost or private addresses)',
    };
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
