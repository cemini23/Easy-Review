import { describe, it, expect } from 'vitest';
import {
  WEEKDAYS,
  schemaTypeForVertical,
  groupOpeningHours,
  placeIdMapsUrl,
  sameAsUrls,
  buildLocalBusinessJsonLd,
  buildFaqPageJsonLd,
  toScriptTag,
  validateProfile,
} from '@/lib/schema-generator';
import type { OpeningHoursEntry, SchemaProfile } from '@/lib/types';

function fullHours(): OpeningHoursEntry[] {
  return WEEKDAYS.map((day) => ({
    day,
    closed: day === 'Sunday',
    opens: '09:00',
    closes: '18:00',
  }));
}

function fullProfile(overrides: Partial<SchemaProfile> = {}): SchemaProfile {
  return {
    businessName: 'Barone Cuts',
    schemaType: 'BarberShop',
    url: 'https://baronecuts.com',
    telephone: '+1-215-555-1234',
    priceRange: '$$',
    imageUrls: ['https://baronecuts.com/storefront.jpg'],
    street: '1234 Main St',
    city: 'Philadelphia',
    region: 'PA',
    postalCode: '19111',
    country: 'US',
    latitude: 40.05,
    longitude: -75.08,
    hours: fullHours(),
    placeId: 'ChIJabc123',
    socialUrls: ['https://instagram.com/baronecuts'],
    services: [
      { name: 'Fade', description: 'Skin or scissor fade', price: '40.00' },
      { name: 'Beard Trim', price: '20.00' },
    ],
    faqs: [
      { question: 'Do I need an appointment?', answer: 'Walk-ins welcome.' },
      { question: 'How much is a cut?', answer: 'Cuts start at $35.' },
    ],
    ...overrides,
  };
}

describe('schemaTypeForVertical', () => {
  it('maps each vertical to a schema.org type', () => {
    expect(schemaTypeForVertical('barbershop')).toBe('BarberShop');
    expect(schemaTypeForVertical('dental')).toBe('Dentist');
    expect(schemaTypeForVertical('salon')).toBe('HairSalon');
    expect(schemaTypeForVertical('gym')).toBe('HealthClub');
    expect(schemaTypeForVertical('retail')).toBe('Store');
    expect(schemaTypeForVertical('restaurant')).toBe('Restaurant');
    expect(schemaTypeForVertical('auto')).toBe('AutoRepair');
  });
  it('falls back to LocalBusiness for "other"', () => {
    expect(schemaTypeForVertical('other')).toBe('LocalBusiness');
  });
});

describe('groupOpeningHours', () => {
  it('merges days that share the same open/close span', () => {
    const groups = groupOpeningHours(fullHours());
    expect(groups).toHaveLength(1);
    expect(groups[0].dayOfWeek).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]);
  });
  it('omits closed days', () => {
    const groups = groupOpeningHours(fullHours());
    expect(groups[0].dayOfWeek).not.toContain('Sunday');
  });
  it('splits into separate groups when spans differ', () => {
    const hours: OpeningHoursEntry[] = [
      { day: 'Monday', closed: false, opens: '09:00', closes: '17:00' },
      { day: 'Saturday', closed: false, opens: '10:00', closes: '15:00' },
    ];
    const groups = groupOpeningHours(hours);
    expect(groups).toHaveLength(2);
  });
  it('drops open days missing a time', () => {
    const hours: OpeningHoursEntry[] = [
      { day: 'Monday', closed: false, opens: '', closes: '17:00' },
    ];
    expect(groupOpeningHours(hours)).toHaveLength(0);
  });
});

describe('placeIdMapsUrl / sameAsUrls', () => {
  it('builds the canonical Google Maps URL', () => {
    expect(placeIdMapsUrl('ChIJabc')).toBe(
      'https://www.google.com/maps/place/?q=place_id:ChIJabc',
    );
  });
  it('lists the GBP maps URL first, then socials', () => {
    const urls = sameAsUrls(fullProfile());
    expect(urls[0]).toContain('place_id:ChIJabc123');
    expect(urls[1]).toBe('https://instagram.com/baronecuts');
  });
  it('omits the maps URL when no place_id is set', () => {
    const urls = sameAsUrls(fullProfile({ placeId: '' }));
    expect(urls.every((u) => !u.includes('place_id'))).toBe(true);
  });
});

