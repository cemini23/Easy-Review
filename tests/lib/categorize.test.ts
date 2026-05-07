import { describe, it, expect } from 'vitest';
import { categorize } from '@/lib/categorize';
import type { Operator } from '@/lib/types';

const op: Operator = {
  id: '1',
  email: 'op@example.com',
  business_name: 'Test Shop',
  vertical: 'barbershop',
  services: ['fade', 'beard trim'],
  staff_names: ['Joey', 'Mike'],
  active: true,
};

describe('categorize', () => {
  it('5-star + service mention → 5star_specific', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 5, text: 'Best fade in town!', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('5star_specific');
  });

  it('5-star + staff name mention → 5star_specific', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 5, text: 'Joey was amazing', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('5star_specific');
  });

  it('5-star + body > 60 chars → 5star_specific', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 5, text: 'I had such a great time and the place was clean and welcoming', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('5star_specific');
  });

  it('5-star + short generic → 5star_generic', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 5, text: 'Great!', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('5star_generic');
  });

  it('4-star → 4star', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 4, text: 'Pretty good', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('4star');
  });

  it('3-star → 3star_mixed', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 3, text: 'Mixed bag', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('3star_mixed');
  });

  it('2-star → 1_2star_complaint', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 2, text: 'Disappointed', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('1_2star_complaint');
  });

  it('1-star with substantial body → 1_2star_complaint', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 1, text: 'Service was very slow and rude', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('1_2star_complaint');
  });

  it('1-star with very short body and slur → 1star_fake', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 1, text: 'scam', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('1star_fake');
  });

  it('1-star with very short body and link → 1star_fake', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 1, text: 'http://x.co', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('1star_fake');
  });

  it('matches are case-insensitive on services + staff', () => {
    const result = categorize(
      { id: '1', author: 'A', rating: 5, text: 'JOEY rocks', date: '', source: 'Manual' },
      op
    );
    expect(result).toBe('5star_specific');
  });
});
