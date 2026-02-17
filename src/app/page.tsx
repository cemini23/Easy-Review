'use client';

import { useState } from 'react';
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
    // Added 'bg-gray-50 min-h-screen' to force a light background
    <main className="max-w-2xl mx-auto p-4 space-y-6 bg-gray-50 min-h-screen">
      
      {/* HEADER - Changed to Dark Blue (Indigo-950) for high contrast */}
      <div className="flex justify-between items-center py-6">
        <h1 className="text-3xl font-extrabold text-indigo-950 tracking-tight">
          EasyReview
        </h1>
        <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
          {new Date().toLocaleDateString()}
        </span>
      </div>

      {/* INSIGHTS DASHBOARD */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm">
          <div className="text-green-700 text-xs font-bold uppercase tracking-wide">Trending Up</div>
          <div className="mt-1 font-bold text-gray-900">Sea Bass Special</div>
          <div className="text-sm text-gray-600 mt-1">
            Mentioned in <span className="font-bold text-green-700">5 reviews</span>.
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
          <div className="text-orange-700 text-xs font-bold uppercase tracking-wide">Needs Attention</div>
          <div className="mt-1 font-bold text-gray-900">Pasta Seasoning</div>
          <div className="text-sm text-gray-600 mt-1">
            "Salty" in <span className="font-bold text-orange-700">2 reviews</span>.
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-200 my-6"></div>

      {/* REVIEW LIST HEADER - Changed to Pure Black */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-black flex items-center gap-2">
          Pending Approval 
          <span className="text-sm font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {reviews.length}
          </span>
        </h2>
        
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onApprove={handleApprove}
            onEdit={handleEdit}
          />
        ))}

        {reviews.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 shadow-sm">
            <p className="text-gray-900 font-medium">All caught up! Great job today. 🎉</p>
          </div>
        )}
      </div>
    </main>
  );
}