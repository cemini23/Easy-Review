import { describe, it, expect } from 'vitest';
import type { Operator, SiteHealthSnapshot } from '@/lib/types';

describe('Operator type', () => {
  it('accepts new optional website_url + gbp_place_id', () => {
    const op: Operator = {
      id: '1',
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      services: [],
      staff_names: [],
      active: true,
      website_url: 'https://example.com',
      gbp_place_id: 'ChIJxxx',
    };
    expect(op.website_url).toBe('https://example.com');
    expect(op.gbp_place_id).toBe('ChIJxxx');
  });

  it('accepts an Operator without the new fields (backward compat)', () => {
    const op: Operator = {
      id: '1',
      email: 'a@b.com',
      business_name: 'X',
      vertical: 'barbershop',
      services: [],
      staff_names: [],
      active: true,
    };
    expect(op.website_url).toBeUndefined();
  });
});

describe('SiteHealthSnapshot type', () => {
  it('represents a fully-populated snapshot', () => {
    const s: SiteHealthSnapshot = {
      id: 'r1',
      operator_id: 'op1',
      fetched_at: '2026-05-08T10:00:00Z',
      website: {
        https: true,
        schema: { hasLocalBusiness: true, types: ['BarberShop'] },
        sitemap: true,
        robots: true,
        homepage: { title: 'Barone Cuts', description: 'Best fades in town', titleLength: 12, descriptionLength: 19 },
        error: null,
      },
      gbp: {
        rating: 4.8, user_ratings_total: 120, photo_count: 30,
        business_status: 'OPERATIONAL', has_opening_hours: true,
        has_phone: true, has_website: true, error: null,
      },
      pagespeed: { mobile_score: 82, lcp_ms: 2400, cls: 0.05, error: null },
    };
    expect(s.website.https).toBe(true);
    expect(s.gbp?.rating).toBe(4.8);
    expect(s.pagespeed?.mobile_score).toBe(82);
  });

  it('allows null gbp + pagespeed when API key is missing', () => {
    const s: SiteHealthSnapshot = {
      id: 'r1',
      operator_id: 'op1',
      fetched_at: '2026-05-08T10:00:00Z',
      website: { https: true, schema: null, sitemap: null, robots: null, homepage: null, error: null },
      gbp: null,
      pagespeed: null,
    };
    expect(s.gbp).toBeNull();
    expect(s.pagespeed).toBeNull();
  });
});
