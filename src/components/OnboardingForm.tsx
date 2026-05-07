'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOperator } from '@/app/actions/operators';
import type { Vertical } from '@/lib/types';

const VERTICALS: Vertical[] = [
  'barbershop', 'dental', 'salon', 'gym', 'retail', 'restaurant', 'auto', 'other',
];

export default function OnboardingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await createOperator({
          email: String(formData.get('email')),
          business_name: String(formData.get('business_name')),
          vertical: String(formData.get('vertical')) as Vertical,
          sign_off: String(formData.get('sign_off') || '') || undefined,
          services: String(formData.get('services') || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          staff_names: String(formData.get('staff_names') || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        });
        router.push('/');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Setup failed');
      }
    });
  };

  return (
    <form action={submit} className="space-y-4 max-w-md mx-auto p-6 bg-white rounded-xl shadow">
      <h2 className="text-xl font-bold text-gray-900">Set up your shop</h2>
      <input name="email" type="email" placeholder="Your email" required className="w-full p-2 border rounded" />
      <input name="business_name" placeholder='Business name (e.g. "Barone Cuts")' required className="w-full p-2 border rounded" />
      <select name="vertical" required className="w-full p-2 border rounded">
        {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <input name="sign_off" placeholder='Sign-off (optional, e.g. "— Joey")' className="w-full p-2 border rounded" />
      <input name="services" placeholder="Services (comma-separated, e.g. fade, beard trim)" className="w-full p-2 border rounded" />
      <input name="staff_names" placeholder="Staff names (comma-separated, e.g. Joey, Mike)" className="w-full p-2 border rounded" />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={pending} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg disabled:opacity-50">
        {pending ? 'Setting up…' : 'Save'}
      </button>
    </form>
  );
}
