'use client';

import { useState } from 'react';
import { mockReviews, mockVips } from '@/lib/mockData';
import ReviewCard from '@/components/ReviewCard';
import VipCard from '@/components/VipCard';
import MarketingCard from '@/components/MarketingCard';
import DashboardStats from '@/components/DashboardStats';
import { Review, VipCustomer } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'reviews' | 'vips' | 'marketing'>('reviews');
  const [reviews, setReviews] = useState<Review[]>(mockReviews);
  const [vips, setVips] = useState<VipCustomer[]>(mockVips);

  const handleReviewApprove = (id: string) => {
    setReviews(reviews.filter((r) => r.id !== id));
  };

  const handleReviewEdit = (id: string, newText: string) => {
    setReviews(reviews.map((r) => (r.id === id ? { ...r, draftReply: newText } : r)));
  };

  const handleVipAction = (id: string) => {
    setVips(vips.filter((v) => v.id !== id));
  };

  return (
    <div className="pb-20">
      {/* TABS */}
      <div className="max-w-md mx-auto flex gap-1.5 mb-6 overflow-x-auto no-scrollbar pb-2">
        <button 
          onClick={() => setActiveTab('reviews')}
          className={`flex-1 min-w-[100px] py-3 text-[11px] font-bold rounded-xl transition-all flex justify-center items-center gap-1.5 border ${
            activeTab === 'reviews' 
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]' 
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Reviews 
          <span className={`px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'reviews' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {reviews.length}
          </span>
        </button>
        
        <button 
          onClick={() => setActiveTab('vips')}
          className={`flex-1 min-w-[100px] py-3 text-[11px] font-bold rounded-xl transition-all flex justify-center items-center gap-1.5 border ${
            activeTab === 'vips' 
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]' 
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          VIPs
          <span className={`px-2 py-0.5 rounded-full text-[9px] ${activeTab === 'vips' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'}`}>
            {vips.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('marketing')}
          className={`flex-1 min-w-[100px] py-3 text-[11px] font-bold rounded-xl transition-all flex justify-center items-center gap-1.5 border ${
            activeTab === 'marketing' 
              ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-[1.02]' 
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Marketing ✨
        </button>
      </div>

      {/* FEED */}
      <main className="max-w-md mx-auto">
        {activeTab === 'reviews' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* THE MORNING BRIEF */}
            <DashboardStats reviews={reviews} />
            
            {reviews.length === 0 ? (
              <div className="text-center py-20 opacity-50">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-gray-400">All Clear!</h2>
              </div>
            ) : (
              reviews.map((review) => (
                <ReviewCard key={review.id} review={review} onApprove={handleReviewApprove} onEdit={handleReviewEdit} />
              ))
            )}
          </div>
        ) : activeTab === 'vips' ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {vips.length === 0 ? (
              <div className="text-center py-20 opacity-50">
                <div className="text-6xl mb-4">🤝</div>
                <h2 className="text-xl font-bold text-gray-400">VIPs are Happy!</h2>
              </div>
            ) : (
              vips.map((vip) => (
                <VipCard key={vip.id} vip={vip} onAction={handleVipAction} />
              ))
            )}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MarketingCard />
            <div className="text-center mt-8 p-6 bg-purple-50 rounded-2xl border border-dashed border-purple-200">
              <p className="text-purple-800 font-bold text-sm mb-1">💡 Idea Bank</p>
              <p className="text-purple-600 text-xs font-medium">Try: "Live Music Friday" or "New Wine List"</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
