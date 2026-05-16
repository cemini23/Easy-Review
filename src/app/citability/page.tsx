import { redirect } from 'next/navigation';
import { getCurrentOperator } from '@/app/actions/operators';
import CitabilityChecker from '@/components/CitabilityChecker';

export const dynamic = 'force-dynamic';

export default async function CitabilityPage() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/onboarding');

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">AI Citability</h1>
          <p className="text-sm text-slate-500">
            {operator.business_name} · score a page on how well AI engines can cite it
          </p>
        </header>
        <CitabilityChecker defaultUrl={operator.website_url ?? ''} />
      </div>
    </main>
  );
}
