import type { CitabilityReport, CitabilitySignal, CitabilityStatus } from '@/lib/types';

/**
 * GEO/AEO citability analysis — pure functions, no I/O.
 *
 * Scores a web page on how likely AI engines (ChatGPT, Claude, Perplexity,
 * Google AI Overviews) are to retrieve and cite it correctly. The heuristics
 * follow Aggarwal et al. 2024 ("GEO: Generative Engine Optimization", KDD'24)
 * as digested in the wiki: `concepts/generative-engine-optimization.md`.
 *
 * Aggarwal's measured lifts (Position-Adjusted Word Count vs baseline):
 *   Quotation Addition +41% · Statistics Addition +33% · Fluency +28% ·
 *   Cite Sources +27% · Keyword Stuffing **-8%** (actively hurts).
 *
 * The fetching (page HTML + robots.txt) happens in the server action; this
 * module only analyzes already-fetched strings, so every rule is testable.
 */

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'your', 'have', 'will', 'about', 'they',
  'their', 'them', 'were', 'what', 'when', 'which', 'would', 'there', 'here',
  'been', 'more', 'some', 'than', 'then', 'into', 'also', 'just', 'only',
  'over', 'such', 'these', 'those', 'each', 'most', 'very', 'much', 'many',
]);

/** Strip tags + scripts/styles from HTML, returning collapsed visible text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract every schema.org `@type` string from JSON-LD blocks in the HTML. */
export function extractSchemaTypes(html: string): string[] {
  const types: string[] = [];
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of blocks) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = Array.isArray(data)
        ? data
        : data['@graph']
        ? data['@graph']
        : [data];
      for (const node of nodes) {
        const t = node?.['@type'];
        if (Array.isArray(t)) types.push(...t.filter((x) => typeof x === 'string'));
        else if (typeof t === 'string') types.push(t);
      }
    } catch {
      // malformed JSON-LD — ignore
    }
  }
  return types;
}

// --- individual analyzers (each returns one signal) ----------------------

type SignalCore = Pick<CitabilitySignal, 'status' | 'detail' | 'fix'>;

const LOCAL_BUSINESS_HINT = /(LocalBusiness|BarberShop|HairSalon|Dentist|Restaurant|Store|HealthClub|AutoRepair|BeautySalon|MedicalClinic)/;

/** Schema markup — engines parse JSON-LD reliably; missing it forces guesses. */
export function analyzeSchema(html: string): SignalCore {
  const types = extractSchemaTypes(html);
  const hasLocalBusiness = types.some((t) => LOCAL_BUSINESS_HINT.test(t));
  if (hasLocalBusiness) {
    return {
      status: 'ok',
      detail: `LocalBusiness JSON-LD found (${types.join(', ')}).`,
      fix: 'Keep the schema in sync with the visible page and your GBP listing.',
    };
  }
  if (types.length > 0) {
    return {
      status: 'warn',
      detail: `JSON-LD present but no LocalBusiness type (${types.join(', ')}).`,
      fix: 'Add a LocalBusiness-subtype block — use the Schema tab to generate one.',
    };
  }
  return {
    status: 'fail',
    detail: 'No JSON-LD structured data found on the page.',
    fix: 'Add LocalBusiness + FAQPage JSON-LD — the Schema tab generates it for you.',
  };
}

/** Count statistics/numbers in body text — Aggarwal: +33% citation lift. */
export function analyzeStatistics(text: string): SignalCore {
  const stats = text.match(
    /\b\d[\d,]*(\.\d+)?\s*(%|percent|years?|reviews?|ratings?|customers?|clients?|stars?|locations?)\b/gi,
  );
  const prices = text.match(/\$\s?\d/g);
  const count = (stats?.length ?? 0) + (prices?.length ?? 0);
  if (count >= 5) {
    return {
      status: 'ok',
      detail: `${count} concrete statistics found (review counts, years, prices, etc.).`,
      fix: 'Keep numbers accurate and current — stale stats erode trust.',
    };
  }
  if (count >= 2) {
    return {
      status: 'warn',
      detail: `Only ${count} statistics found.`,
      fix: 'Add more concrete numbers: years in business, review count, prices, service durations.',
    };
  }
  return {
    status: 'fail',
    detail: 'Almost no statistics in the page text.',
    fix: 'Aggarwal 2024: Statistics Addition gives +33% citation lift. Add real numbers.',
  };
}

