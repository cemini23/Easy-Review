import { describe, it, expect } from 'vitest';
import { parseWikiTemplates } from '../../scripts/sync-wiki.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/wiki-template-fixture.md'),
  'utf8'
);

describe('parseWikiTemplates', () => {
  it('returns a TemplatesJson with all 6 category IDs', () => {
    const result = parseWikiTemplates(FIXTURE);
    const ids = result.categories.map((c) => c.id);
    expect(ids).toEqual([
      '5star_specific',
      '5star_generic',
      '4star',
      '3star_mixed',
      '1_2star_complaint',
      '1star_fake',
    ]);
  });

  it('extracts rules and example_response for 5star_specific', () => {
    const result = parseWikiTemplates(FIXTURE);
    const fivestar = result.categories.find((c) => c.id === '5star_specific')!;
    expect(fivestar.templates[0].example_response).toContain('Thanks for the love');
    expect(fivestar.templates[0].rules.length).toBeGreaterThanOrEqual(3);
    expect(fivestar.templates[0].rules.join(' ')).toMatch(/first name/i);
  });

  it('includes a version + source field', () => {
    const result = parseWikiTemplates(FIXTURE);
    expect(result.version).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(result.source).toContain('review-response-templates.md');
  });
});
