'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Reviews' },
  { href: '/insights', label: 'Insights' },
  { href: '/get-reviews', label: 'Get Reviews' },
  { href: '/site-health', label: 'Site Health' },
  { href: '/schema', label: 'Schema' },
  { href: '/citability', label: 'Citability' },
];

/**
 * Global header navigation. Highlights the active tab and scrolls
 * horizontally on narrow (phone) screens so all six tabs stay reachable —
 * the spec's #1 goal is "operator-usable on a phone".
 */
export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
      {LINKS.map((link) => {
        const active =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
