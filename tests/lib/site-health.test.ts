import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchHttps,
  fetchSchema,
  fetchSitemap,
  fetchRobots,
  fetchHomepageMeta,
  fetchPlaceDetails,
  fetchPageSpeed,
  isValidPublicHttpUrl,
} from '@/lib/site-health';

describe('isValidPublicHttpUrl', () => {
  it('accepts a public https URL', () => {
    expect(isValidPublicHttpUrl('https://baronescuts.com')).toBe(true);
  });
  it('accepts a public http URL (some operators don\'t have TLS yet)', () => {
    expect(isValidPublicHttpUrl('http://example.com')).toBe(true);
  });
  it('accepts a URL with a path + query', () => {
    expect(isValidPublicHttpUrl('https://example.com/foo?bar=1')).toBe(true);
  });
  it('rejects empty string', () => {
    expect(isValidPublicHttpUrl('')).toBe(false);
  });
  it('rejects null/undefined', () => {
    expect(isValidPublicHttpUrl(null)).toBe(false);
    expect(isValidPublicHttpUrl(undefined)).toBe(false);
  });
  it('rejects malformed strings', () => {
    expect(isValidPublicHttpUrl('not a url')).toBe(false);
    expect(isValidPublicHttpUrl('example.com')).toBe(false);
  });
  it('rejects non-http(s) protocols', () => {
    expect(isValidPublicHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isValidPublicHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidPublicHttpUrl('javascript:alert(1)')).toBe(false);
  });
  it('rejects localhost', () => {
    expect(isValidPublicHttpUrl('http://localhost')).toBe(false);
    expect(isValidPublicHttpUrl('https://localhost:3000/admin')).toBe(false);
  });
  it('rejects loopback (127/8)', () => {
    expect(isValidPublicHttpUrl('http://127.0.0.1')).toBe(false);
    expect(isValidPublicHttpUrl('http://127.5.5.5')).toBe(false);
  });
  it('rejects 0.0.0.0', () => {
    expect(isValidPublicHttpUrl('http://0.0.0.0')).toBe(false);
  });
  it('rejects RFC1918 private ranges', () => {
    expect(isValidPublicHttpUrl('http://10.0.0.1')).toBe(false);
    expect(isValidPublicHttpUrl('http://192.168.1.1')).toBe(false);
    expect(isValidPublicHttpUrl('http://172.16.0.1')).toBe(false);
    expect(isValidPublicHttpUrl('http://172.31.255.255')).toBe(false);
  });
  it('accepts IPs just outside 172.16/12 (172.15.x.x and 172.32.x.x)', () => {
    expect(isValidPublicHttpUrl('http://172.15.0.1')).toBe(true);
    expect(isValidPublicHttpUrl('http://172.32.0.1')).toBe(true);
  });
  it('rejects link-local 169.254/16', () => {
    expect(isValidPublicHttpUrl('http://169.254.169.254')).toBe(false);
  });
  it('rejects mDNS / internal TLDs', () => {
    expect(isValidPublicHttpUrl('http://printer.local')).toBe(false);
    expect(isValidPublicHttpUrl('http://api.internal')).toBe(false);
  });
});

describe('fetchHttps', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true when URL is https and 200 OK', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('ok', { status: 200 }));
    expect(await fetchHttps('https://example.com')).toBe(true);
  });

  it('returns false when URL is http (no TLS)', async () => {
    expect(await fetchHttps('http://example.com')).toBe(false);
  });

  it('returns false when fetch throws (cert error, DNS failure, etc.)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('cert invalid'));
    expect(await fetchHttps('https://example.com')).toBe(false);
  });

  it('returns false when response is non-2xx', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('boom', { status: 500 }));
    expect(await fetchHttps('https://example.com')).toBe(false);
  });
});

