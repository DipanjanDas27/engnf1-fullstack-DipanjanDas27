import { findUserByEmail, findUserById, createUser } from '../repositories/user.repository.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { generateToken } from '../utils/token.js';
import { ApiError } from '../utils/apiError.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,64}$/;

/**
 * Registers a new user account.
 * Returns the created user (without passwordHash).
 */
export const registerUser = async ({ name, email, password }) => {
  if (!name || name.trim().length < 2 || name.trim().length > 50) {
    throw ApiError.validationError('Name must be between 2 and 50 characters');
  }
  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    throw ApiError.validationError('A valid email address of 254 characters or fewer is required');
  }
  if (!password || !PASSWORD_REGEX.test(password)) {
    throw ApiError.validationError('Password must be 8 to 64 characters and contain at least one letter and one number');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw ApiError.conflict('An account with this email address already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ name: name.trim(), email: normalizedEmail, passwordHash, role: 'USER' });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
};

/**
 * Authenticates a user and returns a signed JWT token.
 */
export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw ApiError.validationError('Email and password are required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw ApiError.unauthenticated('Invalid email or password');
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw ApiError.unauthenticated('Invalid email or password');
  }

  const token = generateToken({ id: user.id });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  };
};

/**
 * Returns the authenticated user's profile by ID (from token claims).
 */
export const getMe = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw ApiError.unauthenticated('User session not found or account deactivated');
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
};
