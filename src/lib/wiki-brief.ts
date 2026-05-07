import type { Category, Vertical } from '@/lib/types';

export interface SerializeBriefArgs {
  reviewSnapshot: {
    author: string;
    rating: number;
    text: string;
    date: string;
  };
  postedText: string;
  category: Category;
  operatorEmail: string;
  operatorVertical: Vertical;
  gbpReviewId: string;
  postedAt: string; // ISO 8601
}

export function serializeBrief(args: SerializeBriefArgs): string {
  const today = args.postedAt.slice(0, 10);
  const escapedAuthor = args.reviewSnapshot.author.replace(/\n/g, ' ');
  const reviewBody = args.reviewSnapshot.text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const replyBody = args.postedText
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

  return `---
title: GBP reply — ${escapedAuthor} (${args.reviewSnapshot.rating}★) — ${today}
type: brief
tags: [reviews, ${args.operatorVertical}, gbp-posted]
target: GBP (posted)
operator: ${args.operatorEmail}
gbp_review_id: ${args.gbpReviewId}
posted_at: ${args.postedAt}
category: ${args.category}
created: ${today}
---

## Target
GBP — posted via API

## Body
**Inbound:**
${reviewBody}
> — ★${args.reviewSnapshot.rating}, ${escapedAuthor}, GBP, ${args.reviewSnapshot.date}

**Posted reply:**
${replyBody}

## Sources
[Source: GBP API review ${args.gbpReviewId} (posted ${args.postedAt})]
`;
}

export function briefFilename(args: { postedAt: string; gbpReviewId: string }): string {
  const date = args.postedAt.slice(0, 10);
  const sanitized = args.gbpReviewId
    .replace(/[^a-zA-Z0-9_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const short = sanitized.slice(0, 9);
  return `${date}_${short}.md`;
}
