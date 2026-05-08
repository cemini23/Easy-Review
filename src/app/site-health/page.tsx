import { redirect } from 'next/navigation';
import { getCurrentOperator } from '@/app/actions/operators';
import { fetchSiteSnapshot, getSnapshot } from '@/app/actions/site-health';
import SiteHealthCard from '@/components/SiteHealthCard';
import SiteHealthSignalRow from '@/components/SiteHealthSignalRow';
import type { SiteHealthSnapshot } from '@/lib/types';
import {
  statusBool,
  ratingStatus,
  titleStatus,
  descStatus,
  scoreStatus,
  lcpStatus,
  clsStatus,
} from '@/lib/site-health-status';
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

