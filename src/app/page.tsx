import { redirect } from 'next/navigation';
import { getCurrentOperator } from '@/app/actions/operators';
import { listPendingDrafts } from '@/app/actions/drafts';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const operator = await getCurrentOperator();
  if (!operator) redirect('/onboarding');

  const drafts = await listPendingDrafts({ operatorId: operator.id });
  return <Dashboard operator={operator} initialDrafts={drafts} />;
}