/** Detect quotations + source attribution — Aggarwal: +41% / +27%. */
export function analyzeCitations(text: string): SignalCore {
  const quotes = text.match(/[“”"][^“”"\n]{20,}[“”"]/g);
  const attributions = text.match(
    /\b(according to|source:|sources:|cited|a study|research (shows|by|found)|survey (of|by|found))\b/gi,
  );
  const count = (quotes?.length ?? 0) + (attributions?.length ?? 0);
  if (count >= 3) {
    return {
      status: 'ok',
      detail: `${count} quotations / source attributions found.`,
      fix: 'Keep quoting real customers and crediting sources.',
    };
  }
  if (count >= 1) {
    return {
      status: 'warn',
      detail: `Only ${count} quotation / attribution found.`,
      fix: 'Add a "what customers say" block quoting real reviews (never fabricated).',
    };
  }
  return {
    status: 'fail',
    detail: 'No quotations or source attributions found.',
    fix: 'Aggarwal 2024: Quotations +41%, Cite Sources +27%. Quote real reviews, credit sources.',
  };
}

/** FAQ format — FAQPage schema or question headings; preferentially cited. */
export function analyzeFaqFormat(html: string, text: string): SignalCore {
  const schemaTypes = extractSchemaTypes(html);
  const hasFaqSchema = schemaTypes.some((t) => t === 'FAQPage' || t === 'QAPage');
  const questionHeadings =
    html.match(/<h[2-4][^>]*>[^<]*\?\s*<\/h[2-4]>/gi)?.length ?? 0;
  const questionLines =
    text.match(/[^.!?]{8,120}\?/g)?.filter((q) => /\b(how|what|when|where|why|do|does|can|is|are)\b/i.test(q))
      .length ?? 0;
  if (hasFaqSchema) {
    return {
      status: 'ok',
      detail: 'FAQPage schema found — engines extract Q&A pairs cleanly.',
      fix: 'Keep FAQ answers short, concrete, and number-rich.',
    };
  }
  if (questionHeadings >= 2 || questionLines >= 3) {
    return {
      status: 'warn',
      detail: `Question-style content present (${questionHeadings} headings) but no FAQPage schema.`,
      fix: 'Wrap the FAQ content in FAQPage JSON-LD — use the Schema tab.',
    };
  }
  return {
    status: 'fail',
    detail: 'No FAQ-format content detected.',
    fix: 'Add an FAQ section answering real customer questions, then mark it up as FAQPage.',
  };
}

/** Content depth — a fluency proxy. Thin pages get cited less. */
export function analyzeContentDepth(text: string): SignalCore {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 300) {
    return {
      status: 'ok',
      detail: `${words} words of body text — enough substance to retrieve.`,
      fix: 'Aggarwal: edit for fluency — concise, varied sentences beat padded copy.',
    };
  }
  if (words >= 150) {
    return {
      status: 'warn',
      detail: `${words} words of body text — fairly thin.`,
      fix: 'Expand with substantive, well-edited content (services, FAQs, neighborhood context).',
    };
  }
  return {
    status: 'fail',
    detail: `Only ${words} words of body text.`,
    fix: 'The page is too thin for engines to retrieve confidently — add real content.',
  };
}

/** Keyword stuffing — Aggarwal: ACTIVELY hurts (-8%). Lower density is better. */
export function analyzeKeywordStuffing(text: string): SignalCore {
  const words = (text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []).filter(
    (w) => !STOPWORDS.has(w),
  );
  if (words.length < 50) {
    return {
      status: 'info',
      detail: 'Not enough body text to assess keyword density.',
      fix: 'Add more content first, then re-check.',
    };
  }
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  let topWord = '';
  let topCount = 0;
  for (const [w, c] of freq) {
    if (c > topCount) {
      topCount = c;
      topWord = w;
    }
  }
  const density = topCount / words.length;
  const pct = (density * 100).toFixed(1);
  if (density >= 0.06) {
    return {
      status: 'fail',
      detail: `"${topWord}" is ${pct}% of body words — reads as keyword stuffing.`,
      fix: 'Rewrite naturally. Aggarwal 2024: keyword stuffing cuts citation visibility ~8%.',
    };
  }
  if (density >= 0.04) {
    return {
      status: 'warn',
      detail: `"${topWord}" is ${pct}% of body words — slightly repetitive.`,
      fix: 'Vary the wording so no single term dominates.',
    };
  }
  return {
    status: 'ok',
    detail: `Top word "${topWord}" is ${pct}% of body words — natural density.`,
    fix: 'Keep writing for humans, not for keyword counts.',
  };
}

// --- robots.txt / AI-crawler access --------------------------------------

/** AI crawlers worth checking, with the engine each one feeds. */
export const AI_CRAWLERS: { ua: string; engine: string }[] = [
  { ua: 'GPTBot', engine: 'ChatGPT' },
  { ua: 'ClaudeBot', engine: 'Claude' },
  { ua: 'PerplexityBot', engine: 'Perplexity' },
  { ua: 'Google-Extended', engine: 'Gemini' },
  { ua: 'CCBot', engine: 'Common Crawl' },
];

interface RobotsGroup {
  agents: string[];
  disallows: string[];
  allows: string[];
}

/** Parse robots.txt into user-agent groups (consecutive UA lines share rules). */
export function parseRobotsGroups(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallows: [], allows: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current) {
      lastWasAgent = false;
      if (field === 'disallow') current.disallows.push(value);
      else current.allows.push(value);
    }
  }
  return groups;
}

