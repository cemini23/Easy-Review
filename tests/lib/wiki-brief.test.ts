import { describe, it, expect } from 'vitest';
import { serializeBrief, briefFilename } from '@/lib/wiki-brief';

describe('serializeBrief', () => {
  it('produces frontmatter + body matching the spec schema', () => {
    const md = serializeBrief({
      reviewSnapshot: {
        author: 'Mike R.',
        rating: 5,
        text: 'Joey was great!',
        date: '2026-05-06',
      },
      postedText: 'Thanks Mike!',
      category: '5star_specific',
      operatorEmail: 'op@example.com',
      operatorVertical: 'barbershop',
      gbpReviewId: 'rev_abc123',
      postedAt: '2026-05-07T14:30:00Z',
    });

    expect(md).toMatch(/^---\n/);
    expect(md).toMatch(/title: GBP reply — Mike R\. \(5★\) — 2026-05-07/);
    expect(md).toMatch(/type: brief/);
    expect(md).toMatch(/tags: \[reviews, barbershop, gbp-posted\]/);
    expect(md).toMatch(/operator: op@example\.com/);
    expect(md).toMatch(/gbp_review_id: rev_abc123/);
    expect(md).toMatch(/category: 5star_specific/);
    expect(md).toContain('## Target');
    expect(md).toContain('GBP — posted via API');
    expect(md).toContain('## Body');
    expect(md).toContain('> Joey was great!');
    expect(md).toContain('> Thanks Mike!');
    expect(md).toContain('## Sources');
    expect(md).toContain('[Source: GBP API review rev_abc123');
  });

  it('quotes multi-line review text correctly', () => {
    const md = serializeBrief({
      reviewSnapshot: {
        author: 'A',
        rating: 4,
        text: 'Line one.\nLine two.',
        date: '2026-05-06',
      },
      postedText: 'Thanks!',
      category: '4star',
      operatorEmail: 'op@example.com',
      operatorVertical: 'salon',
      gbpReviewId: 'r1',
      postedAt: '2026-05-07T00:00:00Z',
    });
    expect(md).toContain('> Line one.\n> Line two.');
  });
});

describe('briefFilename', () => {
  it('formats as YYYY-MM-DD_<short-id>.md', () => {
    expect(briefFilename({ postedAt: '2026-05-07T14:30:00Z', gbpReviewId: 'rev_abc12345' }))
      .toBe('2026-05-07_rev_abc12.md');
  });

  it('sanitizes the gbp id', () => {
    expect(briefFilename({ postedAt: '2026-05-07T00:00:00Z', gbpReviewId: 'a/b//c?d' }))
      .toBe('2026-05-07_a-b-c-d.md');
  });
});
