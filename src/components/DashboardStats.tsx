import { useState, useEffect } from 'react';
import { Review } from '@/app/actions/reviews';
import { generateDailyBrief } from '@/app/actions';

export default function DashboardStats({ reviews }: { reviews: Review[] }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading the AI brief
    const fetchBrief = async () => {
      if (reviews.length === 0) {
        setLoading(false);
        return;
      }
      const result = await generateDailyBrief(reviews);
      setStats(result);
      setLoading(false);
    };
    fetchBrief();
  }, [reviews]);

  if (loading) return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-20 bg-gray-100 rounded mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 text-white p-6 rounded-2xl shadow-lg mb-6 relative overflow-hidden border border-indigo-500/20">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest opacity-70">Daily Health Score</h2>
          <div className="text-4xl font-bold mt-1 tracking-tight">{stats.score}% <span className="text-sm font-normal opacity-80">Positive</span></div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-widest opacity-70">Trending Dish</div>
          <div className="text-lg font-bold text-green-300">🔥 {stats.topDish}</div>
        </div>
      </div>

      <div className="bg-white/10 p-3 rounded-xl border border-white/10 mb-3 backdrop-blur-sm">
        <p className="text-xs font-bold text-red-200 uppercase mb-1 flex items-center gap-1">
          <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
          Main Issue: {stats.complaint}
        </p>
        <p className="text-sm font-medium leading-relaxed italic">"{stats.summary}"</p>
      </div>

      <div className="flex gap-2 items-center bg-indigo-800/50 p-2.5 rounded-xl border border-white/5">
        <span className="text-lg">💡</span>
        <p className="text-xs font-semibold text-indigo-100 leading-tight">Consultant Tip: <span className="text-white">{stats.tip}</span></p>
      </div>
    </div>
  );
}
