import { useState } from 'react';
import { VipCustomer } from '@/types';
import { generateWinBack } from '@/app/actions';

interface VipCardProps {
  vip: VipCustomer;
  onAction: (id: string) => void;
}

export default function VipCard({ vip, onAction }: VipCardProps) {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'sent'>('idle');

  const handleGenerate = async () => {
    setStatus('generating');
    const msg = await generateWinBack(vip.name, vip.favoriteDish, vip.lastVisit);
    setDraft(msg);
    setStatus('ready');
  };

  const handleSend = async () => {
    await navigator.clipboard.writeText(draft);
    setStatus('sent');
    setTimeout(() => onAction(vip.id), 2000);
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100 mb-4 relative overflow-hidden">
      {/* "MISSING" LABEL */}
      <div className="absolute top-0 right-0 bg-red-100 text-red-600 text-[10px] font-bold px-3 py-1 rounded-bl-lg">
        MISSING {vip.lastVisit} DAYS
      </div>

      <div className="mb-3">
        <h3 className="font-bold text-gray-900 text-lg">{vip.name}</h3>
        <p className="text-xs text-gray-600 font-medium italic">Total Spend: <span className="font-bold text-gray-900">{vip.totalSpend}</span> • Loves {vip.favoriteDish}</p>
      </div>

      {status === 'idle' || status === 'generating' ? (
        <button 
          onClick={handleGenerate}
          disabled={status === 'generating'}
          className="w-full py-3 bg-red-50 text-red-600 font-bold text-sm rounded-lg hover:bg-red-100 transition-colors flex justify-center items-center gap-2 border border-red-100"
        >
          {status === 'generating' ? '✨ Drafting Message...' : '💔 We Miss You (Draft Text)'}
        </button>
      ) : (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
          <textarea 
            className="w-full bg-white p-2 border border-gray-200 rounded-md text-sm text-gray-800 outline-none mb-2 resize-none font-medium"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button 
            onClick={handleSend}
            className={`w-full py-2.5 text-white font-bold text-sm rounded-lg shadow-sm active:scale-95 transition-all ${
              status === 'sent' ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {status === 'sent' ? '✅ Copied to Clipboard!' : '📩 Copy & Send Text'}
          </button>
        </div>
      )}
    </div>
  );
}
