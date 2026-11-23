import dotenv from 'dotenv';
import app from './app.js';

dotenv.config({
  path: './.env'
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`TriageSync Express server running on port ${PORT}`);
});

export default server;
