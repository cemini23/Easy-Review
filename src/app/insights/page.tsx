import { redirect } from 'next/navigation';
import { getCurrentOperator } from '@/app/actions/operators';
import { listAllDrafts } from '@/app/actions/drafts';
import { computeAnalytics } from '@/lib/review-analytics';
import InsightsView from '@/components/InsightsView';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/onboarding');

  const drafts = await listAllDrafts({ operatorId: operator.id });
  const analytics = computeAnalytics(drafts);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Review Insights</h1>
          <p className="text-sm text-slate-500">
            {operator.business_name} · {analytics.total} reviews processed
          </p>
        </header>
        <InsightsView operator={operator} analytics={analytics} />
      </div>
    </main>
  );
}
