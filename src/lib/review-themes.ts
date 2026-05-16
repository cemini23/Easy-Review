import type { ReviewTheme } from '@/lib/types';

/**
 * Review theme extraction — pure prompt-building + response-parsing.
 *
 * The actual LLM call lives in the `extractThemes` server action; keeping the
 * prompt and parser here makes both testable without a network call.
 *
 * Recurring review themes feed two other EasyReview features: the Citability
 * Checker (Aggarwal 2024 — cite real review themes in on-page content) and the
 * wiki brief-ingestion loop.
 */

const VALID_SENTIMENTS = new Set(['positive', 'negative', 'mixed']);

/** Build the theme-extraction prompt from a batch of reviews. */
export function buildThemePrompt(reviews: { rating: number; text: string }[]): string {
  const list = reviews
    .map((r, i) => `${i + 1}. [★${r.rating}] ${r.text.replace(/\s+/g, ' ').trim()}`)
    .join('\n');

  return `You are analyzing customer reviews for a local business to surface recurring themes.

Reviews:
${list}

Identify up to 8 recurring themes — things customers mention repeatedly (service quality,
wait times, specific staff, cleanliness, value, atmosphere, etc.). Skip one-off mentions.

Return ONLY a JSON array — no prose, no markdown fences. Each element:
{"theme": "<short label, 2-4 words>", "count": <integer of reviews mentioning it>, "sentiment": "positive" | "negative" | "mixed"}

Order by count descending.`;
}

/**
 * Parse the LLM response into themes. Tolerates markdown fences and leading
 * prose by extracting the first JSON array. Invalid entries are dropped;
 * returns `[]` if nothing usable is found.
 */
export function parseThemes(llmText: string): ReviewTheme[] {
  const start = llmText.indexOf('[');
  const end = llmText.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(llmText.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const themes: ReviewTheme[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const row = item as Record<string, unknown>;
    const theme = typeof row.theme === 'string' ? row.theme.trim() : '';
    if (!theme) continue;
    const count =
      typeof row.count === 'number' && Number.isFinite(row.count)
        ? Math.max(0, Math.round(row.count))
        : 0;
    const sentiment =
      typeof row.sentiment === 'string' && VALID_SENTIMENTS.has(row.sentiment)
        ? (row.sentiment as ReviewTheme['sentiment'])
        : 'mixed';
    themes.push({ theme, count, sentiment });
  }
  return themes.sort((a, b) => b.count - a.count);
}
