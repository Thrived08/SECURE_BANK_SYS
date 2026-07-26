import { Router } from 'express';
import { db } from '../db/init.js';
import { requireAuth } from '../middleware/auth.js';

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

// Only ever return accounts belonging to req.userId (from the verified JWT).
// Never trust an account id passed in the URL/body without checking ownership.
accountsRouter.get('/me', (req, res) => {
  const accounts = db
    .prepare('SELECT id, account_number, balance_cents, currency, created_at FROM accounts WHERE user_id = ?')
    .all(req.userId);

  res.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      accountNumber: a.account_number,
      balance: a.balance_cents / 100,
      currency: a.currency,
      createdAt: a.created_at,
    })),
  });
});
