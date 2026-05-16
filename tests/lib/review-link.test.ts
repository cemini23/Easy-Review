import { describe, it, expect } from 'vitest';
import { gbpReviewUrl, smsTemplate, emailTemplate } from '@/lib/review-link';

describe('gbpReviewUrl', () => {
  it('builds the Google write-a-review URL for a place_id', () => {
    expect(gbpReviewUrl('ChIJabc123')).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJabc123',
    );
  });
  it('trims and URL-encodes the place_id', () => {
    expect(gbpReviewUrl('  ChIJ a/b  ')).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJ%20a%2Fb',
    );
  });
});

describe('smsTemplate', () => {
  it('includes the business name and the URL', () => {
    const sms = smsTemplate('Barone Cuts', 'https://x.co/r');
    expect(sms).toContain('Barone Cuts');
    expect(sms).toContain('https://x.co/r');
  });
});

describe('emailTemplate', () => {
  it('returns a subject and body referencing the business + URL', () => {
    const { subject, body } = emailTemplate('Barone Cuts', 'https://x.co/r');
    expect(subject).toContain('Barone Cuts');
    expect(body).toContain('https://x.co/r');
    expect(body).toContain('Barone Cuts');
  });
});
