import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { db, runInTransaction } from '../db/init.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

function ownsAccount(accountId, userId) {
  return db
    .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId);
}

// ---- DEPOSIT (simulated - e.g. "add test funds") ----
transactionsRouter.post(
  '/deposit',
  [
    body('accountId').isString().notEmpty(),
    // amount is in dollars from the client; we convert to integer cents here
    body('amount').isFloat({ gt: 0, max: 1000000 }),
  ],
  (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { accountId, amount } = req.body;
      if (!ownsAccount(accountId, req.userId)) {
        throw new AppError('Account not found', 404);
      }

      const amountCents = Math.round(amount * 100);
      const txId = uuidv4();

      runInTransaction(() => {
        db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
          amountCents,
          accountId
        );
        db.prepare(
          `INSERT INTO transactions (id, to_account_id, amount_cents, type, description)
           VALUES (?, ?, ?, 'deposit', ?)`
        ).run(txId, accountId, amountCents, 'Deposit');
      });

      const updated = db.prepare('SELECT balance_cents FROM accounts WHERE id = ?').get(accountId);
      res.status(201).json({ transactionId: txId, newBalance: updated.balance_cents / 100 });
    } catch (err) {
      next(err);
    }
  }
);

// ---- TRANSFER ----
transactionsRouter.post(
  '/transfer',
  [
    body('fromAccountId').isString().notEmpty(),
    body('toAccountNumber').isString().isLength({ min: 10, max: 10 }),
    body('amount').isFloat({ gt: 0, max: 1000000 }),
  ],
  (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const { fromAccountId, toAccountNumber, amount } = req.body;

      if (!ownsAccount(fromAccountId, req.userId)) {
        throw new AppError('Source account not found', 404);
      }

      const toAccount = db
        .prepare('SELECT id FROM accounts WHERE account_number = ?')
        .get(toAccountNumber);
      if (!toAccount) {
        throw new AppError('Recipient account not found', 404);
      }
      if (toAccount.id === fromAccountId) {
        throw new AppError('Cannot transfer to the same account', 400);
      }

      const amountCents = Math.round(amount * 100);
      const txId = uuidv4();

      // The whole read-check-write sequence runs inside one DB transaction
      // so two simultaneous transfers can't both pass the balance check
      // and overdraw the account (a classic race condition in banking apps).
      runInTransaction(() => {
        const source = db
          .prepare('SELECT balance_cents FROM accounts WHERE id = ?')
          .get(fromAccountId);

        if (source.balance_cents < amountCents) {
          throw new AppError('Insufficient funds', 400);
        }

        db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
          amountCents,
          fromAccountId
        );
        db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
          amountCents,
          toAccount.id
        );
        db.prepare(
          `INSERT INTO transactions (id, from_account_id, to_account_id, amount_cents, type, description)
           VALUES (?, ?, ?, ?, 'transfer', ?)`
        ).run(txId, fromAccountId, toAccount.id, amountCents, 'Transfer');
      });

      const updated = db
        .prepare('SELECT balance_cents FROM accounts WHERE id = ?')
        .get(fromAccountId);
      res.status(201).json({ transactionId: txId, newBalance: updated.balance_cents / 100 });
    } catch (err) {
      next(err);
    }
  }
);

// ---- HISTORY ----
transactionsRouter.get('/history/:accountId', (req, res, next) => {
  try {
    const { accountId } = req.params;
    if (!ownsAccount(accountId, req.userId)) {
      throw new AppError('Account not found', 404);
    }

    const rows = db
      .prepare(
        `SELECT id, from_account_id, to_account_id, amount_cents, type, description, created_at
         FROM transactions
         WHERE from_account_id = ? OR to_account_id = ?
         ORDER BY created_at DESC
         LIMIT 100`
      )
      .all(accountId, accountId);

    res.json({
      transactions: rows.map((r) => ({
        id: r.id,
        type: r.type,
        direction: r.from_account_id === accountId ? 'out' : 'in',
        amount: r.amount_cents / 100,
        description: r.description,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});
