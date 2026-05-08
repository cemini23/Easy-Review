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
