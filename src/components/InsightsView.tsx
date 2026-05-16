'use client';

import { useState, useTransition } from 'react';
import SiteHealthCard from '@/components/SiteHealthCard';
import { categorize } from '@/lib/categorize';
import { categoryPercentages } from '@/lib/review-analytics';
import { extractThemes, type ThemeResult } from '@/app/actions/themes';
import type {
  Category,
  Operator,
  ReviewAnalytics,
  ReviewTheme,
} from '@/lib/types';

const CATEGORY_LABEL: Record<Category, string> = {
  '5star_specific': '5★ specific',
  '5star_generic': '5★ generic',
  '4star': '4★',
  '3star_mixed': '3★ mixed',
  '1_2star_complaint': '1–2★ complaint',
  '1star_fake': '1★ likely-fake',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as Category[];

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthLabel(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTH_ABBR[m - 1] ?? key;
}

export default function InsightsView({
  operator,
  analytics,
}: {
  operator: Operator;
  analytics: ReviewAnalytics;
}) {
  return (
    <div className="space-y-6">
      <AnalyticsSection analytics={analytics} />
      <ThemesSection operatorId={operator.id} />
      <BenchmarkSection operator={operator} analytics={analytics} />
    </div>
  );
}

/* ---------------------------------------------------------------- Analytics */

function AnalyticsSection({ analytics: a }: { analytics: ReviewAnalytics }) {
  const totalRated = a.ratingCounts.reduce((s, n) => s + n, 0);
  const trendMax = Math.max(1, ...a.monthlyTrend.map((m) => m.count));
  const catMax = Math.max(1, ...CATEGORY_ORDER.map((c) => a.categoryCounts[c]));

  if (a.total === 0) {
    return (
      <SiteHealthCard title="Analytics" subtitle="Velocity, recency, and the response funnel">
        <p className="text-sm text-slate-500 pt-1">
          No reviews processed yet. Add reviews on the Reviews tab and metrics appear here.
        </p>
      </SiteHealthCard>
    );
  }

  return (
    <SiteHealthCard title="Analytics" subtitle="Velocity, recency, and the response funnel">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <Metric label="Total reviews" value={String(a.total)} />
        <Metric
          label="Avg rating"
          value={a.averageRating != null ? a.averageRating.toFixed(2) : '—'}
        />
        <Metric label="Last 30 days" value={String(a.velocity30d)} hint="velocity" />
        <Metric
          label="Most recent"
          value={a.daysSinceLastReview != null ? `${a.daysSinceLastReview}d ago` : '—'}
          hint="recency"
        />
      </div>

      <div className="mt-5">
        <SectionLabel>Response rate</SectionLabel>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500"
              style={{ width: `${Math.round(a.responseRate * 100)}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-900">
            {Math.round(a.responseRate * 100)}%
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {a.statusCounts.posted} posted · {a.statusCounts.skipped} skipped ·{' '}
          {a.statusCounts.pending + a.statusCounts.edited} pending
        </p>
      </div>

      <div className="mt-5">
        <SectionLabel>Rating distribution</SectionLabel>
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = a.ratingCounts[star - 1];
            return (
              <BarRow
                key={star}
                label={`${star}★`}
                count={count}
                pct={totalRated > 0 ? (count / totalRated) * 100 : 0}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <SectionLabel>Category mix</SectionLabel>
        <div className="space-y-1.5">
          {CATEGORY_ORDER.map((c) => (
            <BarRow
              key={c}
              label={CATEGORY_LABEL[c]}
              count={a.categoryCounts[c]}
              pct={(a.categoryCounts[c] / catMax) * 100}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <SectionLabel>Reviews per month</SectionLabel>
        <div className="flex items-end gap-2 h-24">
          {a.monthlyTrend.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-xs text-slate-500">{m.count}</span>
              <div
                className="w-full bg-indigo-400 rounded-t"
                style={{ height: `${(m.count / trendMax) * 100}%`, minHeight: m.count > 0 ? 4 : 2 }}
              />
              <span className="text-[10px] text-slate-400">{monthLabel(m.month)}</span>
            </div>
          ))}
        </div>
      </div>
    </SiteHealthCard>
  );
}

/* ------------------------------------------------------------------- Themes */

function ThemesSection({ operatorId }: { operatorId: string }) {
  const [result, setResult] = useState<ThemeResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      setResult(await extractThemes(operatorId));
    });
  };

  return (
    <SiteHealthCard
      title="Recurring themes"
      subtitle="What customers mention most — extracted from your review text by AI"
    >
      <div className="pt-1">
        <button
          onClick={run}
          disabled={pending}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md disabled:opacity-50 transition-colors"
        >
          {pending ? 'Analyzing reviews…' : result ? 'Re-extract themes' : 'Extract themes'}
        </button>

        {result?.error && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
            {result.error}
          </p>
        )}

        {result && !result.error && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2">
              From {result.reviewCount} reviews. Cite these themes on your website — per the
              Citability tab, real review themes lift AI-engine citations.
            </p>
            {result.themes.length === 0 ? (
              <p className="text-sm text-slate-500">No clear recurring themes found.</p>
            ) : (
              <ul className="space-y-1.5">
                {result.themes.map((t) => (
                  <ThemeRow key={t.theme} theme={t} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </SiteHealthCard>
  );
}

const SENTIMENT_DOT: Record<ReviewTheme['sentiment'], string> = {
  positive: 'bg-green-500',
  negative: 'bg-red-500',
  mixed: 'bg-amber-500',
};

function ThemeRow({ theme }: { theme: ReviewTheme }) {
  return (
    <li className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${SENTIMENT_DOT[theme.sentiment]}`} />
        <span className="text-sm text-slate-900">{theme.theme}</span>
        <span className="text-xs text-slate-400">{theme.sentiment}</span>
      </div>
      <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
        {theme.count} mentions
      </span>
    </li>
  );
}

/* ---------------------------------------------------------------- Benchmark */

interface CompRow {
  rating: number;
  text: string;
}

function BenchmarkSection({
  operator,
  analytics,
}: {
  operator: Operator;
  analytics: ReviewAnalytics;
}) {
  const [rows, setRows] = useState<CompRow[]>([
    { rating: 5, text: '' },
    { rating: 5, text: '' },
    { rating: 5, text: '' },
  ]);
  const [comparison, setComparison] = useState<Record<Category, number> | null>(null);

  const mine = categoryPercentages(analytics.categoryCounts);

  const compare = () => {
    const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<
      Category,
      number
    >;
    let used = 0;
    for (const r of rows) {
      if (!r.text.trim()) continue;
      const category = categorize(
        { id: 'cmp', author: 'competitor', rating: r.rating, text: r.text, date: '', source: 'Manual' },
        operator,
      );
      counts[category]++;
      used++;
    }
    setComparison(used > 0 ? categoryPercentages(counts) : null);
  };

  return (
    <SiteHealthCard
      title="Competitor benchmark"
      subtitle="Paste a competitor's reviews — compare their category mix against yours"
    >
      <div className="space-y-2 pt-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <select
              value={r.rating}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...r, rating: Number(e.target.value) };
                setRows(next);
              }}
              className="px-2 py-2 border border-slate-300 rounded-md text-sm text-slate-900"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}★
                </option>
              ))}
            </select>
            <input
              value={r.text}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...r, text: e.target.value };
                setRows(next);
              }}
              placeholder="Competitor review text"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              className="px-2 py-2 text-slate-400 hover:text-red-600 text-sm"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => setRows([...rows, { rating: 5, text: '' }])}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          + Add review
        </button>
        <button
          onClick={compare}
          className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md transition-colors"
        >
          Compare
        </button>
      </div>

      {comparison && (
        <div className="mt-5">
          <SectionLabel>You vs competitor — category mix</SectionLabel>
          <div className="space-y-2">
            {CATEGORY_ORDER.map((c) => (
              <div key={c}>
                <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                  <span>{CATEGORY_LABEL[c]}</span>
                  <span>
                    you {mine[c]}% · them {comparison[c]}%
                  </span>
                </div>
                <div className="flex gap-1">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${mine[c]}%` }} />
                  </div>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400" style={{ width: `${comparison[c]}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Indigo = you · grey = competitor. A higher competitor share of 4★/3★ reviews points
            to a service gap you may be able to win on.
          </p>
        </div>
      )}
    </SiteHealthCard>
  );
}

/* ----------------------------------------------------------- shared bits */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
      {children}
    </p>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {hint && <div className="text-[10px] text-slate-400 uppercase">{hint}</div>}
    </div>
  );
}

function BarRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-600 shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-400" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="w-8 text-xs text-slate-500 text-right">{count}</span>
    </div>
  );
}
