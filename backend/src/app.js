import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/error.middleware.js';
import { ApiError } from './utils/apiError.js';

const app = express();

// Allowed origins configuration from environment or fallback
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(ApiError.forbidden('CORS origin policy blocked request'));
    },
    credentials: true
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Health check endpoint on /api/health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'TriageSync API',
    timestamp: new Date().toISOString()
  });
});

// Root ping
app.get('/', (req, res) => {
  res.status(200).send('TriageSync API is running');
});

// Catch-all 404 handler for undefined API routes adhering to Section 7 error contract
app.use((req, res, next) => {
  next(ApiError.notFound(`Endpoint ${req.method} ${req.originalUrl} not found`));
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
