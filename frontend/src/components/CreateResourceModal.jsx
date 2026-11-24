import React, { useState } from 'react';
import { X, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { resourceAPI } from '../api/client.js';

const TYPES = ['ROOM', 'LAB', 'EQUIPMENT'];

export default function CreateResourceModal({ isOpen, onClose, onResourceCreated }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('ROOM');
  const [capacity, setCapacity] = useState(10);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || name.trim().length < 3 || name.trim().length > 60) {
      setErrorMsg('Resource name must be between 3 and 60 characters');
      return;
    }

    const capNum = Number(capacity);
    if (isNaN(capNum) || capNum < 1 || capNum > 500) {
      setErrorMsg('Capacity must be an integer between 1 and 500');
      return;
    }

    setLoading(true);
    try {
      const newResource = await resourceAPI.createResource({
        name: name.trim(),
        type,
        capacity: capNum,
        description: description.trim() || undefined
      });
      if (onResourceCreated) onResourceCreated(newResource);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create resource');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center space-x-2">
            <Plus className="w-5 h-5 text-indigo-200" />
            <span>Create Bookable Resource</span>
          </h3>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Resource Name (Unique, 3–60 Chars)
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cleanroom Chamber B"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Capacity (1–500)
              </label>
              <input
                type="number"
                required
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description (Max 300 Chars)
            </label>
            <textarea
              rows="3"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Resource specifications and capabilities..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Resource...</span>
              </>
            ) : (
              <span>Create Resource</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
