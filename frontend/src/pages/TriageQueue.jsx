import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  Eye
} from 'lucide-react';
import { ticketAPI } from '../api/client.js';
import TicketDetailModal from '../components/TicketDetailModal.jsx';

const CATEGORIES = ['ALL', 'BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY'];
const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TriageQueue() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [reimporting, setReimporting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Optimistic UI Rollback & Feedback Banner
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }

  // Selected ticket for modal
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const fetchStats = async () => {
    try {
      const data = await ticketAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err.message);
    }
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const res = await ticketAPI.getTickets(params);
      setTickets(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setAlert({ type: 'error', message: `Failed to load tickets: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [fetchTickets]);

  // Instant Optimistic UI Update with Error Rollback
  const handleOptimisticUpdate = async (ticketId, field, newValue) => {
    // 1. Snapshot previous state
    const previousTickets = [...tickets];
    const targetTicket = tickets.find((t) => t.id === ticketId);
    if (!targetTicket || targetTicket[field] === newValue) return;

    // 2. Apply immediate optimistic change
    const updatedTickets = tickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          [field]: newValue,
          isHumanOverride: field === 'category' ? true : t.isHumanOverride,
          isReviewed: field === 'category' || (field === 'status' && t.status === 'OPEN' && newValue !== 'OPEN') ? true : t.isReviewed
        };
      }
      return t;
    });
    setTickets(updatedTickets);

    // 3. Dispatch to backend
    try {
      await ticketAPI.updateTicket(ticketId, { [field]: newValue });
      setAlert({
        type: 'success',
        message: `Ticket ${targetTicket.externalId} updated to ${newValue}.`
      });
      fetchStats();
    } catch (err) {
      // 4. Rollback on failure and show visible alert
      setTickets(previousTickets);
      setAlert({
        type: 'error',
        message: `Optimistic update failed: ${err.message}. Changes rolled back immediately.`
      });
    }
  };

  // Re-Import Feed Demo Handler (T-B1 / T-B2)
  const handleReimportFeed = async () => {
    setReimporting(true);
    try {
      const sampleFeed = [
        { externalId: 'EXT-1001', subject: 'Overcharge on corporate invoice (Re-import)', body: 'Updated charge verification refund request.' },
        { externalId: 'EXT-3001', subject: 'My package has not arrived (Re-import)', body: 'Still waiting on logistics tracking.' },
        { externalId: `NEW-FEED-${Date.now().toString().slice(-4)}`, subject: 'Urgent 500 error exception in portal', body: 'Production broken server crash exception 500.' }
      ];

      const res = await ticketAPI.importTickets(sampleFeed);
      setAlert({
        type: 'success',
        message: `Feed Ingested: ${res.importedCount} new, ${res.updatedCount} updated, ${res.skippedOverrideCount} human-override preserved.`
      });
      fetchTickets();
      fetchStats();
    } catch (err) {
      setAlert({ type: 'error', message: `Import failed: ${err.message}` });
    } finally {
      setReimporting(false);
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-50 text-red-700 border-red-200 font-bold';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top Stats Strip (Section 6.5) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Tickets</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Reviewed</span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats?.reviewedCount ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center space-x-1">
            <span>Model Agreement</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {stats ? `${stats.modelAgreementRate}%` : '0%'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Open</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats?.byStatus?.OPEN ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">In Progress</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats?.byStatus?.IN_PROGRESS ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Resolved</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.byStatus?.RESOLVED ?? 0}</p>
        </div>
      </div>

      {/* Alert Banner for Optimistic Rollback Feedback */}
      {alert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm transition-all shadow-xs ${
            alert.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {alert.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span className="font-medium">{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Dynamic Filter Bar & Action Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box (Rule T-B4 Safe Parameterized Search) */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search subject or body safely (e.g. refund, package, crash)..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Action: Re-Import Feed Button */}
          <button
            onClick={handleReimportFeed}
            disabled={reimporting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{reimporting ? 'Importing Feed...' : 'Re-Import Ticket Feed'}</span>
          </button>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-3 border border-slate-300 rounded-lg bg-white outline-none font-medium text-slate-700"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 uppercase mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-3 border border-slate-300 rounded-lg bg-white outline-none font-medium text-slate-700"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-600 uppercase mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-1.5 px-3 border border-slate-300 rounded-lg bg-white outline-none font-medium text-slate-700"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Ticket Table with Instant Optimistic UI */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Ticket</th>
                <th className="py-3.5 px-4">Category (Optimistic)</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status (Optimistic)</th>
                <th className="py-3.5 px-4">Override</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    Loading triage queue...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No tickets match the active filters.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Ticket Subject & Safe Escaping (Rule T-B5) */}
                    <td className="py-4 px-4 max-w-xs">
                      <div className="font-mono text-xs font-bold text-indigo-700">{t.externalId}</div>
                      <div className="font-medium text-slate-900 truncate" title={t.subject}>
                        {t.subject}
                      </div>
                      <div className="text-xs text-slate-500 truncate" title={t.body}>
                        {t.body}
                      </div>
                    </td>

                    {/* Category Dropdown with Instant Optimistic UI */}
                    <td className="py-4 px-4">
                      <select
                        value={t.category}
                        onChange={(e) => handleOptimisticUpdate(t.id, 'category', e.target.value)}
                        className="text-xs font-semibold py-1 px-2 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none hover:border-indigo-500 cursor-pointer"
                      >
                        {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-slate-400 mt-0.5">Auto: {t.autoCategory}</div>
                    </td>

                    {/* Priority Badge */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className={`inline-block text-xs px-2.5 py-1 rounded-full border ${getPriorityStyle(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>

                    {/* Status Dropdown with Instant Optimistic UI */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <select
                        value={t.status}
                        onChange={(e) => handleOptimisticUpdate(t.id, 'status', e.target.value)}
                        className="text-xs font-semibold py-1 px-2 border border-slate-300 rounded-lg bg-white text-slate-800 outline-none hover:border-indigo-500 cursor-pointer"
                      >
                        {STATUSES.filter((s) => s !== 'ALL').map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Override & Reviewed Indicators */}
                    <td className="py-4 px-4 whitespace-nowrap text-xs">
                      {t.isHumanOverride ? (
                        <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          Overridden
                        </span>
                      ) : (
                        <span className="text-slate-400">Auto</span>
                      )}
                      {t.isReviewed && (
                        <span className="ml-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                          Reviewed
                        </span>
                      )}
                    </td>

                    {/* Action: Open Detail Modal */}
                    <td className="py-4 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedTicketId(t.id)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="View audit history & details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total tickets)
          </span>
          <div className="flex space-x-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticketId={selectedTicketId}
        isOpen={Boolean(selectedTicketId)}
        onClose={() => setSelectedTicketId(null)}
        onTicketUpdated={() => {
          fetchTickets();
          fetchStats();
        }}
      />
    </div>
  );
}
