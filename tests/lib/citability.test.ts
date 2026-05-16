import { describe, it, expect } from 'vitest';
import {
  stripHtml,
  extractSchemaTypes,
  analyzeSchema,
  analyzeStatistics,
  analyzeCitations,
  analyzeFaqFormat,
  analyzeContentDepth,
  analyzeKeywordStuffing,
  parseRobotsGroups,
  botAllowed,
  analyzeCrawlerAccess,
  scoreCitability,
  analyzePage,
} from '@/lib/citability';

describe('stripHtml', () => {
  it('removes tags, scripts, and styles', () => {
    const html = '<style>.a{}</style><script>x()</script><p>Hello <b>world</b></p>';
    expect(stripHtml(html)).toBe('Hello world');
  });
  it('decodes common entities and collapses whitespace', () => {
    expect(stripHtml('<p>Joe  &amp;   Sons</p>')).toBe('Joe & Sons');
  });
});

describe('extractSchemaTypes', () => {
  it('pulls @type from a JSON-LD block', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'BarberShop',
    })}</script>`;
    expect(extractSchemaTypes(html)).toEqual(['BarberShop']);
  });
  it('handles @graph and arrays', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@graph': [{ '@type': 'WebSite' }, { '@type': ['FAQPage', 'WebPage'] }],
    })}</script>`;
    expect(extractSchemaTypes(html)).toEqual(['WebSite', 'FAQPage', 'WebPage']);
  });
  it('ignores malformed JSON-LD', () => {
    expect(extractSchemaTypes('<script type="application/ld+json">{bad</script>')).toEqual([]);
  });
});

describe('analyzeSchema', () => {
  it('ok when a LocalBusiness subtype is present', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'HairSalon' })}</script>`;
    expect(analyzeSchema(html).status).toBe('ok');
  });
  it('warn when JSON-LD exists but no LocalBusiness type', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'WebSite' })}</script>`;
    expect(analyzeSchema(html).status).toBe('warn');
  });
  it('fail when there is no JSON-LD', () => {
    expect(analyzeSchema('<html></html>').status).toBe('fail');
  });
});

describe('analyzeStatistics', () => {
  it('ok with 5+ statistics', () => {
    const text = 'Open 7 years, 200 reviews, 4.8 stars, $35 cuts, 3 locations, 95 percent.';
    expect(analyzeStatistics(text).status).toBe('ok');
  });
  it('warn with a couple of statistics', () => {
    expect(analyzeStatistics('We have 50 reviews and 4 stars.').status).toBe('warn');
  });
  it('fail with no statistics', () => {
    expect(analyzeStatistics('We are a friendly neighborhood shop.').status).toBe('fail');
  });
});

describe('analyzeCitations', () => {
  it('ok with 3+ quotations/attributions', () => {
    const text =
      '"This place is amazing and worth every penny" — a customer. According to a study, reviews matter. Source: our survey.';
    expect(analyzeCitations(text).status).toBe('ok');
  });
  it('fail with none', () => {
    expect(analyzeCitations('We cut hair well and fast.').status).toBe('fail');
  });
});

