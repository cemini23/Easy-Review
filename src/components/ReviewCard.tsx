'use client';

import { useState, useTransition } from 'react';
import {
  editDraft,
  regenerateDraft,
  postDraft,
  skipDraft,
} from '@/app/actions/drafts';
import type { DraftRow, Operator } from '@/lib/types';

const FAKE_CATEGORY = '1star_fake';

export default function ReviewCard({
  draft,
  operator,
  onMutate,
}: {
  draft: DraftRow;
  operator: Operator;
  onMutate: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.operator_edited_text ?? draft.ai_draft ?? '');
  const [overrideFake, setOverrideFake] = useState(false);

  const isFake = draft.category === FAKE_CATEGORY && !overrideFake;

  const handleEditSave = () => {
    startTransition(async () => {
      await editDraft({ draftId: draft.id, edited_text: text });
      setEditing(false);
      onMutate();
    });
  };

  const handleRegenerate = () => {
    startTransition(async () => {
      const updated = await regenerateDraft({ draftId: draft.id, operator });
      setText(updated.ai_draft);
      onMutate();
    });
  };

  const handlePost = () => {
    startTransition(async () => {
      await postDraft({ draftId: draft.id, operator });
      onMutate();
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      await skipDraft({ draftId: draft.id });
      onMutate();
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-gray-900">{draft.review_author}</h3>
          <p className="text-xs text-gray-500">
            {draft.review_rating}★ · {draft.review_date}
          </p>
        </div>
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
          draft.category === FAKE_CATEGORY ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {draft.category}
        </span>
      </div>

      <p className="text-sm text-gray-700">{draft.review_text}</p>

      {isFake ? (
        <div className="bg-red-50 border border-red-200 p-3 rounded-lg space-y-2">
          <p className="text-sm text-red-900">
            This looks like a likely fake or policy-violating review. Per wiki guidance, don&apos;t engage emotionally.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleSkip} disabled={pending} className="px-3 py-2 bg-gray-200 text-sm rounded">
              Don&apos;t reply
            </button>
            <button
              onClick={() => window.open(`https://support.google.com/business/answer/4596773`, '_blank')}
              className="px-3 py-2 bg-gray-200 text-sm rounded"
            >
              Flag to GBP
            </button>
            <button onClick={() => setOverrideFake(true)} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded">
              Override & draft anyway
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg space-y-2">
          <p className="text-[10px] uppercase font-bold text-blue-800">AI suggested reply</p>
          {editing ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full p-2 border rounded text-sm"
            />
          ) : (
            <p className="text-sm text-gray-700 italic">&ldquo;{text}&rdquo;</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {editing ? (
              <button onClick={handleEditSave} disabled={pending} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded">
                Save
              </button>
            ) : (
              <button onClick={() => setEditing(true)} className="px-3 py-2 bg-gray-100 text-sm rounded">
                Edit
              </button>
            )}
            <button onClick={handleRegenerate} disabled={pending} className="px-3 py-2 bg-gray-100 text-sm rounded">
              Regenerate
            </button>
            <button onClick={handleCopy} className="px-3 py-2 bg-gray-100 text-sm rounded">
              Copy
            </button>
            <button onClick={handlePost} disabled={pending} className="px-3 py-2 bg-green-600 text-white text-sm font-bold rounded ml-auto">
              Post
            </button>
            <button onClick={handleSkip} disabled={pending} className="px-3 py-2 bg-gray-200 text-sm rounded">
              Skip
            </button>
          </div>
          {draft.category === '3star_mixed' && (
            <p className="text-xs text-amber-700">
              Reminder: also send a private message to invite this customer to follow up offline.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
