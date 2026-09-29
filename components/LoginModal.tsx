'use client';

import React, { useState } from 'react';
import { X, ShieldCheck, Key, Lock, UserCheck } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: 'analyst' | 'public') => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('analyst@mospi.gov.in');
  const [password, setPassword] = useState('••••••••');
  const [apiKey, setApiKey] = useState('');
  const [activeTab, setActiveTab] = useState<'credentials' | 'apikey'>('credentials');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess('analyst');
    onClose();
  };

  const inputClass =
    'w-full pl-9 pr-3 py-2.5 border border-ink-200 rounded-lg text-sm placeholder:text-ink-300 focus:outline-none focus:border-navy-500 focus:ring-4 focus:ring-navy-100 transition-shadow';

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/50 backdrop-blur-[2px] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-ink-100 shadow-overlay w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-navy-900 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Official Portal Access</h3>
              <p className="text-[11px] text-navy-300">Ministry of Statistics &amp; Programme Implementation</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded-md text-white/80 hover:text-white cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-6 pt-5 flex gap-5 border-b border-ink-100 text-xs">
          {(
            [
              { id: 'credentials', label: 'Govt / RBI Credentials' },
              { id: 'apikey', label: 'API Key Auth' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 font-semibold transition-colors border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-navy-700 text-navy-800'
                  : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 text-xs">
          {activeTab === 'credentials' ? (
            <>
              <div>
                <label className="font-semibold text-ink-900 block mb-1.5">Official Govt Email (.gov.in / .rbi.org.in)</label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3 top-3 text-ink-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink-900 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-ink-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="font-semibold text-ink-900 block mb-1.5">Restricted API Secret Key</label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3 text-ink-400" />
                <input
                  type="text"
                  placeholder="apix_live_sec_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              className="w-full bg-navy-700 text-white hover:bg-navy-800 py-2.5 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Authorize Analyst Session
            </button>
          </div>

          <p className="text-[11px] text-ink-400 text-center leading-relaxed">
            Restricted to MoSPI statisticians and RBI monetary policy analysts.
          </p>
        </form>
      </div>
    </div>
  );
}
