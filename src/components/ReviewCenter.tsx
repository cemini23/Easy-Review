"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Check, X, RefreshCw, MessageSquare } from "lucide-react";
import { Review, ReviewResponseOptions, generateResponses } from "@/app/actions/reviews";
import { cn } from "@/lib/utils";

export default function ReviewCenter({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews] = useState<Review[]>(initialReviews);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ReviewResponseOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<keyof ReviewResponseOptions | null>(null);

  const currentReview = reviews[currentIndex];

  useEffect(() => {
    let isMounted = true;
    if (currentReview) {
      // Use a timeout or similar to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        if (isMounted) setLoading(true);
      }, 0);

      generateResponses(currentReview).then((res) => {
        if (isMounted) {
          setResponses(res);
          setLoading(false);
        }
      });
      return () => { 
        isMounted = false;
        clearTimeout(timeoutId);
      };
    }
  }, [currentIndex, currentReview]);

  const handleApprove = () => {
    // In a real app, this would send the response to the API
    nextReview();
  };

  const handleSkip = () => {
    nextReview();
  };

  const nextReview = () => {
    setCurrentIndex((prev) => prev + 1);
    setResponses(null);
    setSelectedResponse(null);
  };

  if (currentIndex >= reviews.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="bg-green-100 p-4 rounded-full mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Inbox Zero!</h2>
        <p className="text-slate-500">You&apos;ve responded to all current reviews.</p>
        <button 
          onClick={() => setCurrentIndex(0)}
          className="mt-6 text-indigo-600 font-medium flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Start Over
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto relative h-[600px]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review Command</h1>
        <span className="text-sm bg-slate-200 px-2 py-1 rounded-full font-medium">
          {currentIndex + 1} / {reviews.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentReview.id}
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          className="bg-white rounded-3xl shadow-xl border overflow-hidden flex flex-col h-full"
        >
          <div className="p-6 border-b bg-slate-50">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg">{currentReview.author}</h3>
              <div className="flex gap-1 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={16} fill={i < currentReview.rating ? "currentColor" : "none"} />
                ))}
              </div>
            </div>
            <p className="text-slate-600 italic">&quot;{currentReview.comment}&quot;</p>
            <div className="mt-4 text-xs text-slate-400 flex justify-between">
              <span>{currentReview.source}</span>
              <span>{currentReview.date}</span>
            </div>
          </div>

          <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <MessageSquare className="w-3 h-3" /> Gemini Flash Suggestions
            </h4>
            
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              responses && (
                <div className="space-y-3">
                  {(["empathetic", "professional", "brief"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedResponse(type)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all text-sm",
                        selectedResponse === type 
                          ? "border-indigo-600 bg-indigo-50" 
                          : "border-slate-100 hover:border-slate-200 bg-slate-50"
                      )}
                    >
                      <div className="font-bold capitalize mb-1 text-xs text-indigo-600">{type}</div>
                      {responses[type]}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>

          <div className="p-6 bg-white border-t flex gap-4">
            <button
              onClick={handleSkip}
              className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" /> Skip
            </button>
            <button
              onClick={handleApprove}
              disabled={!selectedResponse}
              className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-5 h-5" /> Approve
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