describe('fetchSchema', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('detects LocalBusiness JSON-LD on the homepage', async () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'X',
    })}</script></head><body></body></html>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result).toEqual({ hasLocalBusiness: true, types: ['LocalBusiness'] });
  });

  it('detects LocalBusiness subtypes (BarberShop, BeautySalon, Restaurant)', async () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'BarberShop', name: 'X',
    })}</script></head><body></body></html>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result.hasLocalBusiness).toBe(true);
    expect(result.types).toContain('BarberShop');
  });

  it('returns hasLocalBusiness=false when only an unrelated type is present', async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'X',
    })}</script>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result.hasLocalBusiness).toBe(false);
    expect(result.types).toEqual(['WebSite']);
  });

  it('handles multiple JSON-LD blocks', async () => {
    const html = `
      <script type="application/ld+json">${JSON.stringify({ '@type': 'WebSite' })}</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'BarberShop' })}</script>
    `;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result.types).toContain('WebSite');
    expect(result.types).toContain('BarberShop');
    expect(result.hasLocalBusiness).toBe(true);
  });

  it('returns null on fetch failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const result = await fetchSchema('https://example.com');
    expect(result).toBeNull();
  });

  it('returns hasLocalBusiness=false types=[] when no JSON-LD blocks exist', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('<html></html>', { status: 200 }));
    const result = await fetchSchema('https://example.com');
    expect(result).toEqual({ hasLocalBusiness: false, types: [] });
  });
});

describe('fetchSitemap', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true when /sitemap.xml exists with XML content-type', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('<urlset/>', { status: 200, headers: { 'content-type': 'application/xml' } }),
    );
    expect(await fetchSitemap('https://example.com')).toBe(true);
  });

  it('returns true with text/xml content-type', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('<urlset/>', { status: 200, headers: { 'content-type': 'text/xml' } }),
    );
    expect(await fetchSitemap('https://example.com')).toBe(true);
  });

  it('returns false on 404', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('not found', { status: 404 }));
    expect(await fetchSitemap('https://example.com')).toBe(false);
  });

  it('returns false on non-XML content-type', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('<html/>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    expect(await fetchSitemap('https://example.com')).toBe(false);
  });

  it('handles paths under /sitemap.xml', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response('<urlset/>', { status: 200, headers: { 'content-type': 'application/xml' } }));
    await fetchSitemap('https://example.com/some/path');
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/sitemap.xml', expect.any(Object));
  });
});

describe('fetchRobots', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns true when /robots.txt is 200', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('User-agent: *', { status: 200 }));
    expect(await fetchRobots('https://example.com')).toBe(true);
  });

  it('returns false on 404', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('404', { status: 404 }));
    expect(await fetchRobots('https://example.com')).toBe(false);
  });

  it('hits the origin /robots.txt regardless of input path', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response('User-agent: *', { status: 200 }));
    await fetchRobots('https://example.com/some/path');
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/robots.txt', expect.any(Object));
  });
});

describe('fetchHomepageMeta', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('extracts title and meta description', async () => {
    const html = `<html><head>
      <title>Barone Cuts — best fades in Northeast Philly</title>
      <meta name="description" content="Walk-in barbershop. Fades, beard trims, kids cuts. 7 days.">
    </head></html>`;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result).toEqual({
      title: 'Barone Cuts — best fades in Northeast Philly',
      description: 'Walk-in barbershop. Fades, beard trims, kids cuts. 7 days.',
      titleLength: 44,
      descriptionLength: 58,
    });
  });

  it('handles missing description gracefully', async () => {
    const html = '<html><head><title>X</title></head></html>';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result).toEqual({
      title: 'X',
      description: '',
      titleLength: 1,
      descriptionLength: 0,
    });
  });

  it('handles missing title gracefully', async () => {
    const html = '<html><head><meta name="description" content="X"></head></html>';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result?.title).toBe('');
    expect(result?.description).toBe('X');
  });

  it('returns null on fetch failure', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    expect(await fetchHomepageMeta('https://example.com')).toBeNull();
  });

  it('decodes HTML entities in title (e.g. &amp;)', async () => {
    const html = '<html><head><title>Joe &amp; Sons</title></head></html>';
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(html, { status: 200 }));
    const result = await fetchHomepageMeta('https://example.com');
    expect(result?.title).toBe('Joe & Sons');
  });
});