/** True if `botUa` is allowed to crawl the site root per these robots groups. */
export function botAllowed(groups: RobotsGroup[], botUa: string): boolean {
  const ua = botUa.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(ua));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const group = specific ?? wildcard;
  if (!group) return true; // no applicable rules → allowed
  if (group.allows.includes('/')) return true; // explicit allow-all override
  // `Disallow: /` blocks everything; `Disallow:` (empty) blocks nothing.
  return !group.disallows.includes('/');
}

/** Analyze robots.txt for AI-crawler access. `null` = no robots.txt fetched. */
export function analyzeCrawlerAccess(robotsTxt: string | null): SignalCore {
  if (robotsTxt == null) {
    return {
      status: 'ok',
      detail: 'No robots.txt found — AI crawlers are not blocked.',
      fix: 'Optional: add a robots.txt, but do not Disallow the AI crawlers.',
    };
  }
  const groups = parseRobotsGroups(robotsTxt);
  const blocked = AI_CRAWLERS.filter((c) => !botAllowed(groups, c.ua));
  if (blocked.length === 0) {
    return {
      status: 'ok',
      detail: 'robots.txt allows all major AI crawlers.',
      fix: 'Keep GPTBot, ClaudeBot, PerplexityBot, and Google-Extended unblocked.',
    };
  }
  const names = blocked.map((b) => `${b.ua} (${b.engine})`).join(', ');
  if (blocked.length >= AI_CRAWLERS.length - 1) {
    return {
      status: 'fail',
      detail: `robots.txt blocks AI crawlers: ${names}.`,
      fix: 'Remove the Disallow rules — blocked crawlers cannot cite a page they cannot read.',
    };
  }
  return {
    status: 'warn',
    detail: `robots.txt blocks some AI crawlers: ${names}.`,
    fix: 'Unblock these user-agents so every engine can retrieve the page.',
  };
}

// --- scoring + orchestration ---------------------------------------------

/** Per-signal weight for the composite score (positive signals sum to 100). */
const WEIGHTS: Record<string, number> = {
  schema: 18,
  statistics: 18,
  citations: 18,
  faq: 16,
  depth: 12,
  crawler: 18,
};

const STATUS_VALUE: Record<CitabilityStatus, number> = {
  ok: 1,
  warn: 0.5,
  info: 0.5,
  fail: 0,
};

/**
 * Composite 0-100 score. The six positive signals contribute their weight ×
 * status-value; keyword stuffing is a penalty (warn -7, fail -15).
 */
export function scoreCitability(signals: CitabilitySignal[]): number {
  let score = 0;
  for (const s of signals) {
    const weight = WEIGHTS[s.key];
    if (weight) score += weight * STATUS_VALUE[s.status];
  }
  const stuffing = signals.find((s) => s.key === 'stuffing');
  if (stuffing?.status === 'fail') score -= 15;
  else if (stuffing?.status === 'warn') score -= 7;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const LABELS: Record<string, string> = {
  schema: 'Structured data (JSON-LD)',
  statistics: 'Statistics & concrete numbers',
  citations: 'Quotations & source attribution',
  faq: 'FAQ-format content',
  depth: 'Content depth',
  crawler: 'AI-crawler access',
  stuffing: 'Keyword density',
};

/**
 * Analyze an already-fetched page. `robotsTxt` is the site's robots.txt body,
 * or `null` when there is none. Returns the full report (minus fetch errors,
 * which the caller handles).
 */
export function analyzePage(input: {
  url: string;
  html: string;
  robotsTxt: string | null;
}): CitabilityReport {
  const text = stripHtml(input.html);
  const cores: Record<string, SignalCore> = {
    schema: analyzeSchema(input.html),
    statistics: analyzeStatistics(text),
    citations: analyzeCitations(text),
    faq: analyzeFaqFormat(input.html, text),
    depth: analyzeContentDepth(text),
    crawler: analyzeCrawlerAccess(input.robotsTxt),
    stuffing: analyzeKeywordStuffing(text),
  };
  const signals: CitabilitySignal[] = Object.entries(cores).map(([key, core]) => ({
    key,
    label: LABELS[key] ?? key,
    ...core,
  }));
  return {
    url: input.url,
    score: scoreCitability(signals),
    signals,
    fetchedAt: new Date().toISOString(),
    error: null,
  };
}
