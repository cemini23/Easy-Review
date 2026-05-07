import { useState } from 'react';
import { Review } from '@/types';

interface ReviewCardProps {
  review: Review;
  onApprove: (id: number) => void;
  onEdit: (id: number, newText: string) => void;
}

export default function ReviewCard({ review, onApprove, onEdit }: ReviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(review.draftReply || "Thank you for your feedback!");
  const [status, setStatus] = useState<'idle' | 'success' | 'copying'>('idle');

  const handlePost = async () => {
    if (review.source === 'Google') {
      // Simulate API "Loading" -> Success
      setStatus('success');
      
      // Wait 1 second so the user sees "Posted!", then remove the card
      setTimeout(() => {
        onApprove(review.id);
      }, 1200);

    } else {
      // "Copy & Fly" Flow
      try {
        await navigator.clipboard.writeText(draft);
        setStatus('copying'); // Shows "Copied!"
        
        // Wait 1.5 seconds for them to realize it copied, then remove
        setTimeout(() => {
          onApprove(review.id);
          // In a real app, this would also window.open(url)
        }, 1500);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  };

  // Helper to get button text based on status
  const getButtonText = () => {
    if (status === 'success') return '✅ Posted Successfully';
    if (status === 'copying') return '📋 Copied to Clipboard!';
    return review.source === 'Google' ? '🚀 Post Reply' : '📋 Copy Text';
  };

  // Helper to get button color
  const getButtonColor = () => {
    if (status === 'success' || status === 'copying') return 'bg-green-600 hover:bg-green-700';
    return 'bg-indigo-600 hover:bg-indigo-700';
  };

  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 transition-all duration-500 ${status !== 'idle' ? 'opacity-50 scale-95' : 'opacity-100'}`}>
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-900">{review.author}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-yellow-400 text-sm">{"★".repeat(review.rating)}</span>
            <span className="text-xs text-gray-400">{review.source} • {review.date}</span>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          review.sentiment === 'Positive' ? 'bg-green-100 text-green-700' :
          review.sentiment === 'Negative' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {review.sentiment}
        </span>
      </div>
      
      {/* REVIEW TEXT */}
      <p className="text-gray-700 text-sm mb-4 leading-relaxed">{review.text}</p>

      {/* EDITING MODE */}
      {isEditing ? (
        <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-gray-600 text-xs font-medium hover:text-gray-900"
            >
              Cancel
            </button>
            <button 
              onClick={() => { onEdit(review.id, draft); setIsEditing(false); }}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        /* APPROVE MODE (Blue Box) */
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 transition-colors duration-300">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1">
              ✨ AI Suggested Reply
            </span>
            {status === 'idle' && (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-blue-600 text-xs font-semibold hover:text-blue-800"
              >
                Edit
              </button>
            )}
          </div>
          
          <p className="text-gray-700 text-sm italic mb-3">"{review.draftReply || draft}"</p>
          
          <button 
            onClick={handlePost}
            disabled={status !== 'idle'}
            className={`w-full py-3 text-white text-sm font-bold rounded-lg transition-all shadow-md active:scale-95 flex justify-center items-center gap-2 ${getButtonColor()}`}
          >
            {getButtonText()}
          </button>
        </div>
      )}
    </div>
  );
}
