'use server';

import { authAsAdmin } from '@/lib/pocketbase';
import { generateText } from '@/lib/gemini';
import { buildThemePrompt, parseThemes } from '@/lib/review-themes';
import type { ReviewTheme } from '@/lib/types';

/** Cap the batch so the prompt stays within a sane token budget. */
const MAX_REVIEWS = 100;

export interface ThemeResult {
  themes: ReviewTheme[];
  /** Number of reviews actually sent to the model. */
  reviewCount: number;
  error: string | null;
}

/**
 * Extract recurring themes from an operator's review corpus via one batched
 * LLM call. Never throws — provider/parsing failures come back as `error`.
 */
export async function extractThemes(operatorId: string): Promise<ThemeResult> {
  const pb = await authAsAdmin();
  const list = await pb.collection('drafts').getList(1, MAX_REVIEWS, {
    filter: `operator_id = "${operatorId}"`,
    sort: '-review_date',
  });

  const reviews = list.items
    .map((r) => ({ rating: Number(r.review_rating), text: String(r.review_text ?? '') }))
    .filter((r) => r.text.trim().length > 0);

  if (reviews.length < 3) {
    return {
      themes: [],
      reviewCount: reviews.length,
      error: 'Need at least 3 reviews with text before themes can be extracted.',
    };
  }

  try {
    const raw = await generateText(buildThemePrompt(reviews));
    return { themes: parseThemes(raw), reviewCount: reviews.length, error: null };
  } catch (e) {
    return {
      themes: [],
      reviewCount: reviews.length,
      error: e instanceof Error ? e.message : 'Theme extraction failed.',
    };
  }
}
