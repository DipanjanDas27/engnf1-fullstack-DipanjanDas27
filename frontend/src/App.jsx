import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layers, Calendar, CheckSquare, ShieldCheck, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { checkAuth, logout, selectUser, selectIsAuthenticated, selectIsAdmin } from './store/slices/authSlice.js';
import AuthModal from './components/AuthModal.jsx';
import TriageQueue from './pages/TriageQueue.jsx';
import Resources from './pages/Resources.jsx';

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin = useSelector(selectIsAdmin);

  const [activeTab, setActiveTab] = useState('triage');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Version */}
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
          <nav className="hidden sm:flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('triage')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'triage'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
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
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'resources'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4" />
                <span>Resource Booking</span>
              </span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Dashboard</span>
                </span>
              </button>
            )}
          </nav>

          {/* User Account & Session Actions */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                  <span className="text-xs text-slate-500 font-mono">{user.email}</span>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {user.role}
                </span>
                <button
                  onClick={() => dispatch(logout())}
                  title="Sign Out"
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'triage' && <TriageQueue />}

        {activeTab === 'resources' && <Resources />}

        {activeTab === 'admin' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-8 text-center">
            <h2 className="text-xl font-bold text-slate-800">Administrative Analytics & Governance</h2>
            <p className="mt-2 text-slate-600 text-sm max-w-xl mx-auto">
              Resource toggle, approval/rejection workflows, and metrics dashboard.
            </p>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
