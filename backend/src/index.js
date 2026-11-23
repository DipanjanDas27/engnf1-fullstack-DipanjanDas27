import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';

dotenv.config({
  path: './.env'
});

const PORT = process.env.PORT || 5000;

// Start server and verify DB connection asynchronously
const server = app.listen(PORT, async () => {
  console.log(`TriageSync Express server running on port ${PORT}`);
  if (process.env.DATABASE_URL) {
    await connectDB();
  } else {
    console.log('Notice: DATABASE_URL not yet configured in .env. Server running in offline mode.');
  }
});

export default server;
