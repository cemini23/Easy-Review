'use server';

import { authAsAdmin } from '@/lib/pocketbase';
import { categorize } from '@/lib/categorize';
import { getTemplate } from '@/lib/templates';
import { generateReply } from '@/lib/gemini';
import { serializeBrief, briefFilename, commitBriefToWiki } from '@/lib/wiki-brief';
import type { DraftRow, Operator, Review } from '@/lib/types';

export async function createDraftFromReview(args: {
  operator: Operator;
  review: Review;
}): Promise<DraftRow> {
  const { operator, review } = args;
  const category = categorize(review, operator);
  const template = getTemplate(category);

  let aiDraft = '';
  if (category !== '1star_fake') {
    aiDraft = await generateReply({ review, template, operator });
  }

  const pb = await authAsAdmin();
  const created = await pb.collection('drafts').create({
    operator_id: operator.id,
    gbp_review_id: review.id,
    review_author: review.author,
    review_rating: review.rating,
    review_text: review.text,
    review_date: review.date,
    category,
    suggested_template_id: template.id,
    ai_draft: aiDraft,
    operator_edited_text: null,
    status: 'pending',
  });
  return mapDraft(created);
}

export async function regenerateDraft(args: {
  draftId: string;
  operator: Operator;
}): Promise<DraftRow> {
  const pb = await authAsAdmin();
  const existing = await pb.collection('drafts').getOne(args.draftId);
  const review: Review = {
    id: existing.gbp_review_id,
    author: existing.review_author,
    rating: existing.review_rating,
    text: existing.review_text,
    date: existing.review_date,
    source: 'Manual',
  };
  if (existing.category === '1star_fake') {
    return mapDraft(existing);
  }
  const template = getTemplate(existing.category);
  const newDraft = await generateReply({ review, template, operator: args.operator });
  const updated = await pb.collection('drafts').update(args.draftId, {
    ai_draft: newDraft,
    operator_edited_text: null,
    status: 'pending',
  });
  return mapDraft(updated);
}

export async function editDraft(args: {
  draftId: string;
  edited_text: string;
}): Promise<DraftRow> {
  const pb = await authAsAdmin();
  const updated = await pb.collection('drafts').update(args.draftId, {
    operator_edited_text: args.edited_text,
    status: 'edited',
  });
  return mapDraft(updated);
}

export async function postDraft(args: {
  draftId: string;
  operator: Operator;
}): Promise<{ ok: boolean; brief_status: string; error?: string }> {
  const pb = await authAsAdmin();
  const draft = await pb.collection('drafts').getOne(args.draftId);
  const finalText = draft.operator_edited_text || draft.ai_draft;
  if (!finalText || finalText.length === 0) {
    return { ok: false, brief_status: 'failed', error: 'no draft text' };
  }

  const postedAt = new Date().toISOString();
  const filename = briefFilename({ postedAt, gbpReviewId: draft.gbp_review_id });
  const briefMd = serializeBrief({
    reviewSnapshot: {
      author: draft.review_author,
      rating: draft.review_rating,
      text: draft.review_text,
      date: draft.review_date,
    },
    postedText: finalText,
    category: draft.category,
    operatorEmail: args.operator.email,
    operatorVertical: args.operator.vertical,
    gbpReviewId: draft.gbp_review_id,
    postedAt,
  });

  const commit = await commitBriefToWiki({ filename, content: briefMd });

  await pb.collection('drafts').update(args.draftId, { status: 'posted' });
  await pb.collection('audit_log').create({
    operator_id: args.operator.id,
    gbp_review_id: draft.gbp_review_id,
    review_snapshot: {
      author: draft.review_author,
      rating: draft.review_rating,
      text: draft.review_text,
      date: draft.review_date,
    },
    posted_text: finalText,
    category: draft.category,
    posted_at: postedAt,
    brief_path: `briefs/${filename}`,
    brief_status: commit.status,
  });

  return { ok: true, brief_status: commit.status, error: commit.error };
}

export async function skipDraft(args: { draftId: string }): Promise<void> {
  const pb = await authAsAdmin();
  await pb.collection('drafts').update(args.draftId, { status: 'skipped' });
}

export async function listPendingDrafts(args: {
  operatorId: string;
}): Promise<DraftRow[]> {
  const pb = await authAsAdmin();
  const list = await pb.collection('drafts').getList(1, 50, {
    filter: `operator_id = "${args.operatorId}" && status != "posted" && status != "skipped" && status != "obsolete"`,
    sort: '-created',
  });
  return list.items.map(mapDraft);
}

function mapDraft(row: any): DraftRow {
  return {
    id: row.id,
    operator_id: row.operator_id,
    gbp_review_id: row.gbp_review_id,
    review_author: row.review_author,
    review_rating: row.review_rating,
    review_text: row.review_text,
    review_date: row.review_date,
    category: row.category,
    suggested_template_id: row.suggested_template_id,
    ai_draft: row.ai_draft ?? '',
    operator_edited_text: row.operator_edited_text || null,
    status: row.status,
  };
}
