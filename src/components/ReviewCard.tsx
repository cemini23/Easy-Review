import { useState } from 'react';
import { Review } from '@/app/actions/reviews';
import { generateReply } from '@/app/actions';

interface ReviewCardProps {
  review: Review;
  onApprove: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
}

export default function ReviewCard({ review, onApprove, onEdit }: ReviewCardProps) {
  const [draft, setDraft] = useState(review.draftReply || "Thank you for your feedback!");
  const [status, setStatus] = useState<'idle' | 'success' | 'copying' | 'generating'>('idle');

  // Derive sentiment for the AI prompt
  const sentiment = review.rating >= 4 ? 'Positive' : review.rating <= 2 ? 'Negative' : 'Neutral';

  // Handle Tone Click
  const handleTone = async (tone: string) => {
    setStatus('generating');
    try {
      const newReply = await generateReply(review.comment, sentiment, review.author, tone);
      setDraft(newReply);
      onEdit(review.id, newReply);
      setStatus('idle');
    } catch (error) {
      console.error(error);
      setStatus('idle');
    }
  };

  const handlePost = async () => {
    setStatus('success');
    setTimeout(() => onApprove(review.id), 1200);
  };

  const getButtonText = () => {
    if (status === 'success') return '✅ Sent!';
    if (status === 'copying') return '📋 Copied!';
    if (status === 'generating') return '✨ Thinking...';
    return '🚀 Post Reply';
  };

  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 transition-all duration-500 ${status === 'success' || status === 'copying' ? 'opacity-50 scale-95' : 'opacity-100'}`}>
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-900">{review.author}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-yellow-500 text-sm">{"★".repeat(review.rating)}</span>
            <span className="text-xs text-gray-600 font-medium">{review.source}</span>
          </div>
        </div>
      </div>
      
      <p className="text-gray-700 text-sm mb-4 leading-relaxed">{review.comment}</p>

      {/* AI CONTROL BOX */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
        
        {/* TONE SELECTORS (The New Feature) */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
          <button onClick={() => handleTone('friendly')} disabled={status !== 'idle'} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-700 shadow-sm active:scale-95 whitespace-nowrap hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
            😊 Friendly
          </button>
          <button onClick={() => handleTone('formal')} disabled={status !== 'idle'} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-700 shadow-sm active:scale-95 whitespace-nowrap hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
            👔 Formal
          </button>
          <button onClick={() => handleTone('short')} disabled={status !== 'idle'} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-700 shadow-sm active:scale-95 whitespace-nowrap hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
            ⚡ Short
          </button>
        </div>

        {/* TEXT AREA (Editable) */}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full p-3 mb-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
          rows={3}
        />
        
        {/* ACTION BUTTON */}
        <button 
          onClick={handlePost}
          disabled={status !== 'idle'}
          className={`w-full py-3 text-white text-sm font-bold rounded-lg transition-all shadow-md active:scale-95 flex justify-center items-center gap-2 ${
            status === 'generating' ? 'bg-purple-500 animate-pulse' : 
            status === 'success' || status === 'copying' ? 'bg-green-600' : 
            'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}
