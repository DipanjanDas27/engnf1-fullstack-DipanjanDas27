import React, { useState } from 'react';
import { X, AlertCircle, Loader2, XCircle } from 'lucide-react';
import { bookingAPI } from '../api/client.js';

export default function RejectBookingModal({ booking, isOpen, onClose, onBookingRejected }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen || !booking) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!note.trim() || note.trim().length < 5 || note.trim().length > 200) {
      setErrorMsg('A rejection note between 5 and 200 characters is mandatory (Rule B11)');
      return;
    }

    setLoading(true);
    try {
      const updated = await bookingAPI.rejectBooking(booking.id, note.trim());
      if (onBookingRejected) onBookingRejected(updated);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reject booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4 text-white flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-200" />
            <span>Reject Booking Request</span>
          </h3>
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>Resource: <strong className="text-slate-800">{booking.resourceName}</strong></div>
            <div>User: <strong className="text-slate-800">{booking.userName || booking.userEmail}</strong></div>
            <div>Slot: <span className="font-mono">{new Date(booking.startTime).toLocaleString()}</span></div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Rejection Note (Mandatory, 5–200 Chars)
            </label>
            <textarea
              required
              rows="3"
              minLength={5}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="State the operational reason for rejecting this slot reservation..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
            />
            <div className="text-[11px] text-slate-400 text-right">{note.length}/200</div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Rejecting Booking...</span>
              </>
            ) : (
              <span>Confirm Booking Rejection</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
