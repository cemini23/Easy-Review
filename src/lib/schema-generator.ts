import type {
  OpeningHoursEntry,
  SchemaFaq,
  SchemaProfile,
  Vertical,
  Weekday,
} from '@/lib/types';

/**
 * Schema.org JSON-LD generator for local-business websites.
 *
 * Pure functions only — no I/O, no network. Given a `SchemaProfile`, produce
 * a `LocalBusiness`-subtype block and (optionally) a `FAQPage` block, both
 * ready to paste into a page `<head>`.
 *
 * Source of truth for the shape + rules:
 * `SEO:GEO B&M Business/wiki/concepts/schema-markup-local.md`.
 *
 * Safe by construction: this generator NEVER emits `aggregateRating` or
 * `Review` schema. Per the wiki, structured ratings without matching
 * on-page reviews are a structured-data-spam violation.
 */

/** The 7 weekdays in render order. */
export const WEEKDAYS: Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Map an operator `vertical` to the most specific schema.org `LocalBusiness`
 * subtype. Every value here is a real schema.org type. `other` falls back to
 * the `LocalBusiness` base type.
 */
const VERTICAL_SCHEMA_TYPE: Record<Vertical, string> = {
  barbershop: 'BarberShop',
  dental: 'Dentist',
  salon: 'HairSalon',
  gym: 'HealthClub',
  retail: 'Store',
  restaurant: 'Restaurant',
  auto: 'AutoRepair',
  other: 'LocalBusiness',
};

export function schemaTypeForVertical(vertical: Vertical): string {
  return VERTICAL_SCHEMA_TYPE[vertical] ?? 'LocalBusiness';
}

/** A run of days that share one open/close span. */
export interface OpeningHoursGroup {
  dayOfWeek: Weekday[];
  opens: string;
  closes: string;
}

/**
 * Collapse per-day hours into `OpeningHoursSpecification`-shaped groups:
 * open days that share the same `opens`+`closes` are merged into one group
 * with a `dayOfWeek` array. Closed days, and open days missing a time, are
 * dropped. Input order is preserved.
 */
export function groupOpeningHours(hours: OpeningHoursEntry[]): OpeningHoursGroup[] {
  const groups: OpeningHoursGroup[] = [];
  for (const h of hours) {
    if (h.closed) continue;
    if (!h.opens || !h.closes) continue;
    const existing = groups.find((g) => g.opens === h.opens && g.closes === h.closes);
    if (existing) {
      existing.dayOfWeek.push(h.day);
    } else {
      groups.push({ dayOfWeek: [h.day], opens: h.opens, closes: h.closes });
    }
  }
  return groups;
}

/** Build the canonical Google Maps URL for a GBP place_id. */
export function placeIdMapsUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

/** All `sameAs` URLs for a profile: the GBP maps URL first, then socials. */
export function sameAsUrls(profile: SchemaProfile): string[] {
  const urls: string[] = [];
  if (profile.placeId?.trim()) urls.push(placeIdMapsUrl(profile.placeId.trim()));
  for (const u of profile.socialUrls) {
    const trimmed = u.trim();
    if (trimmed) urls.push(trimmed);
  }
  return urls;
}

