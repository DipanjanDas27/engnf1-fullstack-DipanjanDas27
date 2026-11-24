import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { registerUser, loginUser, getMe } from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const user = await registerUser({ name, email, password });
  sendResponse(res, 201, { user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await loginUser({ email, password });
  sendResponse(res, 200, result);
});

export const getProfile = asyncHandler(async (req, res) => {
  const user = await getMe(req.user.id);
  sendResponse(res, 200, { user });
});
