import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import './db/init.js';
import { authRouter } from './routes/auth.js';
import { accountsRouter } from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { errorHandler } from './middleware/errorHandler.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('replace_this')) {
  console.error('FATAL: Set a real JWT_SECRET in .env before starting the server.');
  process.exit(1);
}

const app = express();

// Sets various security-related HTTP headers (X-Frame-Options, CSP, etc.)
app.use(helmet());

// Lock CORS down to your actual frontend origin in production -
// wildcard '*' would let any website make authenticated requests on
// a logged-in user's behalf.
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' })); // small limit - a banking API has no reason to accept huge bodies

// Global rate limit - blunt protection against abuse/DoS
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Stricter limit specifically on auth endpoints - these are brute-force targets
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Secure Bank API listening on port ${PORT}`));
