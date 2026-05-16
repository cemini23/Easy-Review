'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary. Catches errors thrown while rendering a page
 * (most often a PocketBase/network failure or a missing env var — see
 * docs/deploy.md troubleshooting). Shows a friendly message instead of a raw
 * 500, and never renders the raw error text to the user (it may reference
 * customer data — keep it to the server logs).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[easyreview] route error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-600">
          The page couldn&apos;t load. This is usually a backend connection problem — check that
          PocketBase is reachable and the environment variables are set.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400">Reference: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
