const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const jobsRouter = require('./routes/jobs');
const authRouter = require('./routes/auth');
const { getDatabase } = require('./models/database');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'scrapegoat-secret-key-change-in-production',
  resave: true, // Set to true to help with session persistence
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true for HTTPS
    httpOnly: true,
    maxAge: 180 * 24 * 60 * 60 * 1000, // 180 days (15552000000 ms)
    sameSite: 'lax' // Works with reverse proxy - don't set domain, let it default to exact domain
  },
  name: 'scrapegoat.sid' // Custom session name
}));

// Trust proxy (important for reverse proxy setups)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth routes (public)
app.use('/api/auth', authRouter);

// Jobs API routes (create requires auth, but viewing status is public for shareable links)
app.use('/api/jobs', jobsRouter);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Health check (public, no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database
getDatabase();

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});

