'use client';

import { useState, useTransition } from 'react';
import { analyzeUrl } from '@/app/actions/citability';
import type { CitabilityReport, CitabilityStatus, CitabilitySignal } from '@/lib/types';

const WIKI_BASE = 'https://github.com/cemini23/SEO-GEO-B-M-Wiki/blob/main/wiki/concepts';
const GEO = `${WIKI_BASE}/generative-engine-optimization.md`;
const SCHEMA = `${WIKI_BASE}/schema-markup-local.md`;

const SIGNAL_DOC: Record<string, string> = {
  schema: SCHEMA,
  statistics: GEO,
  citations: GEO,
  faq: SCHEMA,
  depth: GEO,
  crawler: GEO,
  stuffing: GEO,
};

const STATUS_BADGE: Record<CitabilityStatus, string> = {
  ok: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  fail: 'bg-red-100 text-red-800',
  info: 'bg-slate-100 text-slate-800',
};

const STATUS_GLYPH: Record<CitabilityStatus, string> = {
  ok: '✓',
  warn: '⚠',
  fail: '✗',
  info: '·',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-700';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Strong — AI engines can retrieve and cite this page well.';
  if (score >= 50) return 'Mixed — fixable gaps are holding the page back.';
  return 'Weak — AI engines will struggle to cite this page.';
}

export default function CitabilityChecker({ defaultUrl }: { defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [report, setReport] = useState<CitabilityReport | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    if (!url.trim()) return;
    startTransition(async () => {
      setReport(await analyzeUrl(url));
    });
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <label htmlFor="url" className="block text-sm font-medium text-slate-700 mb-1">
          Page URL
        </label>
        <div className="flex gap-2">
          <input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run();
            }}
            placeholder="https://yourshop.com"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={run}
            disabled={pending}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md disabled:opacity-50 transition-colors"
          >
            {pending ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Checks structured data, statistics, quotations, FAQ format, depth, keyword density,
          and AI-crawler access — the levers from Aggarwal 2024 GEO research.
        </p>
      </section>

      {report?.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800">
          {report.error}
        </div>
      )}

      {report && !report.error && (
        <>
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center gap-6">
            <div className="text-center">
              <div className={`text-5xl font-extrabold ${scoreColor(report.score)}`}>
                {report.score}
              </div>
              <div className="text-xs text-slate-400 mt-1">/ 100</div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{scoreLabel(report.score)}</p>
              <p className="text-xs text-slate-500 mt-1 break-all">{report.url}</p>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Signals</h2>
            <p className="text-sm text-slate-500 mb-4">Each row links to the wiki playbook.</p>
            <div>
              {report.signals.map((s) => (
                <SignalRow key={s.key} signal={s} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SignalRow({ signal }: { signal: CitabilitySignal }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-3">
        <span
          aria-label={signal.status}
          className={`mt-0.5 inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-full text-sm font-semibold ${STATUS_BADGE[signal.status]}`}
        >
          {STATUS_GLYPH[signal.status]}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-900">{signal.label}</span>
            <a
              href={SIGNAL_DOC[signal.key] ?? GEO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0"
            >
              Learn more →
            </a>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{signal.detail}</p>
          {signal.status !== 'ok' && (
            <p className="text-xs text-slate-700 mt-1">
              <span className="font-semibold text-slate-600">Fix: </span>
              {signal.fix}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
