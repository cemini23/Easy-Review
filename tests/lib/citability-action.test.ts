import { describe, it, expect, vi, beforeEach } from 'vitest';

// Keep isValidPublicHttpUrl real (the action's URL-validation path), mock safeFetch.
vi.mock('@/lib/site-health', async () => {
  const actual = await vi.importActual<typeof import('@/lib/site-health')>('@/lib/site-health');
  return { ...actual, safeFetch: vi.fn() };
});

import { analyzeUrl } from '@/app/actions/citability';
import { safeFetch } from '@/lib/site-health';

const fetchMock = safeFetch as unknown as ReturnType<typeof vi.fn>;

const PAGE_HTML = `
  <script type="application/ld+json">{"@type":"BarberShop"}</script>
  <p>Open 7 years, 200 reviews, 4.8 stars, $35 cuts, 3 locations.
  "A genuinely great fade and worth the wait" — a regular. According to a survey, response matters.
  ${'A varied, well-edited sentence about the shop. '.repeat(30)}</p>`;

describe('analyzeUrl', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('rejects a non-public URL without fetching', async () => {
    const report = await analyzeUrl('http://localhost:3000');
    expect(report.error).toMatch(/public http/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed URL', async () => {
    const report = await analyzeUrl('not a url');
    expect(report.error).toMatch(/public http/i);
  });

  it('analyzes a fetched page and returns a scored report', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(PAGE_HTML, { status: 200 }))
      .mockResolvedValueOnce(
        new Response('User-agent: *\nDisallow:', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      );
    const report = await analyzeUrl('https://example.com');
    expect(report.error).toBeNull();
    expect(report.signals).toHaveLength(7);
    expect(report.score).toBeGreaterThan(0);
  });

  it('reports an HTTP error when the page is not OK', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 503 }));
    const report = await analyzeUrl('https://example.com');
    expect(report.error).toMatch(/HTTP 503/);
    expect(report.signals).toEqual([]);
  });

  it('reports a fetch failure cleanly instead of throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const report = await analyzeUrl('https://example.com');
    expect(report.error).toMatch(/could not fetch/i);
  });

  it('still analyzes the page when robots.txt cannot be fetched', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(PAGE_HTML, { status: 200 }))
      .mockRejectedValueOnce(new Error('robots unreachable'));
    const report = await analyzeUrl('https://example.com');
    expect(report.error).toBeNull();
    expect(report.signals).toHaveLength(7);
  });
});
