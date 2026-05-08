import { Octokit } from '@octokit/rest';
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
  const escapedAuthor = args.reviewSnapshot.author.replace(/\n/g, ' ').trim();
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
operator_vertical: ${args.operatorVertical}
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

export interface CommitBriefArgs {
  filename: string;
  content: string;
}

export interface CommitBriefResult {
  status: 'committed' | 'failed';
  sha?: string;
  htmlUrl?: string;
  error?: string;
}

export async function commitBriefToWiki(
  args: CommitBriefArgs
): Promise<CommitBriefResult> {
  const owner = process.env.WIKI_GITHUB_OWNER;
  const repo = process.env.WIKI_GITHUB_REPO;
  const branch = process.env.WIKI_GITHUB_BRANCH ?? 'main';
  const auth = process.env.WIKI_GITHUB_PAT;

  if (!owner || !repo || !auth) {
    return {
      status: 'failed',
      error: 'WIKI_GITHUB_OWNER / WIKI_GITHUB_REPO / WIKI_GITHUB_PAT not set',
    };
  }

  const octokit = new Octokit({ auth });
  const path = `briefs/${args.filename}`;
  const message = `add: brief — ${args.filename}`;
  const contentBase64 = Buffer.from(args.content, 'utf8').toString('base64');

  try {
    const res = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: contentBase64,
      branch,
    });
    return {
      status: 'committed',
      sha: res.data.commit.sha ?? undefined,
      htmlUrl: res.data.commit.html_url ?? undefined,
    };
  } catch (e) {
    return {
      status: 'failed',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
