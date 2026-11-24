import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { registerUser, loginUser, getMe } from '../services/auth.service.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours per Rule B16
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const user = await registerUser({ name, email, password });
  sendResponse(res, 201, { user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await loginUser({ email, password });

  // Set secure httpOnly cookie alongside returning token in JSON payload
  res.cookie('token', result.token, COOKIE_OPTIONS);

  sendResponse(res, 200, result);
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await getMe(req.user.id);
  sendResponse(res, 200, { user });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  sendResponse(res, 200, { message: 'Logged out successfully' });
});
