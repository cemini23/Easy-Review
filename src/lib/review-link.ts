/**
 * Review-acquisition links — pure helpers.
 *
 * The wiki (`concepts/reviews-reputation-management.md`) recommends a QR code
 * at the front desk and a post-service link card. It also draws a hard line:
 * **review gating is forbidden** — the link must go to every customer, never
 * only the ones expected to leave 5★. These helpers build a single,
 * unconditional Google review link; the UI carries the no-gating warning.
 */

/** The direct "write a review" URL for a Google Business Profile place_id. */
export function gbpReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
    placeId.trim(),
  )}`;
}

/** A short SMS asking for a review — sent to every customer, no filtering. */
export function smsTemplate(businessName: string, url: string): string {
  return `Thanks for visiting ${businessName}! If you have 30 seconds, a quick Google review really helps us out: ${url}`;
}

/** A review-request email — subject + body. */
export function emailTemplate(
  businessName: string,
  url: string,
): { subject: string; body: string } {
  return {
    subject: `How was your visit to ${businessName}?`,
    body: `Hi,

Thanks for choosing ${businessName}. We'd love to hear how it went — a quick Google review helps other locals find us and helps us keep improving.

Leave a review here: ${url}

Thank you,
${businessName}`,
  };
}
