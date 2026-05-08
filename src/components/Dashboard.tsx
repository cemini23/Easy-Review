'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { listPendingDrafts } from '@/app/actions/drafts';
import ReviewInputForm from '@/components/ReviewInputForm';
import ReviewCard from '@/components/ReviewCard';
import type { DraftRow, Operator } from '@/lib/types';

export default function Dashboard({
  operator,
  initialDrafts,
}: {
  operator: Operator;
  initialDrafts: DraftRow[];
}) {
  const [drafts, setDrafts] = useState<DraftRow[]>(initialDrafts);
  const [, startTransition] = useTransition();

  const reload = () => {
    startTransition(async () => {
      const fresh = await listPendingDrafts({ operatorId: operator.id });
      setDrafts(fresh);
    });
  };

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center py-6">
        <h1 className="text-3xl font-extrabold text-indigo-950 tracking-tight">
          {operator.business_name} · Reviews
        </h1>
        <nav className="flex items-center gap-3">
          <Link href="/site-health" className="text-sm text-indigo-600 hover:text-indigo-800">
            Site Health →
          </Link>
          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border">
            {new Date().toLocaleDateString()}
          </span>
        </nav>
      </div>

      <ReviewInputForm operator={operator} onCreated={reload} />

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-black flex items-center gap-2">
          Pending Approval
          <span className="text-sm font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {drafts.length}
          </span>
        </h2>
        {drafts.map((d) => (
          <ReviewCard key={d.id} draft={d} operator={operator} onMutate={reload} />
        ))}
        {drafts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-900 font-medium">All caught up.</p>
          </div>
        )}
      </div>
    </main>
  );
}
