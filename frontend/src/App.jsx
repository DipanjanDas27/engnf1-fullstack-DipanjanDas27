import React, { useState } from 'react';
import { Layers, Calendar, CheckSquare, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('triage');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">TriageSync</span>
              <span className="ml-2 text-xs font-semibold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                v2.0
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-4">
            <button
              onClick={() => setActiveTab('triage')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'triage'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <CheckSquare className="w-4 h-4" />
                <span>Ticket Triage</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('resources')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'resources'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4" />
                <span>Resource Booking</span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'admin'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Views</span>
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800">TriageSync Dashboard Scaffolding</h1>
          <p className="mt-2 text-slate-600 text-sm max-w-xl mx-auto">
            React (Vite + Tailwind CSS) client initialized and ready for Auth Context, Optimistic Ticket Review, and 30-minute Resource Slot Booking grid.
          </p>
        </div>
      </main>
    </div>
  );
}
