import type {
  Category,
  DraftRow,
  DraftStatus,
  MonthBucket,
  ReviewAnalytics,
} from '@/lib/types';

/**
 * Review analytics — pure aggregation over an operator's processed reviews.
 *
 * The wiki (`concepts/reviews-reputation-management.md`) calls review
 * **velocity** (reviews per month) and **recency** (months since the last
 * review) the two highest-correlation review ranking signals — so those,
 * plus the response funnel, are the headline metrics here.
 */

const ALL_CATEGORIES: Category[] = [
  '5star_specific',
  '5star_generic',
  '4star',
  '3star_mixed',
  '1_2star_complaint',
  '1star_fake',
];

const ALL_STATUSES: DraftStatus[] = [
  'pending',
  'edited',
  'approved',
  'posted',
  'skipped',
  'obsolete',
];

const DAY_MS = 86_400_000;

/** Parse a "YYYY-MM-DD" review_date to a Date, or null if unparseable. */
function parseReviewDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM" key for a date. */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The last 6 month keys ending at `now`, oldest → newest. */
function recentMonths(now: Date): string[] {
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

/** Compute the full analytics rollup. `now` is injectable for testing. */
export function computeAnalytics(drafts: DraftRow[], now: Date = new Date()): ReviewAnalytics {
  const ratingCounts = [0, 0, 0, 0, 0];
  const categoryCounts = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, 0]),
  ) as Record<Category, number>;
  const statusCounts = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0]),
  ) as Record<DraftStatus, number>;
  const monthCounts = new Map<string, number>();

  let ratingSum = 0;
  let ratedCount = 0;
  let velocity30d = 0;
  let latest: number | null = null;
  const cutoff = now.getTime() - 30 * DAY_MS;

  for (const d of drafts) {
    if (d.review_rating >= 1 && d.review_rating <= 5) {
      ratingCounts[d.review_rating - 1]++;
      ratingSum += d.review_rating;
      ratedCount++;
    }
    if (categoryCounts[d.category] !== undefined) categoryCounts[d.category]++;
    if (statusCounts[d.status] !== undefined) statusCounts[d.status]++;

    const date = parseReviewDate(d.review_date);
    if (date) {
      const t = date.getTime();
      if (t >= cutoff && t <= now.getTime()) velocity30d++;
      if (latest === null || t > latest) latest = t;
      const key = monthKey(date);
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
  }

  const total = drafts.length;
  const respondable = total - statusCounts.obsolete;
  const responseRate = respondable > 0 ? statusCounts.posted / respondable : 0;

  const daysSinceLastReview =
    latest === null ? null : Math.max(0, Math.floor((now.getTime() - latest) / DAY_MS));

  const monthlyTrend: MonthBucket[] = recentMonths(now).map((month) => ({
    month,
    count: monthCounts.get(month) ?? 0,
  }));

  return {
    total,
    averageRating: ratedCount > 0 ? ratingSum / ratedCount : null,
    ratingCounts,
    categoryCounts,
    statusCounts,
    responseRate,
    velocity30d,
    daysSinceLastReview,
    monthlyTrend,
  };
}

/**
 * Convert raw category counts to percentages (0–100, rounded). Used to
 * compare an operator's review mix against a competitor's.
 */
export function categoryPercentages(
  counts: Record<Category, number>,
): Record<Category, number> {
  const total = ALL_CATEGORIES.reduce((sum, c) => sum + (counts[c] ?? 0), 0);
  const out = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [
      c,
      total > 0 ? Math.round(((counts[c] ?? 0) / total) * 100) : 0,
    ]),
  ) as Record<Category, number>;
  return out;
}
