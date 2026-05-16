'use client';

import { useEffect, useMemo, useState } from 'react';
import SiteHealthCard from '@/components/SiteHealthCard';
import {
  WEEKDAYS,
  schemaTypeForVertical,
  buildLocalBusinessJsonLd,
  buildFaqPageJsonLd,
  toScriptTag,
  validateProfile,
} from '@/lib/schema-generator';
import type {
  Operator,
  SchemaProfile,
  SchemaService,
  SchemaFaq,
} from '@/lib/types';

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

function defaultProfile(operator: Operator): SchemaProfile {
  return {
    businessName: operator.business_name,
    schemaType: schemaTypeForVertical(operator.vertical),
    url: operator.website_url ?? '',
    telephone: '',
    priceRange: '',
    imageUrls: [''],
    street: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'US',
    latitude: undefined,
    longitude: undefined,
    hours: WEEKDAYS.map((day) => ({
      day,
      closed: day === 'Sunday',
      opens: '09:00',
      closes: '18:00',
    })),
    placeId: operator.gbp_place_id ?? '',
    socialUrls: [''],
    services:
      operator.services.length > 0
        ? operator.services.map((name) => ({ name }))
        : [{ name: '' }],
    faqs: [{ question: '', answer: '' }],
  };
}

function storageKey(operatorId: string): string {
  return `easyreview:schema:${operatorId}`;
}

