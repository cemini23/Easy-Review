'use client';

import { useState, useTransition } from 'react';
import { createDraftFromReview } from '@/app/actions/drafts';
import type { Operator, Source } from '@/lib/types';

const SOURCES: Source[] = ['Google', 'Yelp', 'TripAdvisor', 'Facebook', 'Manual'];

export default function ReviewInputForm({
  operator,
  onCreated,
}: {
  operator: Operator;
  onCreated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await createDraftFromReview({
          operator,
          review: {
            id: `manual_${Date.now()}`,
            author: String(formData.get('author')),
            rating: Number(formData.get('rating')),
            text: String(formData.get('text')),
            date: String(formData.get('date')),
            source: String(formData.get('source')) as Source,
          },
        });
        onCreated();
        (document.getElementById('review-form') as HTMLFormElement | null)?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create draft');
      }
    });
  };

  return (
    <form id="review-form" action={submit} className="bg-white p-4 rounded-xl border space-y-3">
      <h3 className="font-bold text-gray-900">Add a review</h3>
      <input name="author" placeholder="Customer name" required className="w-full p-2 border rounded" />
      <div className="flex gap-2">
        <select name="rating" required className="flex-1 p-2 border rounded">
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
        <select name="source" defaultValue="Google" required className="flex-1 p-2 border rounded">
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input name="date" type="date" required className="flex-1 p-2 border rounded" />
      </div>
      <textarea name="text" placeholder="Review text" rows={3} required className="w-full p-2 border rounded" />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={pending} className="w-full py-2 bg-indigo-600 text-white font-medium rounded disabled:opacity-50">
        {pending ? 'Drafting reply…' : 'Categorize + Draft'}
      </button>
    </form>
  );
}
