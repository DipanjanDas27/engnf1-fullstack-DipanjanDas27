import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Calendar,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { resourceAPI, bookingAPI } from '../api/client.js';
import { selectIsAuthenticated } from '../store/slices/authSlice.js';
import BookingModal from '../components/BookingModal.jsx';

const RESOURCE_TYPES = ['ALL', 'ROOM', 'LAB', 'EQUIPMENT'];
const BOOKING_STATUSES = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

// 30-minute day slots from 08:00 to 20:00
const DAY_SLOTS = [];
for (let h = 8; h <= 19; h++) {
  const hh = String(h).padStart(2, '0');
  DAY_SLOTS.push(`${hh}:00`);
  DAY_SLOTS.push(`${hh}:30`);
}

export default function Resources() {
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [activeSubTab, setActiveSubTab] = useState('resources'); // 'resources' | 'mine'
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Selected Resource & Availability Grid
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [bookedSlots, setBookedSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Booking Modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingForResource, setBookingForResource] = useState(null);

  // My Bookings
  const [myBookings, setMyBookings] = useState([]);
  const [myBookingsLoading, setMyBookingsLoading] = useState(false);
  const [myBookingStatus, setMyBookingStatus] = useState('ALL');

  // Feedback Notification
  const [alert, setAlert] = useState(null);

  // Fetch Resources
  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (search.trim()) params.search = search.trim();
      const res = await resourceAPI.getResources(params);
      const data = res.data || [];
      setResources(data);
      if (data.length > 0 && !selectedResource) {
        setSelectedResource(data[0]);
      }
    } catch (err) {
      setAlert({ type: 'error', message: `Failed to load resources: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search, selectedResource]);

  // Fetch Availability for Selected Resource & Date
  const fetchAvailability = useCallback(async () => {
    if (!selectedResource) return;
    setAvailabilityLoading(true);
    try {
      const from = `${selectedDate}T00:00:00.000Z`;
      const to = `${selectedDate}T23:59:59.000Z`;
      const res = await resourceAPI.getAvailability(selectedResource.id, from, to);
      setBookedSlots(res.bookings || []);
    } catch (err) {
      console.error('Failed to load availability:', err.message);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [selectedResource, selectedDate]);

  // Fetch My Bookings
  const fetchMyBookings = useCallback(async () => {
    if (!isAuthenticated) return;
    setMyBookingsLoading(true);
    try {
      const params = {};
      if (myBookingStatus !== 'ALL') params.status = myBookingStatus;
      const res = await bookingAPI.getMyBookings(params);
      setMyBookings(res.data || []);
    } catch (err) {
      console.error('Failed to load my bookings:', err.message);
    } finally {
      setMyBookingsLoading(false);
    }
  }, [isAuthenticated, myBookingStatus]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    if (selectedResource) {
      fetchAvailability();
    }
  }, [selectedResource, fetchAvailability]);

  useEffect(() => {
    if (activeSubTab === 'mine') {
      fetchMyBookings();
    }
  }, [activeSubTab, fetchMyBookings]);

  // Cancel Booking Handler (Owner only)
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await bookingAPI.cancelBooking(bookingId);
      setAlert({ type: 'success', message: 'Booking successfully cancelled.' });
      fetchMyBookings();
      fetchAvailability();
    } catch (err) {
      setAlert({ type: 'error', message: `Cancellation failed: ${err.message}` });
    }
  };

  // Check if a 30-min slot is booked on selected date
  const isSlotBooked = (slotTimeStr) => {
    const slotStartIso = `${selectedDate}T${slotTimeStr}:00.000Z`;
    const slotStart = new Date(slotStartIso).getTime();
    const slotEnd = slotStart + 30 * 60 * 1000;

    return bookedSlots.some((b) => {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      return slotStart < bEnd && slotEnd > bStart;
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs: Browse Resources vs My Bookings */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveSubTab('resources')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'resources'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Browse Resources & Availability
          </button>

          {isAuthenticated && (
            <button
              onClick={() => setActiveSubTab('mine')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'mine'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              My Bookings
            </button>
          )}
        </div>

        {selectedResource && isAuthenticated && (
          <button
            onClick={() => {
              setBookingForResource(selectedResource);
              setIsBookingModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book 30-Min Slot</span>
          </button>
        )}
      </div>

      {/* Alert Banner */}
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

      {/* SUB-VIEW 1: Browse Resources & 30-Min Availability Grid */}
      {activeSubTab === 'resources' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Resource Filter & Directory */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search resources..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex space-x-1 overflow-x-auto pb-1 text-xs">
                {RESOURCE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      typeFilter === t
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Resource Cards List */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading resources...</div>
              ) : resources.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No resources found.</div>
              ) : (
                resources.map((r) => {
                  const isSelected = selectedResource?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedResource(r)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/60 border-indigo-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900">{r.name}</h4>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {r.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.description || 'No description provided.'}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>Capacity: <strong className="text-slate-700">{r.capacity}</strong></span>
                        <span className={r.isActive ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                          {r.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: 30-Minute Availability Grid (Section 6.5) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            {selectedResource ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedResource.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      30-Minute Real-Time Slot Grid (Local Times displayed, verified against UTC grid)
                    </p>
                  </div>

                  {/* Date Selector for Grid (Max 7-day range per Endpoint 13) */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-600 uppercase">View Date:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* 30-Minute Slot Matrix */}
                {availabilityLoading ? (
                  <div className="py-20 text-center text-slate-400 text-sm">Loading slot availability...</div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-semibold text-slate-700 uppercase tracking-wider">
                        Available Slots for {selectedDate}
                      </span>
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                          <span className="text-slate-600">Available</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                          <span className="text-slate-600">Booked (PENDING/APPROVED)</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {DAY_SLOTS.map((timeStr) => {
                        const booked = isSlotBooked(timeStr);
                        return (
                          <div
                            key={timeStr}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              booked
                                ? 'bg-red-50 border-red-200 text-red-800 opacity-80'
                                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:border-emerald-400'
                            }`}
                          >
                            <div className="text-xs font-bold font-mono">{timeStr}</div>
                            <div className="text-[10px] mt-1 font-semibold uppercase">
                              {booked ? 'Occupied' : 'Open'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 text-center text-slate-400 text-sm">
                Select a resource from the directory to view 30-minute slot availability.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: My Bookings with Cancel Confirmation */}
      {activeSubTab === 'mine' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Status Filter */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">Your Reserved Resource Slots</h3>
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-semibold text-slate-600 uppercase">Status:</span>
              <select
                value={myBookingStatus}
                onChange={(e) => setMyBookingStatus(e.target.value)}
                className="py-1 px-3 border border-slate-300 rounded-lg bg-white outline-none font-medium"
              >
                {BOOKING_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Start (Local)</th>
                  <th className="py-3 px-4">End (Local)</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {myBookingsLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      Loading your bookings...
                    </td>
                  </tr>
                ) : myBookings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      You have no bookings matching this status.
                    </td>
                  </tr>
                ) : (
                  myBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{b.resourceName}</td>
                      <td className="py-3.5 px-4 font-mono text-xs">{new Date(b.startTime).toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-mono text-xs">{new Date(b.endTime).toLocaleString()}</td>
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
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {['PENDING', 'APPROVED'].includes(b.status) && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Cancel booking"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Booking Modal */}
      <BookingModal
        resource={bookingForResource}
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setBookingForResource(null);
        }}
        onBookingCreated={() => {
          setAlert({ type: 'success', message: 'Slot reserved successfully in PENDING status.' });
          fetchAvailability();
          if (activeSubTab === 'mine') fetchMyBookings();
        }}
      />
    </div>
  );
}
