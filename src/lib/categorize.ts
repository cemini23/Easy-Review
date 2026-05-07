import type { Review, Operator, Category } from '@/lib/types';

const POLICY_VIOLATION_PATTERN = /\b(fuck|shit|scam|fraud|sue|piss)\b/i;
const URL_PATTERN = /https?:\/\//i;

export function categorize(review: Review, operator: Operator): Category {
  const rating = review.rating;
  const body = (review.text ?? '').trim();
  const bodyLength = body.length;
  const lowerBody = body.toLowerCase();

  const mentionsService = operator.services.some(
    (s) => s.length > 0 && lowerBody.includes(s.toLowerCase())
  );
  const mentionsStaff = operator.staff_names.some(
    (n) => n.length > 0 && lowerBody.includes(n.toLowerCase())
  );
  const hasSpecificPraise = mentionsService || mentionsStaff || bodyLength > 60;

  if (rating === 5 && hasSpecificPraise) return '5star_specific';
  if (rating === 5) return '5star_generic';
  if (rating === 4) return '4star';
  if (rating === 3) return '3star_mixed';

  if (rating === 1) {
    const isLikelyFake =
      bodyLength < 20 &&
      (POLICY_VIOLATION_PATTERN.test(body) || URL_PATTERN.test(body) || bodyLength === 0);
    if (isLikelyFake) return '1star_fake';
  }

  if (rating <= 2) return '1_2star_complaint';

  // Defensive: rating outside 1-5 → treat as 4star
  return '4star';
}
