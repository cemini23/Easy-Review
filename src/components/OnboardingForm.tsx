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
          website_url: String(formData.get('website_url') || '').trim() || undefined,
          gbp_place_id: String(formData.get('gbp_place_id') || '').trim() || undefined,
        });
        router.push('/');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Setup failed');
      }
    });
  };

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <form action={submit} className="space-y-5 max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-slate-200">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Set up your shop</h2>
        <p className="text-sm text-slate-500 mt-1">One-time setup. You can change these later.</p>
      </div>

      <div>
        <label htmlFor="email" className={labelCls}>Email</label>
        <input id="email" name="email" type="email" placeholder="you@yourshop.com" required className={inputCls} />
      </div>

      <div>
        <label htmlFor="business_name" className={labelCls}>Business name</label>
        <input id="business_name" name="business_name" placeholder="Barone Cuts" required className={inputCls} />
      </div>

      <div>
        <label htmlFor="vertical" className={labelCls}>Type of business</label>
        <select id="vertical" name="vertical" required className={inputCls}>
          {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="sign_off" className={labelCls}>Sign-off <span className="text-slate-400 font-normal">(optional)</span></label>
        <input id="sign_off" name="sign_off" placeholder="— Joey at Barone Cuts" className={inputCls} />
      </div>

      <div>
        <label htmlFor="services" className={labelCls}>Services <span className="text-slate-400 font-normal">(comma-separated)</span></label>
        <input id="services" name="services" placeholder="fade, beard trim, kids cut" className={inputCls} />
      </div>

      <div>
        <label htmlFor="staff_names" className={labelCls}>Staff names <span className="text-slate-400 font-normal">(comma-separated)</span></label>
        <input id="staff_names" name="staff_names" placeholder="Joey, Mike, Tony" className={inputCls} />
      </div>

      <div>
        <label htmlFor="website_url" className={labelCls}>Website URL <span className="text-slate-400 font-normal">(optional, for Site Health)</span></label>
        <input id="website_url" name="website_url" type="url" placeholder="https://yourshop.com" className={inputCls} />
      </div>

      <div>
        <label htmlFor="gbp_place_id" className={labelCls}>Google place_id <span className="text-slate-400 font-normal">(optional, for Site Health)</span></label>
        <input id="gbp_place_id" name="gbp_place_id" placeholder="ChIJ..." className={inputCls} />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" disabled={pending} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {pending ? 'Setting up…' : 'Save'}
      </button>
    </form>
  );
}
