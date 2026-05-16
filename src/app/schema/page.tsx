import { redirect } from 'next/navigation';
import { getCurrentOperator } from '@/app/actions/operators';
import { getSchemaProfile } from '@/app/actions/schema';
import SchemaGeneratorForm from '@/components/SchemaGeneratorForm';

export const dynamic = 'force-dynamic';

export default async function SchemaPage() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/onboarding');

  const savedProfile = await getSchemaProfile(operator.id);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Schema Markup</h1>
          <p className="text-sm text-slate-500">
            {operator.business_name} · generate LocalBusiness + FAQ JSON-LD for your website
          </p>
        </header>
        <SchemaGeneratorForm operator={operator} savedProfile={savedProfile} />
      </div>
    </main>
  );
}
