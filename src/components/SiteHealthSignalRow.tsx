import Link from 'next/link';
import type { SignalStatus } from '@/lib/site-health-status';

// Re-export for backward compatibility with existing import sites.
export type { SignalStatus };

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
