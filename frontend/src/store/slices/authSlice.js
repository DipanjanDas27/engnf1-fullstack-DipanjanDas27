import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI, setStoredToken } from '../../api/client.js';

// Async Thunk: Verify active session (cookie or stored token)
export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const data = await authAPI.getMe();
      return data.user;
    } catch (err) {
      setStoredToken(null);
      return rejectWithValue(err.message);
    }
  }
);

// Async Thunk: Login
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const data = await authAPI.login(email, password);
      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// Async Thunk: Register
export const register = createAsyncThunk(
  'auth/register',
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      const data = await authAPI.register(name, email, password);
      // Auto-login after registration
      const loginData = await authAPI.login(email, password);
      return loginData;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// Async Thunk: Logout
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await authAPI.logout();
    return null;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    loading: true,
    actionLoading: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // checkAuth
      .addCase(checkAuth.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.user = null;
        state.loading = false;
      })
      // login
      .addCase(login.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.actionLoading = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload || 'Login failed';
      })
      // register
      .addCase(register.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.actionLoading = false;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload || 'Registration failed';
      })
      // logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.error = null;
      });
  }
});

export const { clearError } = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => Boolean(state.auth.user);
export const selectIsAdmin = (state) => state.auth.user?.role === 'ADMIN';

export default authSlice.reducer;
