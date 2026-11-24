import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle,
  XCircle,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Award,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { bookingAPI, resourceAPI } from '../api/client.js';
import CreateResourceModal from '../components/CreateResourceModal.jsx';
import RejectBookingModal from '../components/RejectBookingModal.jsx';

export default function AdminDashboard() {
  const [adminStats, setAdminStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Tab: 'bookings' | 'resources'
  const [subTab, setSubTab] = useState('bookings');

  // Bookings Governance
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');
  const [rejectingBooking, setRejectingBooking] = useState(null);

  // Resources Management
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);

  // Feedback Notification Banner
  const [alert, setAlert] = useState(null);

  const fetchAdminStats = async () => {
    setStatsLoading(true);
    try {
      const data = await bookingAPI.getAdminStats();
      setAdminStats(data);
    } catch (err) {
      console.error('Failed to load admin stats:', err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const params = {};
      if (bookingStatusFilter !== 'ALL') params.status = bookingStatusFilter;
      const res = await bookingAPI.getAllBookings(params);
      setBookings(res.data || []);
    } catch (err) {
      console.error('Failed to load all bookings:', err.message);
    } finally {
      setBookingsLoading(false);
    }
  }, [bookingStatusFilter]);

  const fetchResources = useCallback(async () => {
    setResourcesLoading(true);
    try {
      const res = await resourceAPI.getResources();
      setResources(res.data || []);
    } catch (err) {
      console.error('Failed to load resources:', err.message);
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  useEffect(() => {
    if (subTab === 'bookings') {
      fetchBookings();
    } else {
      fetchResources();
    }
  }, [subTab, fetchBookings, fetchResources]);

  // 1-Click Approve Handler (Rule B10)
  const handleApprove = async (bookingId) => {
    try {
      await bookingAPI.approveBooking(bookingId);
      setAlert({ type: 'success', message: 'Booking approved successfully.' });
      fetchBookings();
      fetchAdminStats();
    } catch (err) {
      setAlert({ type: 'error', message: `Approval failed: ${err.message}` });
    }
  };

  // Toggle Resource Active / Inactive (Admin only)
  const handleToggleResource = async (resource) => {
    try {
      await resourceAPI.updateResource(resource.id, { isActive: !resource.isActive });
      setAlert({
        type: 'success',
        message: `Resource "${resource.name}" set to ${!resource.isActive ? 'ACTIVE' : 'INACTIVE'}.`
      });
      fetchResources();
      fetchAdminStats();
    } catch (err) {
      setAlert({ type: 'error', message: `Update failed: ${err.message}` });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Admin Analytics Stats Overview (Section 6.5 & Endpoint 21) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Active Assets</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{adminStats?.activeResources ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Pending Bookings</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{adminStats?.bookingsByStatus?.PENDING ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Approved Bookings</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{adminStats?.bookingsByStatus?.APPROVED ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Rejected Bookings</span>
          <p className="text-2xl font-bold text-red-600 mt-1">{adminStats?.bookingsByStatus?.REJECTED ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Cancelled Bookings</span>
          <p className="text-2xl font-bold text-slate-600 mt-1">{adminStats?.bookingsByStatus?.CANCELLED ?? 0}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center space-x-1">
            <span>Model Agreement</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
          </span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {adminStats?.ticketStats?.modelAgreementRate ?? 0}%
          </p>
        </div>
      </div>

      {/* Top Resources Leaderboard Strip */}
      {adminStats?.topResources?.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Top 3 Most Booked Resources</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {adminStats.topResources.map((top, idx) => (
              <div key={top.id} className="bg-white/10 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-100">#{idx + 1} {top.name}</span>
                  <div className="text-[10px] text-indigo-200 uppercase mt-0.5">{top.type}</div>
                </div>
                <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {top.bookingCount} bookings
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {alert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-xs ${
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

      {/* 2. Sub Tabs: Booking Approvals vs Resource Management */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setSubTab('bookings')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'bookings'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Booking Approvals & Governance
          </button>

          <button
            onClick={() => setSubTab('resources')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'resources'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Resource Inventory Management
          </button>
        </div>

        {subTab === 'resources' && (
          <button
            onClick={() => setIsCreateResourceOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Resource</span>
          </button>
        )}
      </div>

      {/* SUB-VIEW 1: Booking Approvals & Governance (ADMIN Only) */}
      {subTab === 'bookings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Status Filter */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">All Submitted Booking Requests</h3>
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-600 uppercase">Status:</span>
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                className="py-1 px-3 border border-slate-300 rounded-lg bg-white outline-none font-medium"
              >
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Slot Time (Local)</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {bookingsLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      Loading bookings...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{b.userName || b.userEmail}</td>
                      <td className="py-3.5 px-4 font-bold text-indigo-700">{b.resourceName}</td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {new Date(b.startTime).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-xs truncate">{b.purpose}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            b.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : b.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.status}
                        </span>
                        {b.decisionNote && (
                          <div className="text-[10px] text-red-600 italic mt-0.5">Note: {b.decisionNote}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        {b.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(b.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingBooking(b)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              Reject...
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: Resource Inventory & Toggle (ADMIN Only) */}
      {subTab === 'resources' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-sm text-slate-800">Resource Inventory (Active & Inactive)</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Resource Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Toggle Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {resourcesLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      Loading inventory...
                    </td>
                  </tr>
                ) : (
                  resources.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{r.name}</td>
                      <td className="py-3.5 px-4 font-mono text-xs uppercase">{r.type}</td>
                      <td className="py-3.5 px-4 text-xs">{r.capacity}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-sm truncate">
                        {r.description || 'None'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            r.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleToggleResource(r)}
                          className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-colors cursor-pointer ${
                            r.isActive
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {r.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateResourceModal
        isOpen={isCreateResourceOpen}
        onClose={() => setIsCreateResourceOpen(false)}
        onResourceCreated={() => {
          setAlert({ type: 'success', message: 'Resource created successfully.' });
          fetchResources();
          fetchAdminStats();
        }}
      />

      <RejectBookingModal
        booking={rejectingBooking}
        isOpen={Boolean(rejectingBooking)}
        onClose={() => setRejectingBooking(null)}
        onBookingRejected={() => {
          setAlert({ type: 'success', message: 'Booking rejected with provided note.' });
          fetchBookings();
          fetchAdminStats();
        }}
      />
    </div>
  );
}
