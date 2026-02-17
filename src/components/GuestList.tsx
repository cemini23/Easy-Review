"use client";

import { useState } from "react";
import { Guest, draftSMS } from "@/app/actions/guests";
import { Calendar, MessageCircle, Send, Star } from "lucide-react";

export default function GuestList({ slippingRegulars }: { slippingRegulars: Guest[] }) {
  const [draftingGuest, setDraftingGuest] = useState<Guest | null>(null);
  const [smsDraft, setSmsDraft] = useState("");

  const handleDraft = async (guest: Guest) => {
    setDraftingGuest(guest);
    const draft = await draftSMS(guest);
    setSmsDraft(draft);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">VIP Re-Engager</h1>
        <p className="text-slate-500">Regulars who haven&apos;t visited in 45+ days.</p>
      </div>

      <div className="grid gap-4">
        {slippingRegulars.map((guest) => (
          <div key={guest.email} className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{guest.name}</h3>
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> {guest.visit_count} visits
                </span>
              </div>
              <div className="text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Last: {guest.last_visit}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> Fav: {guest.favorite_item}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleDraft(guest)}
              className="p-3 rounded-xl bg-slate-50 text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        ))}

        {slippingRegulars.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
            <p className="text-slate-500">No slipping regulars found. Good job!</p>
          </div>
        )}
      </div>

      {draftingGuest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Draft Invite for {draftingGuest.name}</h2>
            </div>
            <div className="p-6">
              <div className="bg-slate-100 p-4 rounded-2xl text-slate-800 text-sm mb-4 leading-relaxed">
                {smsDraft}
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Sent to: {draftingGuest.phone}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDraftingGuest(null)}
                  className="flex-1 py-3 rounded-xl border font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert("SMS Sent!");
                    setDraftingGuest(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors"
                >
                  Send Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