describe('buildLocalBusinessJsonLd', () => {
  it('emits a correct top-level shape', () => {
    const ld = buildLocalBusinessJsonLd(fullProfile());
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('BarberShop');
    expect(ld['@id']).toBe('https://baronecuts.com/#barbershop');
    expect(ld.name).toBe('Barone Cuts');
  });
  it('includes a PostalAddress when address fields are set', () => {
    const ld = buildLocalBusinessJsonLd(fullProfile());
    expect(ld.address).toMatchObject({
      '@type': 'PostalAddress',
      streetAddress: '1234 Main St',
      addressRegion: 'PA',
      addressCountry: 'US',
    });
  });
  it('omits the address entirely when no address fields are set', () => {
    const ld = buildLocalBusinessJsonLd(
      fullProfile({ street: '', city: '', region: '', postalCode: '' }),
    );
    expect(ld.address).toBeUndefined();
  });
  it('includes geo only when both coordinates are numbers', () => {
    expect(buildLocalBusinessJsonLd(fullProfile()).geo).toMatchObject({
      '@type': 'GeoCoordinates',
      latitude: 40.05,
    });
    const noGeo = buildLocalBusinessJsonLd(
      fullProfile({ latitude: undefined, longitude: undefined }),
    );
    expect(noGeo.geo).toBeUndefined();
  });
  it('builds an OfferCatalog with priced Offers', () => {
    const ld = buildLocalBusinessJsonLd(fullProfile());
    const catalog = ld.hasOfferCatalog as Record<string, unknown>;
    expect(catalog['@type']).toBe('OfferCatalog');
    const items = catalog.itemListElement as Record<string, unknown>[];
    expect(items[0]).toMatchObject({
      '@type': 'Offer',
      price: '40.00',
      priceCurrency: 'USD',
    });
    expect((items[0].itemOffered as Record<string, unknown>).name).toBe('Fade');
  });
  it('omits priceCurrency for an unpriced service', () => {
    const ld = buildLocalBusinessJsonLd(
      fullProfile({ services: [{ name: 'Consultation' }] }),
    );
    const items = (ld.hasOfferCatalog as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[];
    expect(items[0].price).toBeUndefined();
    expect(items[0].priceCurrency).toBeUndefined();
  });
  it('omits hasOfferCatalog when there are no named services', () => {
    const ld = buildLocalBusinessJsonLd(fullProfile({ services: [] }));
    expect(ld.hasOfferCatalog).toBeUndefined();
  });
  it('never emits aggregateRating or review', () => {
    const ld = buildLocalBusinessJsonLd(fullProfile());
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
  });
});

describe('buildFaqPageJsonLd', () => {
  it('builds a FAQPage with Question/Answer pairs', () => {
    const ld = buildFaqPageJsonLd(fullProfile().faqs);
    expect(ld).not.toBeNull();
    expect(ld!['@type']).toBe('FAQPage');
    const main = ld!.mainEntity as Record<string, unknown>[];
    expect(main).toHaveLength(2);
    expect(main[0]).toMatchObject({
      '@type': 'Question',
      name: 'Do I need an appointment?',
    });
    expect(main[0].acceptedAnswer).toMatchObject({
      '@type': 'Answer',
      text: 'Walk-ins welcome.',
    });
  });
  it('returns null when there are no usable FAQs', () => {
    expect(buildFaqPageJsonLd([])).toBeNull();
    expect(buildFaqPageJsonLd([{ question: 'Q?', answer: '' }])).toBeNull();
  });
});

describe('toScriptTag', () => {
  it('wraps the object in a ld+json script tag', () => {
    const tag = toScriptTag(buildLocalBusinessJsonLd(fullProfile()));
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith('</script>')).toBe(true);
    expect(tag).toContain('"@type": "BarberShop"');
  });
});

describe('validateProfile', () => {
  it('returns no warnings for a complete profile', () => {
    expect(validateProfile(fullProfile())).toEqual([]);
  });
  it('warns about a missing address', () => {
    const w = validateProfile(
      fullProfile({ street: '', city: '', region: '', postalCode: '' }),
    );
    expect(w.join(' ')).toMatch(/address/i);
  });
  it('warns about missing geo coordinates', () => {
    const w = validateProfile(fullProfile({ latitude: undefined, longitude: undefined }));
    expect(w.join(' ')).toMatch(/latitude/i);
  });
  it('warns about missing FAQs', () => {
    const w = validateProfile(fullProfile({ faqs: [] }));
    expect(w.join(' ')).toMatch(/FAQ/i);
  });
});
