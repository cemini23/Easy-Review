'use client';

import { useState } from 'react';
import { smsTemplate, emailTemplate } from '@/lib/review-link';

export default function ReviewLinkCard({
  businessName,
  url,
  qrDataUrl,
}: {
  businessName: string;
  url: string;
  qrDataUrl: string;
}) {
  const sms = smsTemplate(businessName, url);
  const email = emailTemplate(businessName, url);
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900">Review QR code</h2>
        <p className="text-sm text-slate-500 mt-1">
          Print it for the front desk or the back of a business card. Scanning opens the Google
          review form for {businessName}.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URL QR, no Next image optimization possible */}
          <img
            src={qrDataUrl}
            alt={`Google review QR code for ${businessName}`}
            className="w-56 h-56 border border-slate-200 rounded-lg"
          />
          <a
            href={qrDataUrl}
            download={`${slug || 'review'}-google-review-qr.png`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md transition-colors"
          >
            Download QR (PNG)
          </a>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Review link</h2>
          <p className="text-sm text-slate-500 mt-1">
            Paste it into a text, email, or booking-confirmation message.
          </p>
        </div>
        <CopyField label="Direct link" value={url} mono />
        <CopyField label="SMS message" value={sms} multiline />
        <CopyField label="Email subject" value={email.subject} />
        <CopyField label="Email body" value={email.body} multiline />
      </section>

      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-xs text-red-800">
        <strong>Send this to every customer</strong> — not only the ones you expect to leave 5★.
        Selectively asking happy customers (&ldquo;review gating&rdquo;) violates Google&apos;s
        policy and risks listing suspension. Asking everyone is fine and expected.
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  multiline,
  mono,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the field is selectable as a fallback
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
        <button
          onClick={copy}
          className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      {multiline ? (
        <textarea
          readOnly
          value={value}
          rows={value.split('\n').length + 1}
          className="w-full p-2 border border-slate-300 rounded-md text-sm text-slate-800 bg-slate-50 resize-none"
        />
      ) : (
        <input
          readOnly
          value={value}
          className={`w-full p-2 border border-slate-300 rounded-md text-sm text-slate-800 bg-slate-50 ${
            mono ? 'font-mono text-xs' : ''
          }`}
        />
      )}
    </div>
  );
}
