import { useState } from 'react';
import { generateSocialPost } from '@/app/actions';
import { Instagram, Send, CloudSun, Sparkles } from 'lucide-react';

export default function SocialPostCard() {
  const [topic, setTopic] = useState("");
  const [weather] = useState("Cloudy & Rainy"); // In a real app, this would fetch from a weather API
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready' | 'copied'>('idle');

  const handleGenerate = async () => {
    if (!topic) return;
    setStatus('generating');
    const msg = await generateSocialPost(topic, weather);
    setDraft(msg);
    setStatus('ready');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft);
    setStatus('copied');
    setTimeout(() => setStatus('ready'), 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-700">
          <Instagram size={20} />
          <h3 className="font-bold text-sm uppercase tracking-wider">Social Auto-Pilot</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-100">
          <CloudSun size={12} className="text-orange-400" />
          DAVIE: {weather.toUpperCase()}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">What's the highlight?</label>
          <input 
            type="text" 
            placeholder="e.g. Lasagna special, New wine list..."
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        {status === 'idle' || status === 'generating' ? (
          <button 
            onClick={handleGenerate}
            disabled={!topic || status === 'generating'}
            className="w-full py-3.5 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-md hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
          >
            {status === 'generating' ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                Gemini is Writing...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Viral Caption
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 relative group">
              <textarea 
                className="w-full bg-transparent text-sm text-gray-800 outline-none leading-relaxed font-medium resize-none"
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            <button 
              onClick={handleCopy}
              className={`w-full py-3.5 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                status === 'copied' ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {status === 'copied' ? '✅ Copied to Clipboard!' : '📋 Copy Caption'}
            </button>
            <button 
              onClick={() => setStatus('idle')}
              className="w-full text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              Start New Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
