'use client';

import { useState } from 'react';
import { Settings, Globe, Shield, Bell, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Link href="/" className="text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-bold text-lg text-gray-900">Settings</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* GOOGLE CONNECTION */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Globe className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Google Business</h2>
              <p className="text-xs text-gray-500">Sync real reviews automatically</p>
            </div>
          </div>

          {!isConnected ? (
            <button 
              onClick={() => setIsConnected(true)}
              className="w-full py-3 bg-white border border-gray-300 rounded-xl font-bold text-sm text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Connect Google Account
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                <span className="text-sm font-medium text-green-700">✓ Connected to "Barone's Italian"</span>
                <button className="text-xs text-red-600 font-bold">Disconnect</button>
              </div>
              <button className="w-full py-2 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg">
                Sync Reviews Now
              </button>
            </div>
          )}
        </section>

        {/* APP PREFERENCES */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">New Review Alerts</span>
              </div>
              <div className="w-10 h-5 bg-indigo-600 rounded-full relative">
                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Auto-Approve 5 Stars</span>
              </div>
              <div className="w-10 h-5 bg-gray-200 rounded-full relative">
                <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
