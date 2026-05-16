import { describe, it, expect, vi, beforeEach } from 'vitest';

const draftsCollection = { getList: vi.fn() };
vi.mock('@/lib/pocketbase', () => ({
  authAsAdmin: vi.fn(async () => ({
    collection: vi.fn(() => draftsCollection),
  })),
}));
vi.mock('@/lib/gemini', () => ({ generateText: vi.fn() }));

import { extractThemes } from '@/app/actions/themes';
import { generateText } from '@/lib/gemini';

const genText = generateText as unknown as ReturnType<typeof vi.fn>;

function items(reviews: { review_rating: number; review_text: string }[]) {
  return { items: reviews };
}

describe('extractThemes', () => {
  beforeEach(() => {
    draftsCollection.getList.mockReset();
    genText.mockReset();
  });

  it('errors out when there are fewer than 3 reviews with text', async () => {
    draftsCollection.getList.mockResolvedValue(
      items([
        { review_rating: 5, review_text: 'Great' },
        { review_rating: 5, review_text: '' },
      ]),
    );
    const result = await extractThemes('op1');
    expect(result.error).toMatch(/at least 3/i);
    expect(result.themes).toEqual([]);
    expect(genText).not.toHaveBeenCalled();
  });

  it('calls the LLM and returns parsed themes for a real corpus', async () => {
    draftsCollection.getList.mockResolvedValue(
      items([
        { review_rating: 5, review_text: 'Great fade' },
        { review_rating: 4, review_text: 'Good but a wait' },
        { review_rating: 5, review_text: 'Friendly staff' },
      ]),
    );
    genText.mockResolvedValue('[{"theme":"Friendly staff","count":2,"sentiment":"positive"}]');
    const result = await extractThemes('op1');
    expect(genText).toHaveBeenCalledOnce();
    expect(result.error).toBeNull();
    expect(result.reviewCount).toBe(3);
    expect(result.themes).toEqual([
      { theme: 'Friendly staff', count: 2, sentiment: 'positive' },
    ]);
  });

  it('captures an LLM failure as an error instead of throwing', async () => {
    draftsCollection.getList.mockResolvedValue(
      items([
        { review_rating: 5, review_text: 'a' },
        { review_rating: 5, review_text: 'b' },
        { review_rating: 5, review_text: 'c' },
      ]),
    );
    genText.mockRejectedValue(new Error('All LLM providers failed'));
    const result = await extractThemes('op1');
    expect(result.themes).toEqual([]);
    expect(result.error).toMatch(/LLM providers/i);
  });

  it('excludes empty-text reviews from the count sent to the model', async () => {
    draftsCollection.getList.mockResolvedValue(
      items([
        { review_rating: 5, review_text: 'real one' },
        { review_rating: 5, review_text: '   ' },
        { review_rating: 5, review_text: 'real two' },
        { review_rating: 5, review_text: 'real three' },
      ]),
    );
    genText.mockResolvedValue('[]');
    const result = await extractThemes('op1');
    expect(result.reviewCount).toBe(3);
  });
});
