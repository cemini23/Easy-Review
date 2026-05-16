'use server';

import { isValidPublicHttpUrl } from '@/lib/site-health';
import { analyzePage } from '@/lib/citability';
import type { CitabilityReport } from '@/lib/types';

const TIMEOUT_MS = 12_000;
const USER_AGENT = 'EasyReview-CitabilityBot/1.0 (+https://github.com/cemini23/Easy-Review)';

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a page (and its robots.txt) and score it for AI-engine citability.
 * Never throws — fetch/validation problems come back as `report.error`.
 */
export async function analyzeUrl(rawUrl: string): Promise<CitabilityReport> {
  const url = rawUrl.trim();
  const base: CitabilityReport = {
    url,
    score: 0,
    signals: [],
    fetchedAt: new Date().toISOString(),
    error: null,
  };

  if (!isValidPublicHttpUrl(url)) {
    return { ...base, error: 'Enter a public http(s) URL — no localhost or private addresses.' };
  }

  let html: string;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { ...base, error: `The page returned HTTP ${res.status}.` };
    }
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return { ...base, error: `Could not fetch the page: ${msg}` };
  }

  // robots.txt is best-effort — its absence is itself a valid signal.
  let robotsTxt: string | null = null;
  try {
    const origin = new URL(url).origin;
    const res = await fetchWithTimeout(`${origin}/robots.txt`);
    if (res.ok) {
      const ct = res.headers.get('content-type') ?? '';
      // A 200 that serves HTML is a soft-404 — treat as "no robots.txt".
      if (!ct.includes('html')) robotsTxt = await res.text();
    }
  } catch {
    // network failure fetching robots.txt — leave as null
  }

  return analyzePage({ url, html, robotsTxt });
}
