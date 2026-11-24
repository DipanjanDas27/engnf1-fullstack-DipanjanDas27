import React, { useState, useEffect } from 'react';
import { X, Clock, User, ShieldAlert, CheckCircle, Tag, AlertTriangle, ArrowRight } from 'lucide-react';
import { ticketAPI } from '../api/client.js';

const CATEGORIES = ['BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TicketDetailModal({ ticketId, isOpen, onClose, onTicketUpdated }) {
  const [ticket, setTicket] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!isOpen || !ticketId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    ticketAPI
      .getTicketById(ticketId)
      .then((res) => {
        if (!isMounted) return;
        setTicket(res.ticket);
        setEvents(res.events || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err.message || 'Failed to load ticket details');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [ticketId, isOpen]);

  if (!isOpen) return null;

  const handleFieldChange = async (field, value) => {
    if (!ticket || ticket[field] === value) return;

    const previousTicket = { ...ticket };
    // Optimistic local update
    const optimisticTicket = {
      ...ticket,
      [field]: value,
      isHumanOverride: field === 'category' ? true : ticket.isHumanOverride,
      isReviewed: field === 'category' || (field === 'status' && ticket.status === 'OPEN' && value !== 'OPEN') ? true : ticket.isReviewed
    };
    setTicket(optimisticTicket);
    setUpdating(true);
    setErrorMsg(null);

    try {
      const res = await ticketAPI.updateTicket(ticket.id, { [field]: value });
      setTicket(res.ticket);
      setEvents(res.events || []);
      if (onTicketUpdated) onTicketUpdated(res.ticket);
    } catch (err) {
      // Revert on error
      setTicket(previousTicket);
      setErrorMsg(`Update failed: ${err.message}. Changes rolled back.`);
    } finally {
      setUpdating(false);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-indigo-100 text-indigo-800">
              {ticket?.externalId || 'Loading...'}
            </span>
            <h3 className="font-bold text-slate-900 text-base">Ticket Detail & Audit Trail</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-500 text-sm">Loading ticket data...</div>
          ) : ticket ? (
            <>
              {/* Subject & XSS Safe Rendering (Rule T-B5) */}
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Subject</label>
                {/* Standard React string interpolation escapes text safely against script execution */}
                <h2 className="text-lg font-bold text-slate-900 mt-1">{ticket.subject}</h2>
              </div>

              {/* Body Content */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Description</label>
                <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{ticket.body}</p>
              </div>

              {/* Triage & Override Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {/* Category Control */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Category (T-B1/T-B2)
                  </label>
                  <select
                    disabled={updating}
                    value={ticket.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    className="w-full text-sm font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex items-center space-x-1 text-[11px] text-slate-500">
                    <span>Predicted: <strong className="text-slate-700">{ticket.autoCategory}</strong></span>
                    {ticket.isHumanOverride && (
                      <span className="text-purple-700 font-semibold">• Human Overridden</span>
                    )}
                  </div>
                </div>

                {/* Priority Control */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    disabled={updating}
                    value={ticket.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
                    className="w-full text-sm font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded border ${getPriorityBadge(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>

                {/* Status Control */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status (T-B3)
                  </label>
                  <select
                    disabled={updating}
                    value={ticket.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className="w-full text-sm font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Reviewed: <strong className={ticket.isReviewed ? 'text-emerald-700' : 'text-slate-500'}>{ticket.isReviewed ? 'YES' : 'NO'}</strong>
                  </div>
                </div>
              </div>

              {/* Audit Trail (ticket_events, Rule T-B3) */}
              <div className="border-t border-slate-200 pt-5">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Immutable Audit Trail (ticket_events)</span>
                </h4>

                {events.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No field modifications recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((evt) => (
                      <div
                        key={evt.id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]">
                            {evt.field}
                          </span>
                          <span className="text-slate-500 line-through">{evt.oldValue || 'none'}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-indigo-700">{evt.newValue}</span>
                        </div>
                        <div className="text-right text-slate-400">
                          <span className="font-medium text-slate-600">{evt.actor}</span> •{' '}
                          {new Date(evt.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
