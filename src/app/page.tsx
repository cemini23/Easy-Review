'use client';

import { useState } from 'react';
import Image from 'next/image';
import { mockReviews } from '@/lib/mockData';
import ReviewCard from '@/components/ReviewCard';
import { Review } from '@/types';

export default function Home() {
  const [reviews, setReviews] = useState<Review[]>(mockReviews);

  const handleApprove = (id: number) => {
    setReviews(reviews.filter((r) => r.id !== id));
  };

  const handleEdit = (id: number, newText: string) => {
    setReviews(reviews.map((r) => (r.id === id ? { ...r, draftReply: newText } : r)));
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* BRAND HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 overflow-hidden rounded-lg shadow-sm border border-gray-100">
              <Image 
                src="/logo.png" 
                alt="Easy Review Logo" 
                width={40} 
                height={40}
                className="object-cover"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900 leading-tight">Easy Review</h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">By Cemini</p>
            </div>
          </div>
          <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
            {reviews.length} Pending
          </div>
        </div>
      </header>

      {/* FEED */}
      <main className="max-w-md mx-auto px-4 pt-6">
        {reviews.length === 0 ? (
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
              onApprove={handleApprove}
              onEdit={handleEdit}
            />
          ))
        )}
      </main>
    </div>
  );
}