/** Drop keys whose value is undefined, null, '', or an empty array. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

function buildAddress(p: SchemaProfile): Record<string, unknown> | undefined {
  const address = compact({
    '@type': 'PostalAddress',
    streetAddress: p.street?.trim(),
    addressLocality: p.city?.trim(),
    addressRegion: p.region?.trim(),
    postalCode: p.postalCode?.trim(),
    addressCountry: p.country?.trim() || 'US',
  });
  // Only `@type` + country present means no real address was entered.
  return Object.keys(address).length > 2 ? address : undefined;
}

function buildGeo(p: SchemaProfile): Record<string, unknown> | undefined {
  if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return undefined;
  if (Number.isNaN(p.latitude) || Number.isNaN(p.longitude)) return undefined;
  return { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude };
}

function buildOpeningHoursSpec(p: SchemaProfile): Record<string, unknown>[] {
  return groupOpeningHours(p.hours).map((g) =>
    compact({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: g.dayOfWeek.length === 1 ? g.dayOfWeek[0] : g.dayOfWeek,
      opens: g.opens,
      closes: g.closes,
    }),
  );
}

function buildOfferCatalog(p: SchemaProfile): Record<string, unknown> | undefined {
  const named = p.services.filter((s) => s.name.trim().length > 0);
  if (named.length === 0) return undefined;
  return {
    '@type': 'OfferCatalog',
    name: `${p.businessName} services`,
    itemListElement: named.map((s) => {
      const service = compact({
        '@type': 'Service',
        name: s.name.trim(),
        description: s.description?.trim(),
      });
      return compact({
        '@type': 'Offer',
        itemOffered: service,
        price: s.price?.trim(),
        priceCurrency: s.price?.trim() ? 'USD' : undefined,
      });
    }),
  };
}

/** Build the LocalBusiness-subtype JSON-LD object for a profile. */
export function buildLocalBusinessJsonLd(p: SchemaProfile): Record<string, unknown> {
  const url = p.url.trim();
  const fragment = p.schemaType.toLowerCase();
  return compact({
    '@context': 'https://schema.org',
    '@type': p.schemaType,
    '@id': url ? `${url.replace(/\/+$/, '')}/#${fragment}` : undefined,
    name: p.businessName.trim(),
    url: url || undefined,
    image: p.imageUrls.map((u) => u.trim()).filter(Boolean),
    telephone: p.telephone?.trim(),
    priceRange: p.priceRange?.trim(),
    address: buildAddress(p),
    geo: buildGeo(p),
    openingHoursSpecification: buildOpeningHoursSpec(p),
    sameAs: sameAsUrls(p),
    hasOfferCatalog: buildOfferCatalog(p),
  });
}

/**
 * Build the FAQPage JSON-LD object, or `null` when there are no usable FAQs
 * (an FAQPage with zero questions is invalid).
 */
export function buildFaqPageJsonLd(faqs: SchemaFaq[]): Record<string, unknown> | null {
  const usable = faqs.filter(
    (f) => f.question.trim().length > 0 && f.answer.trim().length > 0,
  );
  if (usable.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: usable.map((f) => ({
      '@type': 'Question',
      name: f.question.trim(),
      acceptedAnswer: { '@type': 'Answer', text: f.answer.trim() },
    })),
  };
}

/** Wrap a JSON-LD object in a pretty-printed `<script>` tag. */
export function toScriptTag(obj: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
}

/**
 * Non-blocking completeness warnings for a profile. Each string is a concrete
 * thing the operator can fix to make the schema more complete or more useful.
 * An empty array means the profile is in good shape.
 */
export function validateProfile(p: SchemaProfile): string[] {
  const warnings: string[] = [];
  if (!p.url.trim()) {
    warnings.push('Website URL is missing — it anchors the @id and url fields.');
  }
  if (!buildAddress(p)) {
    warnings.push('Add a full street address — Google needs it to place you in the local pack.');
  }
  if (!buildGeo(p)) {
    warnings.push('Add latitude/longitude (Google Maps → right-click the shop → "What\'s here?").');
  }
  if (!p.telephone?.trim()) {
    warnings.push('Add a phone number so click-to-call works in search results.');
  }
  if (groupOpeningHours(p.hours).length === 0) {
    warnings.push('Add opening hours — closed days are simply omitted.');
  }
  if (!p.priceRange?.trim()) {
    warnings.push('Add a price range ($ to $$$$) to set customer expectations.');
  }
  if (p.imageUrls.map((u) => u.trim()).filter(Boolean).length === 0) {
    warnings.push('Add at least one storefront image URL — Rich Results expects an image.');
  }
  if (!buildOfferCatalog(p)) {
    warnings.push('Add your services — priced services surface in "[business] prices" queries.');
  }
  if (buildFaqPageJsonLd(p.faqs) === null) {
    warnings.push('Add 3–5 FAQs — FAQPage schema unlocks SERP accordions and lifts AI citations.');
  }
  if (sameAsUrls(p).length === 0) {
    warnings.push('Add sameAs links (GBP place_id, Instagram, Facebook, Yelp) for entity disambiguation.');
  }
  return warnings;
}
