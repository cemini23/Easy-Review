import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchHttps,
  fetchSchema,
  fetchSitemap,
  fetchRobots,
  fetchHomepageMeta,
} from '@/lib/site-health';

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