describe('fetchPlaceDetails', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const happyResponse = {
    status: 'OK',
    result: {
      name: 'Barone Cuts',
      business_status: 'OPERATIONAL',
      rating: 4.8,
      user_ratings_total: 142,
      photos: [{ photo_reference: 'a' }, { photo_reference: 'b' }, { photo_reference: 'c' }],
      opening_hours: { weekday_text: ['Mon: 9-5'] },
      formatted_phone_number: '(215) 555-1234',
      website: 'https://baronecuts.com',
    },
  };

  it('returns the typed GBP fragment on a successful response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(happyResponse), { status: 200 }),
    );
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result).toEqual({
      rating: 4.8,
      user_ratings_total: 142,
      photo_count: 3,
      business_status: 'OPERATIONAL',
      has_opening_hours: true,
      has_phone: true,
      has_website: true,
      error: null,
    });
  });

  it('returns has_*=false when fields are missing', async () => {
    const partial = {
      status: 'OK',
      result: { name: 'X', business_status: 'OPERATIONAL', rating: 4, user_ratings_total: 10 },
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(partial), { status: 200 }),
    );
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result?.has_opening_hours).toBe(false);
    expect(result?.has_phone).toBe(false);
    expect(result?.has_website).toBe(false);
    expect(result?.photo_count).toBe(0);
  });

  it('returns error fragment when status != OK', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ status: 'NOT_FOUND', error_message: 'No record' }), { status: 200 }),
    );
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result?.error).toMatch(/NOT_FOUND/);
    expect(result?.rating).toBeNull();
  });

  it('returns error fragment when fetch throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    const result = await fetchPlaceDetails('ChIJabc', 'fakeKey');
    expect(result?.error).toContain('network');
  });

  it('passes the API key + place_id in the URL', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(happyResponse), { status: 200 }));
    await fetchPlaceDetails('ChIJxyz', 'thekey');
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('place_id=ChIJxyz');
    expect(calledUrl).toContain('key=thekey');
  });
});

describe('fetchPageSpeed', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const happy = {
    lighthouseResult: {
      categories: { performance: { score: 0.82 } },
      audits: {
        'largest-contentful-paint': { numericValue: 2400 },
        'cumulative-layout-shift': { numericValue: 0.05 },
      },
    },
  };

  it('extracts mobile_score, lcp_ms, cls', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(happy), { status: 200 }),
    );
    const result = await fetchPageSpeed('https://example.com', 'fakeKey');
    expect(result).toEqual({ mobile_score: 82, lcp_ms: 2400, cls: 0.05, error: null });
  });

  it('rounds the score to a whole number', async () => {
    const r = JSON.parse(JSON.stringify(happy));
    r.lighthouseResult.categories.performance.score = 0.876;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(r), { status: 200 }));
    const result = await fetchPageSpeed('https://example.com', 'k');
    expect(result?.mobile_score).toBe(88);
  });

  it('returns error when fetch throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
    const result = await fetchPageSpeed('https://example.com', 'k');
    expect(result?.error).toContain('timeout');
    expect(result?.mobile_score).toBeNull();
  });

  it('returns error when API returns non-2xx', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 }),
    );
    const result = await fetchPageSpeed('https://example.com', 'k');
    expect(result?.error).toMatch(/HTTP 429/);
  });

  it('passes url + strategy=mobile + key in the request', async () => {
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(happy), { status: 200 }));
    await fetchPageSpeed('https://example.com', 'thekey');
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('url=https%3A%2F%2Fexample.com');
    expect(calledUrl).toContain('strategy=mobile');
    expect(calledUrl).toContain('key=thekey');
  });
});