export default function SchemaGeneratorForm({ operator }: { operator: Operator }) {
  const [profile, setProfile] = useState<SchemaProfile>(() => defaultProfile(operator));
  const [hydrated, setHydrated] = useState(false);

  // Load any saved draft from localStorage after mount. Done in an effect (not
  // a lazy initializer) so the server and first client render agree — reading
  // localStorage during render would cause a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(operator.id));
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SchemaProfile>;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount hydration of persisted state
        setProfile((p) => ({ ...p, ...saved }));
      }
    } catch {
      // ignore corrupt / unavailable storage
    }
    setHydrated(true);
  }, [operator.id]);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(operator.id), JSON.stringify(profile));
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, [profile, hydrated, operator.id]);

  const update = (patch: Partial<SchemaProfile>) =>
    setProfile((p) => ({ ...p, ...patch }));

  const businessLd = useMemo(() => buildLocalBusinessJsonLd(profile), [profile]);
  const faqLd = useMemo(() => buildFaqPageJsonLd(profile.faqs), [profile.faqs]);
  const warnings = useMemo(() => validateProfile(profile), [profile]);

  const businessTag = toScriptTag(businessLd);
  const faqTag = faqLd ? toScriptTag(faqLd) : null;

  const reset = () => {
    if (confirm('Discard this schema draft and reset to your shop defaults?')) {
      setProfile(defaultProfile(operator));
    }
  };

  return (
    <div className="space-y-6">
      {/* --- Business basics --- */}
      <SiteHealthCard title="Business" subtitle="The core identity fields for the LocalBusiness entity">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Field label="Business name">
            <input
              className={inputCls}
              value={profile.businessName}
              onChange={(e) => update({ businessName: e.target.value })}
            />
          </Field>
          <Field label="Schema type (schema.org @type)">
            <input
              className={inputCls}
              value={profile.schemaType}
              onChange={(e) => update({ schemaType: e.target.value })}
            />
          </Field>
          <Field label="Website URL">
            <input
              className={inputCls}
              placeholder="https://yourshop.com"
              value={profile.url}
              onChange={(e) => update({ url: e.target.value })}
            />
          </Field>
          <Field label="Phone number">
            <input
              className={inputCls}
              placeholder="+1-215-555-1234"
              value={profile.telephone ?? ''}
              onChange={(e) => update({ telephone: e.target.value })}
            />
          </Field>
          <Field label="Price range">
            <select
              className={inputCls}
              value={profile.priceRange ?? ''}
              onChange={(e) => update({ priceRange: e.target.value })}
            >
              <option value="">— select —</option>
              <option value="$">$ — budget</option>
              <option value="$$">$$ — mid</option>
              <option value="$$$">$$$ — premium</option>
              <option value="$$$$">$$$$ — luxury</option>
            </select>
          </Field>
          <Field label="GBP place_id">
            <input
              className={inputCls}
              placeholder="ChIJ..."
              value={profile.placeId ?? ''}
              onChange={(e) => update({ placeId: e.target.value })}
            />
          </Field>
        </div>
      </SiteHealthCard>

      {/* --- Address & location --- */}
      <SiteHealthCard title="Address & location" subtitle="Used for PostalAddress + GeoCoordinates">
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="col-span-2">
            <Field label="Street address">
              <input
                className={inputCls}
                placeholder="1234 Main St"
                value={profile.street ?? ''}
                onChange={(e) => update({ street: e.target.value })}
              />
            </Field>
          </div>
          <Field label="City">
            <input
              className={inputCls}
              value={profile.city ?? ''}
              onChange={(e) => update({ city: e.target.value })}
            />
          </Field>
          <Field label="Region / state">
            <input
              className={inputCls}
              placeholder="PA"
              value={profile.region ?? ''}
              onChange={(e) => update({ region: e.target.value })}
            />
          </Field>
          <Field label="Postal code">
            <input
              className={inputCls}
              value={profile.postalCode ?? ''}
              onChange={(e) => update({ postalCode: e.target.value })}
            />
          </Field>
          <Field label="Country (ISO 2-letter)">
            <input
              className={inputCls}
              value={profile.country}
              onChange={(e) => update({ country: e.target.value })}
            />
          </Field>
          <Field label="Latitude">
            <input
              className={inputCls}
              type="number"
              step="any"
              placeholder="40.0500"
              value={profile.latitude ?? ''}
              onChange={(e) =>
                update({ latitude: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Longitude">
            <input
              className={inputCls}
              type="number"
              step="any"
              placeholder="-75.0800"
              value={profile.longitude ?? ''}
              onChange={(e) =>
                update({ longitude: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            />
          </Field>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Coordinates: Google Maps → right-click the shop → &ldquo;What&apos;s here?&rdquo; — 4 decimals is enough.
        </p>
      </SiteHealthCard>

      {/* --- Opening hours --- */}
      <SiteHealthCard title="Opening hours" subtitle="Days sharing the same hours are merged automatically">
        <div className="space-y-2 pt-1">
          {profile.hours.map((h, i) => (
            <div key={h.day} className="flex items-center gap-3">
              <span className="w-24 text-sm text-slate-700">{h.day}</span>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={h.closed}
                  onChange={(e) => {
                    const hours = [...profile.hours];
                    hours[i] = { ...h, closed: e.target.checked };
                    update({ hours });
                  }}
                />
                Closed
              </label>
              {!h.closed && (
                <>
                  <input
                    type="time"
                    className="px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                    value={h.opens}
                    onChange={(e) => {
                      const hours = [...profile.hours];
                      hours[i] = { ...h, opens: e.target.value };
                      update({ hours });
                    }}
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="time"
                    className="px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                    value={h.closes}
                    onChange={(e) => {
                      const hours = [...profile.hours];
                      hours[i] = { ...h, closes: e.target.value };
                      update({ hours });
                    }}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </SiteHealthCard>

      {/* --- Services --- */}
      <SiteHealthCard title="Services" subtitle="Each becomes a priced Offer in the hasOfferCatalog">
        <ListEditor
          items={profile.services}
          onChange={(services) => update({ services })}
          blank={(): SchemaService => ({ name: '' })}
          addLabel="Add service"
          render={(s, i, set) => (
            <div className="grid grid-cols-12 gap-2">
              <input
                className={`${inputCls} col-span-4`}
                placeholder="Service name"
                value={s.name}
                onChange={(e) => set({ ...s, name: e.target.value })}
              />
              <input
                className={`${inputCls} col-span-5`}
                placeholder="Short description (optional)"
                value={s.description ?? ''}
                onChange={(e) => set({ ...s, description: e.target.value })}
              />
              <input
                className={`${inputCls} col-span-3`}
                placeholder="Price e.g. 40.00"
                value={s.price ?? ''}
                onChange={(e) => set({ ...s, price: e.target.value })}
              />
            </div>
          )}
        />
      </SiteHealthCard>

      {/* --- FAQs --- */}
      <SiteHealthCard title="FAQs" subtitle="Generates FAQPage schema — SERP accordions + AI-citation lift">
        <ListEditor
          items={profile.faqs}
          onChange={(faqs) => update({ faqs })}
          blank={(): SchemaFaq => ({ question: '', answer: '' })}
          addLabel="Add FAQ"
          render={(f, i, set) => (
            <div className="space-y-2">
              <input
                className={inputCls}
                placeholder="Question — e.g. Do I need an appointment?"
                value={f.question}
                onChange={(e) => set({ ...f, question: e.target.value })}
              />
              <textarea
                className={inputCls}
                rows={2}
                placeholder="Answer"
                value={f.answer}
                onChange={(e) => set({ ...f, answer: e.target.value })}
              />
            </div>
          )}
        />
      </SiteHealthCard>

      {/* --- sameAs links --- */}
      <SiteHealthCard title="sameAs links" subtitle="Social + directory profiles for entity disambiguation">
        <ListEditor
          items={profile.socialUrls}
          onChange={(socialUrls) => update({ socialUrls })}
          blank={() => ''}
          addLabel="Add link"
          render={(u, i, set) => (
            <input
              className={inputCls}
              placeholder="https://instagram.com/yourshop"
              value={u}
              onChange={(e) => set(e.target.value)}
            />
          )}
        />
        <p className="text-xs text-slate-400 mt-2">
          The GBP place_id above is added to sameAs automatically.
        </p>
      </SiteHealthCard>

      {/* --- Storefront images --- */}
      <SiteHealthCard title="Storefront images" subtitle="Image URLs for the schema image array">
        <ListEditor
          items={profile.imageUrls}
          onChange={(imageUrls) => update({ imageUrls })}
          blank={() => ''}
          addLabel="Add image URL"
          render={(u, i, set) => (
            <input
              className={inputCls}
              placeholder="https://yourshop.com/storefront.jpg"
              value={u}
              onChange={(e) => set(e.target.value)}
            />
          )}
        />
      </SiteHealthCard>

      {/* --- Checklist --- */}
      <SiteHealthCard title="Completeness" subtitle="Non-blocking — the schema is valid even with warnings">
        {warnings.length === 0 ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
            ✓ Looks complete. Validate the output below, then paste it into your site.
          </p>
        ) : (
          <ul className="space-y-1.5 pt-1">
            {warnings.map((w) => (
              <li key={w} className="text-sm text-amber-800 flex gap-2">
                <span aria-hidden>⚠</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
      </SiteHealthCard>

      {/* --- Output --- */}
      <SiteHealthCard
        title="Generated JSON-LD"
        subtitle="Paste into the <head> of your homepage (or per-location page)"
      >
        <div className="space-y-4 pt-1">
          <CodeBlock label="LocalBusiness" code={businessTag} />
          {faqTag ? (
            <CodeBlock label="FAQPage" code={faqTag} />
          ) : (
            <p className="text-xs text-slate-400">
              FAQPage block appears once you add at least one complete FAQ above.
            </p>
          )}
        </div>
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          Never add <code>aggregateRating</code> or <code>Review</code> schema unless those exact
          reviews are visible on the page — fabricated ratings are a structured-data-spam violation.
          This generator omits them on purpose.
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href="https://search.google.com/test/rich-results"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 underline"
          >
            Google Rich Results Test →
          </a>
          <a
            href="https://validator.schema.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 underline"
          >
            schema.org Validator →
          </a>
          <button onClick={reset} className="text-slate-500 hover:text-slate-700 underline">
            Reset to shop defaults
          </button>
        </div>
      </SiteHealthCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — operator can still select the text
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
      <pre className="text-xs bg-slate-900 text-slate-100 rounded-md p-3 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Generic add/remove list editor. `T` is the item type; `render` draws one row
 * and is handed a `set` callback to replace that row.
 */
function ListEditor<T>({
  items,
  onChange,
  blank,
  addLabel,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  addLabel: string;
  render: (item: T, index: number, set: (next: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-3 pt-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            {render(item, i, (next) => {
              const copy = [...items];
              copy[i] = next;
              onChange(copy);
            })}
          </div>
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="px-2 py-2 text-slate-400 hover:text-red-600 text-sm"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, blank()])}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
      >
        + {addLabel}
      </button>
    </div>
  );
}
