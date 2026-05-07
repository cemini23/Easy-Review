import { describe, it, expect } from 'vitest';
import { buildPrompt } from '@/lib/gemini';
import type { CategoryDef, Operator, Review } from '@/lib/types';

const op: Operator = {
  id: '1',
  email: 'op@example.com',
  business_name: 'Barone Cuts',
  vertical: 'barbershop',
  sign_off: '— Joey',
  services: ['fade'],
  staff_names: ['Joey'],
  active: true,
};

const review: Review = {
  id: 'r1',
  author: 'Mike R.',
  rating: 5,
  text: 'Joey was great! Got me cleaned up.',
  date: '2026-05-06',
  source: 'Manual',
};

const template: CategoryDef = {
  id: '5star_specific',
  label: '5-star with specific praise',
  trigger: { rating: 5, has_specific_praise: true },
  response_goal: 'Reinforce + thank',
  templates: [
    {
      example_inbound: 'Joey was great...',
      example_response: 'Thanks for the love, Mike!',
      rules: ['First name only', '1-2 sentences', 'No URLs'],
    },
  ],
};

describe('buildPrompt', () => {
  it('mentions the operator vertical', () => {
    expect(buildPrompt({ review, template, operator: op })).toMatch(/barbershop/);
  });
  it('includes the rules', () => {
    const p = buildPrompt({ review, template, operator: op });
    expect(p).toContain('First name only');
    expect(p).toContain('No URLs');
  });
  it('includes the example response as an exemplar', () => {
    expect(buildPrompt({ review, template, operator: op })).toContain('Thanks for the love, Mike!');
  });
  it('includes the sign-off if set', () => {
    expect(buildPrompt({ review, template, operator: op })).toContain('— Joey');
  });
  it('omits sign-off line when not set', () => {
    const noSign = { ...op, sign_off: undefined };
    expect(buildPrompt({ review, template, operator: noSign })).not.toContain('Sign off');
  });
  it('quotes the review text inline', () => {
    expect(buildPrompt({ review, template, operator: op })).toContain('Joey was great');
  });
});