describe('analyzeFaqFormat', () => {
  it('ok when FAQPage schema is present', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'FAQPage' })}</script>`;
    expect(analyzeFaqFormat(html, '').status).toBe('ok');
  });
  it('warn when question headings exist without schema', () => {
    const html = '<h2>Do I need an appointment?</h2><h3>How much is a cut?</h3>';
    expect(analyzeFaqFormat(html, '').status).toBe('warn');
  });
  it('fail when there is no FAQ content', () => {
    expect(analyzeFaqFormat('<p>About us</p>', 'About us').status).toBe('fail');
  });
});

describe('analyzeContentDepth', () => {
  it('ok for 300+ words', () => {
    expect(analyzeContentDepth('word '.repeat(320)).status).toBe('ok');
  });
  it('warn for 150-299 words', () => {
    expect(analyzeContentDepth('word '.repeat(200)).status).toBe('warn');
  });
  it('fail for thin pages', () => {
    expect(analyzeContentDepth('word '.repeat(40)).status).toBe('fail');
  });
});

describe('analyzeKeywordStuffing', () => {
  it('info when there is too little text to assess', () => {
    expect(analyzeKeywordStuffing('short page text').status).toBe('info');
  });
  it('fail when one term dominates the body', () => {
    const text = ('barber '.repeat(20) + 'word '.repeat(80)).trim();
    expect(analyzeKeywordStuffing(text).status).toBe('fail');
  });
  it('ok for natural density', () => {
    // 120 distinct 4-letter words → no single term dominates.
    const words = Array.from({ length: 120 }, (_, i) =>
      String.fromCharCode(97 + (i % 26), 97 + (Math.floor(i / 26) % 26), 110, 100),
    ).join(' ');
    expect(analyzeKeywordStuffing(words).status).toBe('ok');
  });
});

describe('parseRobotsGroups / botAllowed', () => {
  it('allows a bot when there are no rules', () => {
    expect(botAllowed(parseRobotsGroups(''), 'GPTBot')).toBe(true);
  });
  it('blocks a bot disallowed by name', () => {
    const txt = 'User-agent: GPTBot\nDisallow: /';
    expect(botAllowed(parseRobotsGroups(txt), 'GPTBot')).toBe(false);
  });
  it('blocks a bot via the wildcard group', () => {
    const txt = 'User-agent: *\nDisallow: /';
    expect(botAllowed(parseRobotsGroups(txt), 'ClaudeBot')).toBe(false);
  });
  it('a bot-specific allow overrides the wildcard block', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nDisallow:';
    const groups = parseRobotsGroups(txt);
    expect(botAllowed(groups, 'GPTBot')).toBe(true);
    expect(botAllowed(groups, 'CCBot')).toBe(false);
  });
  it('shares rules across consecutive user-agent lines', () => {
    const txt = 'User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /';
    const groups = parseRobotsGroups(txt);
    expect(botAllowed(groups, 'GPTBot')).toBe(false);
    expect(botAllowed(groups, 'CCBot')).toBe(false);
  });
});

describe('analyzeCrawlerAccess', () => {
  it('ok when there is no robots.txt', () => {
    expect(analyzeCrawlerAccess(null).status).toBe('ok');
  });
  it('ok when robots.txt blocks nothing', () => {
    expect(analyzeCrawlerAccess('User-agent: *\nDisallow: /admin').status).toBe('ok');
  });
  it('fail when robots.txt blocks all AI crawlers', () => {
    expect(analyzeCrawlerAccess('User-agent: *\nDisallow: /').status).toBe('fail');
  });
  it('warn when only some AI crawlers are blocked', () => {
    expect(analyzeCrawlerAccess('User-agent: GPTBot\nDisallow: /').status).toBe('warn');
  });
});

describe('scoreCitability / analyzePage', () => {
  it('scores a strong page high', () => {
    // ~290 distinct filler tokens → real depth, no keyword stuffing.
    const filler = Array.from({ length: 290 }, (_, i) => `detail${i}`).join(' ');
    const html = `
      <script type="application/ld+json">${JSON.stringify({ '@type': 'BarberShop' })}</script>
      <script type="application/ld+json">${JSON.stringify({ '@type': 'FAQPage' })}</script>
      <p>Open 7 years with 200 reviews and 4.8 stars. Cuts are $35, fades $40, 3 locations.
      "Best fade in town and worth every minute of the wait" — a regular customer.
      According to a recent survey, response rate matters. Source: our internal data.
      ${filler}</p>`;
    const report = analyzePage({ url: 'https://x.com', html, robotsTxt: null });
    expect(report.score).toBeGreaterThan(85);
    expect(report.signals).toHaveLength(7);
    expect(report.error).toBeNull();
  });
  it('scores an empty page low', () => {
    const report = analyzePage({ url: 'https://x.com', html: '<html></html>', robotsTxt: 'User-agent: *\nDisallow: /' });
    expect(report.score).toBeLessThan(25);
  });
  it('keyword stuffing applies a penalty', () => {
    const stuffed = [
      { key: 'stuffing', label: '', status: 'fail' as const, detail: '', fix: '' },
    ];
    expect(scoreCitability(stuffed)).toBe(0);
  });
});
