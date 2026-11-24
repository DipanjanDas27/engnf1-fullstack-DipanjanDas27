/**
 * Centralized API Client for TriageSync.
 * Uses credentials: 'include' for automatic httpOnly cookie handling,
 * and attaches Authorization: Bearer <token> header as fallback.
 */

const API_BASE = '/api';

export const getStoredToken = () => {
  return localStorage.getItem('triagesync_token');
};

export const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem('triagesync_token', token);
  } else {
    localStorage.removeItem('triagesync_token');
  }
};

const request = async (endpoint, options = {}) => {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include' // Sends httpOnly cookies automatically
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.code = data?.error?.code || 'UNKNOWN_ERROR';
    error.status = response.status;
    throw error;
  }

  return data;
};

// 1. Authentication Endpoints
export const authAPI = {
  login: async (email, password) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) setStoredToken(res.token);
    return res;
  },

  register: async (name, email, password) => {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  },

  getMe: async () => {
    return request('/auth/me');
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  }
};

// 2. Ticket Endpoints
export const ticketAPI = {
  getTickets: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit || 10);
    if (params.status) query.append('status', params.status);
    if (params.category) query.append('category', params.category);
    if (params.priority) query.append('priority', params.priority);
    if (params.q) query.append('q', params.q);

    return request(`/tickets?${query.toString()}`);
  },

  getTicketById: async (id) => {
    return request(`/tickets/${id}`);
  },

  updateTicket: async (id, updates, agentHeader) => {
    const headers = {};
    if (agentHeader) headers['X-Agent'] = agentHeader;

    return request(`/tickets/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates)
    });
  },

  importTickets: async (tickets) => {
    return request('/tickets/import', {
      method: 'POST',
      body: JSON.stringify({ tickets })
    });
  },

  getStats: async () => {
    return request('/stats');
  }
};

// 3. Resource Endpoints
export const resourceAPI = {
  getResources: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.type) query.append('type', params.type);
    if (params.minCapacity) query.append('minCapacity', params.minCapacity);
    if (params.search) query.append('search', params.search);

    return request(`/resources?${query.toString()}`);
  },

  getResourceById: async (id) => {
    return request(`/resources/${id}`);
  },

  createResource: async (resourceData) => {
    return request('/resources', {
      method: 'POST',
      body: JSON.stringify(resourceData)
    });
  },

  updateResource: async (id, updateData) => {
    return request(`/resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
  },

  getAvailability: async (id, from, to) => {
    return request(`/resources/${id}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }
};

// 4. Booking Endpoints
export const bookingAPI = {
  createBooking: async (bookingData) => {
    return request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  },

  getMyBookings: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.status) query.append('status', params.status);
    return request(`/bookings/mine?${query.toString()}`);
  },

  getBookingById: async (id) => {
    return request(`/bookings/${id}`);
  },

  getAllBookings: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.status) query.append('status', params.status);
    if (params.resourceId) query.append('resourceId', params.resourceId);
    if (params.from && params.to) {
      query.append('from', params.from);
      query.append('to', params.to);
    }
    return request(`/bookings?${query.toString()}`);
  },

  cancelBooking: async (id) => {
    return request(`/bookings/${id}/cancel`, {
      method: 'PATCH'
    });
  },

  approveBooking: async (id) => {
    return request(`/bookings/${id}/approve`, {
      method: 'PATCH'
    });
  },

  rejectBooking: async (id, note) => {
    return request(`/bookings/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ note })
    });
  },

  getAdminStats: async () => {
    return request('/admin/stats');
  }
};
