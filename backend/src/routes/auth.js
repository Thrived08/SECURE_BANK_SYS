import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { db, runInTransaction } from '../db/init.js';
import { generateAccountNumber } from '../utils/accountNumber.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

// ---- REGISTER ----
authRouter.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    // Basic strength rule for a learning project. Real systems should also
    // check against breached-password lists (e.g. HaveIBeenPwned's API).
    body('password')
      .isLength({ min: 10 })
      .withMessage('Password must be at least 10 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain a number'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { name, email, password } = req.body;

      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        // Generic message - don't confirm whether an email is registered
        throw new AppError('Registration failed. Please check your details.', 400);
      }

      const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
      const passwordHash = await bcrypt.hash(password, rounds);

      const userId = uuidv4();
      const accountId = uuidv4();
      const accountNumber = generateAccountNumber();

      // Wrap the multi-table write in a transaction: either both the user
      // and their account get created, or neither does.
      runInTransaction(() => {
        db.prepare(
          `INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`
        ).run(userId, name, email, passwordHash);

        db.prepare(
          `INSERT INTO accounts (id, user_id, account_number, balance_cents) VALUES (?, ?, ?, ?)`
        ).run(accountId, userId, accountNumber, 0);
      });

      const token = signToken(userId);
      res.status(201).json({
        token,
        user: { id: userId, name, email },
        account: { accountNumber, balance: 0 },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- LOGIN ----
authRouter.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      const { email, password } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

      // Always compare against SOME hash, even if user doesn't exist, so
      // response timing doesn't reveal whether the email is registered.
      const dummyHash = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO...........................';
      const hashToCompare = user ? user.password_hash : dummyHash;

      if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
        throw new AppError('Account temporarily locked. Try again later.', 423);
      }

      const valid = await bcrypt.compare(password, hashToCompare);

      if (!user || !valid) {
        if (user) {
          const attempts = user.failed_login_attempts + 1;
          const lockedUntil =
            attempts >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()
              : null;
          db.prepare(
            'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?'
          ).run(attempts, lockedUntil, user.id);
        }
        throw new AppError('Invalid email or password', 401);
      }

      // Successful login - reset failed attempt counter
      db.prepare(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?'
      ).run(user.id);

      const token = signToken(user.id);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
      next(err);
    }
  }
);
