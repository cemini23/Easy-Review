import { describe, it, expect } from 'vitest';
import { getTemplate, listCategories } from '@/lib/templates';

describe('templates', () => {
  it('returns the 6 known categories', () => {
    const ids = listCategories().map((c) => c.id);
    expect(ids).toContain('5star_specific');
    expect(ids).toContain('1star_fake');
    expect(ids.length).toBe(6);
  });

  it('getTemplate returns the matching category', () => {
    const t = getTemplate('5star_generic');
    expect(t.id).toBe('5star_generic');
    expect(t.templates.length).toBeGreaterThan(0);
  });

  it('throws on unknown category', () => {
    // @ts-expect-error invalid input
    expect(() => getTemplate('not_a_category')).toThrow();
  });
});
