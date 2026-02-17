'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getReviews, updateReviewStatus } from '@/app/actions/reviews';
import ReviewCard from '@/components/ReviewCard';
import { Review } from '@/app/actions/reviews';

export default function Home() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      const data = await getReviews();
      setReviews(data);
      setLoading(false);
    }
    loadReviews();
  }, []);

  const handleAction = async (id: string, status: 'replied' | 'skipped') => {
    // Optimistic UI update
    setReviews(prev => prev.filter(r => r.id !== id));
    
    try {
      await updateReviewStatus(id, status);
    } catch (error) {
      console.error("Failed to update status:", error);
      // Re-fetch in case of error to stay in sync
      const data = await getReviews();
      setReviews(data);
    }
  };

  const handleEdit = (id: string, newText: string) => {
    setReviews(reviews.map((r) => (r.id === id ? { ...r, draftReply: newText } : r)));
  };

  return (
    <div className="pb-20">
      <div className="max-w-md mx-auto mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Pending Reviews</h2>
        <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
          {reviews.length} Total
        </div>
      </div>

      {/* FEED */}
      <main className="max-w-md mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-400">All Caught Up!</h2>
            <p className="text-sm text-gray-400 mt-2">No new reviews to process.</p>
          </div>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onApprove={(id) => handleAction(id, 'replied')}
              onEdit={handleEdit}
            />
          ))
        )}
      </main>
    </div>
  );
}
