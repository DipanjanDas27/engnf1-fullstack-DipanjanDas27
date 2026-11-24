import React, { useState } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { bookingAPI } from '../api/client.js';

// Standard 30-minute time slots (08:00 to 20:00)
const TIME_OPTIONS = [];
for (let h = 8; h <= 20; h++) {
  const hourStr = String(h).padStart(2, '0');
  TIME_OPTIONS.push(`${hourStr}:00`);
  if (h < 20) TIME_OPTIONS.push(`${hourStr}:30`);
}

const DURATIONS = [
  { label: '30 Minutes', minutes: 30 },
  { label: '1 Hour (60 mins)', minutes: 60 },
  { label: '1.5 Hours (90 mins)', minutes: 90 },
  { label: '2 Hours (120 mins)', minutes: 120 },
  { label: '3 Hours (180 mins)', minutes: 180 },
  { label: '4 Hours (240 mins)', minutes: 240 }
];

export default function BookingModal({ resource, isOpen, onClose, onBookingCreated }) {
  // Format today's date + 1 for default date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const [date, setDate] = useState(minDateStr);
  const [startTimeStr, setStartTimeStr] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [purpose, setPurpose] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen || !resource) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!purpose.trim() || purpose.trim().length < 5 || purpose.trim().length > 200) {
      setErrorMsg('Booking purpose must be between 5 and 200 characters');
      return;
    }

    // Parse date and time in UTC to satisfy Rules B1 & B2
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);

    const start = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const now = Date.now();
    if (start.getTime() <= now) {
      setErrorMsg('Start time must be in the future (UTC)');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        resourceId: resource.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        purpose: purpose.trim(),
        ticketId: ticketId.trim() || undefined
      };

      const booking = await bookingAPI.createBooking(payload);
      if (onBookingCreated) onBookingCreated(booking);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reserve slot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-indigo-200" />
            <h3 className="font-bold text-base">Book 30-Min Resource Slot</h3>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Resource Overview */}
        <div className="bg-indigo-50/60 px-6 py-3 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900">
          <div>
            <span className="font-bold text-indigo-950 text-sm">{resource.name}</span>
            <span className="ml-2 font-mono uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
              {resource.type}
            </span>
          </div>
          <span className="text-slate-600">Capacity: <strong>{resource.capacity}</strong></span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date Picker (Up to 30 days ahead, Rule B4) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Date (Max 30 Days Ahead)
            </label>
            <input
              type="date"
              required
              min={minDateStr}
              max={maxDateStr}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Time & Duration on 30-min Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Start Time (UTC)
              </label>
              <select
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t} UTC
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Duration (30-240 Min)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {DURATIONS.map((d) => (
                  <option key={d.minutes} value={d.minutes}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Purpose (5–200 characters) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Booking Purpose (5–200 Chars)
            </label>
            <textarea
              required
              rows="3"
              minLength={5}
              maxLength={200}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Live troubleshooting session for critical checkout bug..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="text-[11px] text-slate-400 text-right">{purpose.length}/200</div>
          </div>

          {/* Optional Ticket ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Linked Ticket UUID (Optional)
            </label>
            <input
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
                <span>Checking Concurrency & Reserving...</span>
              </>
            ) : (
              <span>Confirm 30-Minute Slot Reservation</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
