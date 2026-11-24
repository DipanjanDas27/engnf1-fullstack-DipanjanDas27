import axios from 'axios';

/**
 * Axios Base Instance for TriageSync API.
 * Configured with environment-aware baseURL (VITE_API_URL or '/api')
 * and withCredentials: true for automatic httpOnly cookie handling.
 */
const baseURL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

// Request Interceptor: Attach fallback Authorization Bearer header
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Extract Section 7 API contract errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorData = error.response?.data?.error;
    const message = errorData?.message || error.message || 'Request failed';
    const customError = new Error(message);
    customError.code = errorData?.code || 'UNKNOWN_ERROR';
    customError.status = error.response?.status || 500;
    return Promise.reject(customError);
  }
);

// 1. Auth Endpoints
export const authAPI = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.token) setStoredToken(res.token);
    return res;
  },

  register: async (name, email, password) => {
    return api.post('/auth/register', { name, email, password });
  },

  getMe: async () => {
    return api.get('/auth/me');
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setStoredToken(null);
    }
  }
};

// 2. Ticket Endpoints
export const ticketAPI = {
  getTickets: async (params = {}) => {
    return api.get('/tickets', { params });
  },

  getTicketById: async (id) => {
    return api.get(`/tickets/${id}`);
  },

  updateTicket: async (id, updates, agentHeader) => {
    const headers = {};
    if (agentHeader) headers['X-Agent'] = agentHeader;
    return api.patch(`/tickets/${id}`, updates, { headers });
  },

  importTickets: async (tickets) => {
    return api.post('/tickets/import', { tickets });
  },

  getStats: async () => {
    return api.get('/stats');
  }
};

// 3. Resource Endpoints
export const resourceAPI = {
  getResources: async (params = {}) => {
    return api.get('/resources', { params });
  },

  getResourceById: async (id) => {
    return api.get(`/resources/${id}`);
  },

  createResource: async (resourceData) => {
    return api.post('/resources', resourceData);
  },

  updateResource: async (id, updateData) => {
    return api.patch(`/resources/${id}`, updateData);
  },

  getAvailability: async (id, from, to) => {
    return api.get(`/resources/${id}/availability`, { params: { from, to } });
  }
};

// 4. Booking Endpoints
export const bookingAPI = {
  createBooking: async (bookingData) => {
    return api.post('/bookings', bookingData);
  },

  getMyBookings: async (params = {}) => {
    return api.get('/bookings/mine', { params });
  },

  getBookingById: async (id) => {
    return api.get(`/bookings/${id}`);
  },

  getAllBookings: async (params = {}) => {
    return api.get('/bookings', { params });
  },

  cancelBooking: async (id) => {
    return api.patch(`/bookings/${id}/cancel`);
  },

  approveBooking: async (id) => {
    return api.patch(`/bookings/${id}/approve`);
  },

  rejectBooking: async (id, note) => {
    return api.patch(`/bookings/${id}/reject`, { note });
  },

  getAdminStats: async () => {
    return api.get('/admin/stats');
  }
};

export default api;
