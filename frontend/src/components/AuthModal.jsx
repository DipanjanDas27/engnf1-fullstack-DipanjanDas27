import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X, Lock, Mail, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { login, register, clearError, selectAuth } from '../store/slices/authSlice.js';

export default function AuthModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { actionLoading, error } = useSelector(selectAuth);

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'login') {
      const res = await dispatch(login({ email, password }));
      if (!res.error) onClose();
    } else {
      const res = await dispatch(register({ name, email, password }));
      if (!res.error) onClose();
    }
  };

  const fillCredentials = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    dispatch(clearError());
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-6 h-6 text-indigo-200" />
            <h3 className="text-lg font-bold">
              {mode === 'login' ? 'Sign In to TriageSync' : 'Create Agent Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Quick-Fill Bar */}
        <div className="bg-indigo-50/80 px-6 py-3 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
          <span className="font-semibold text-indigo-800">Quick-Fill Demo:</span>
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => fillCredentials('admin@triagesync.test', 'Admin@123')}
              className="px-2.5 py-1 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Admin Lead
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('user@triagesync.test', 'User@123')}
              className="px-2.5 py-1 rounded bg-white text-indigo-700 border border-indigo-300 font-medium hover:bg-indigo-50 transition-colors"
            >
              Agent Demo
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Support Agent"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@triagesync.test"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={actionLoading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
          >
            {actionLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>

          <div className="text-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                dispatch(clearError());
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              {mode === 'login'
                ? "Don't have an account? Register here"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
