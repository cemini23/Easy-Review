import { describe, it, expect } from 'vitest';
import { buildThemePrompt, parseThemes } from '@/lib/review-themes';

describe('buildThemePrompt', () => {
  it('numbers reviews and includes the rating', () => {
    const prompt = buildThemePrompt([
      { rating: 5, text: 'Great fade' },
      { rating: 2, text: 'Long wait' },
    ]);
    expect(prompt).toContain('1. [★5] Great fade');
    expect(prompt).toContain('2. [★2] Long wait');
  });
  it('asks for a bare JSON array', () => {
    const prompt = buildThemePrompt([{ rating: 5, text: 'x' }]);
    expect(prompt).toMatch(/JSON array/i);
    expect(prompt).toMatch(/no markdown fences/i);
  });
  it('collapses whitespace in review text', () => {
    const prompt = buildThemePrompt([{ rating: 5, text: 'multi\n  line   text' }]);
    expect(prompt).toContain('multi line text');
  });
});

describe('parseThemes', () => {
  it('parses a clean JSON array', () => {
    const out = parseThemes(
      '[{"theme":"Great fades","count":12,"sentiment":"positive"},{"theme":"Wait times","count":4,"sentiment":"negative"}]',
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ theme: 'Great fades', count: 12, sentiment: 'positive' });
  });
  it('tolerates markdown fences and leading prose', () => {
    const text = 'Here are the themes:\n```json\n[{"theme":"Friendly staff","count":7,"sentiment":"positive"}]\n```';
    expect(parseThemes(text)).toHaveLength(1);
  });
  it('sorts by count descending', () => {
    const out = parseThemes(
      '[{"theme":"A","count":2,"sentiment":"mixed"},{"theme":"B","count":9,"sentiment":"mixed"}]',
    );
    expect(out.map((t) => t.theme)).toEqual(['B', 'A']);
  });
  it('drops entries with no theme label', () => {
    const out = parseThemes('[{"count":5,"sentiment":"positive"},{"theme":"Real","count":1,"sentiment":"mixed"}]');
    expect(out).toHaveLength(1);
    expect(out[0].theme).toBe('Real');
  });
  it('defaults a bad sentiment to "mixed" and a bad count to 0', () => {
    const out = parseThemes('[{"theme":"X","count":"lots","sentiment":"angry"}]');
    expect(out[0]).toEqual({ theme: 'X', count: 0, sentiment: 'mixed' });
  });
  it('returns [] when there is no JSON array', () => {
    expect(parseThemes('Sorry, I cannot help with that.')).toEqual([]);
  });
  it('returns [] on malformed JSON', () => {
    expect(parseThemes('[{theme: broken}]')).toEqual([]);
  });
});
