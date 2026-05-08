import { ReactNode } from 'react';

export interface SiteHealthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function SiteHealthCard({ title, subtitle, children }: SiteHealthCardProps) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}
