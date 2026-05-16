import { describe, it, expect } from 'vitest';
import { computeAnalytics, categoryPercentages } from '@/lib/review-analytics';
import type { Category, DraftRow } from '@/lib/types';

let seq = 0;
function draft(over: Partial<DraftRow> = {}): DraftRow {
  seq += 1;
  return {
    id: `d${seq}`,
    operator_id: 'op1',
    gbp_review_id: `r${seq}`,
    review_author: 'A',
    review_rating: 5,
    review_text: 'Great',
    review_date: '2026-05-10',
    category: '5star_generic',
    suggested_template_id: '5star_generic',
    ai_draft: '',
    operator_edited_text: null,
    status: 'pending',
    ...over,
  };
}

const NOW = new Date('2026-05-15T00:00:00Z');

describe('computeAnalytics', () => {
  it('handles an empty draft list', () => {
    const a = computeAnalytics([], NOW);
    expect(a.total).toBe(0);
    expect(a.averageRating).toBeNull();
    expect(a.responseRate).toBe(0);
    expect(a.daysSinceLastReview).toBeNull();
    expect(a.monthlyTrend).toHaveLength(6);
  });

  it('counts totals, ratings, and average', () => {
    const a = computeAnalytics(
      [
        draft({ review_rating: 5 }),
        draft({ review_rating: 3 }),
        draft({ review_rating: 1 }),
      ],
      NOW,
    );
    expect(a.total).toBe(3);
    expect(a.ratingCounts).toEqual([1, 0, 1, 0, 1]); // 1★,2★,3★,4★,5★
    expect(a.averageRating).toBeCloseTo(3);
  });

  it('ignores out-of-range ratings in the average', () => {
    const a = computeAnalytics([draft({ review_rating: 5 }), draft({ review_rating: 0 })], NOW);
    expect(a.averageRating).toBe(5);
  });

  it('tallies category and status counts', () => {
    const a = computeAnalytics(
      [
        draft({ category: '5star_specific', status: 'posted' }),
        draft({ category: '5star_specific', status: 'skipped' }),
        draft({ category: '1star_fake', status: 'pending' }),
      ],
      NOW,
    );
    expect(a.categoryCounts['5star_specific']).toBe(2);
    expect(a.categoryCounts['1star_fake']).toBe(1);
    expect(a.statusCounts.posted).toBe(1);
    expect(a.statusCounts.skipped).toBe(1);
  });

  it('computes response rate as posted ÷ (total − obsolete)', () => {
    const a = computeAnalytics(
      [
        draft({ status: 'posted' }),
        draft({ status: 'posted' }),
        draft({ status: 'pending' }),
        draft({ status: 'obsolete' }),
      ],
      NOW,
    );
    // 2 posted / (4 total − 1 obsolete) = 2/3
    expect(a.responseRate).toBeCloseTo(2 / 3);
  });

  it('counts 30-day velocity by review_date', () => {
    const a = computeAnalytics(
      [
        draft({ review_date: '2026-05-14' }), // within 30d
        draft({ review_date: '2026-05-01' }), // within 30d
        draft({ review_date: '2026-01-01' }), // older
      ],
      NOW,
    );
    expect(a.velocity30d).toBe(2);
  });

  it('reports days since the most recent review', () => {
    const a = computeAnalytics(
      [draft({ review_date: '2026-05-10' }), draft({ review_date: '2026-05-13' })],
      NOW,
    );
    expect(a.daysSinceLastReview).toBe(2);
  });

  it('builds a 6-month trend ending at the current month', () => {
    const a = computeAnalytics(
      [
        draft({ review_date: '2026-05-02' }),
        draft({ review_date: '2026-05-20' }),
        draft({ review_date: '2026-03-15' }),
      ],
      NOW,
    );
    expect(a.monthlyTrend.map((m) => m.month)).toEqual([
      '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
    ]);
    expect(a.monthlyTrend[5]).toEqual({ month: '2026-05', count: 2 });
    expect(a.monthlyTrend[3]).toEqual({ month: '2026-03', count: 1 });
  });
});

describe('categoryPercentages', () => {
  it('converts counts to rounded percentages', () => {
    const counts: Record<Category, number> = {
      '5star_specific': 5,
      '5star_generic': 5,
      '4star': 5,
      '3star_mixed': 5,
      '1_2star_complaint': 0,
      '1star_fake': 0,
    };
    const pct = categoryPercentages(counts);
    expect(pct['5star_specific']).toBe(25);
    expect(pct['1_2star_complaint']).toBe(0);
  });

  it('returns all zeros when there are no reviews', () => {
    const counts: Record<Category, number> = {
      '5star_specific': 0, '5star_generic': 0, '4star': 0,
      '3star_mixed': 0, '1_2star_complaint': 0, '1star_fake': 0,
    };
    expect(categoryPercentages(counts)['4star']).toBe(0);
  });
});
