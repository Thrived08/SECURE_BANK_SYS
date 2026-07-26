# SecureBank — Full-Stack Learning Project

A minimal but real banking app: register, log in, hold a balance, deposit
test funds, and transfer money between accounts. Built to teach the
concepts that matter in a real banking system, not just CRUD.

## Stack
- **Backend:** Node.js, Express, SQLite (via `node:sqlite`, built into Node 22+), JWT auth, `bcryptjs`
- **Frontend:** React + Vite, React Router

Both `node:sqlite` and `bcryptjs` are pure-JS / built-in — no native compiler
(Visual Studio Build Tools, Xcode command line tools, etc.) required to install.
Requires **Node.js 22 or newer**.

## Setup

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and set a real JWT_SECRET, e.g.:
# openssl rand -hex 64
npm run dev
```
Runs on http://localhost:4000

If you see `Cannot find module 'node:sqlite'`, add the flag by changing the
`dev` script in `package.json` to `node --experimental-sqlite --watch src/server.js`
(only needed on Node versions before it was unflagged).

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173

Open the frontend, register a user, then use "Add test funds" to give
yourself a balance before trying transfers. Register a second user in
another browser (or incognito window) to transfer money between two
real accounts — you'll need their 10-digit account number, shown on
their dashboard.

## What's already implemented (and why)

| Concern | How it's handled |
|---|---|
| Password storage | bcrypt hashing, never plaintext |
| Money storage | integer cents, never floats (floats lose precision) |
| Transfer race conditions | wrapped in a DB transaction — read balance, check, write, all atomic |
| Brute-force login | rate limiting + account lockout after 5 failed attempts |
| SQL injection | all queries use parameterized statements |
| XSS-ish header attacks | `helmet` sets safe HTTP headers |
| Ownership checks | every account/transaction route verifies the JWT user owns the resource |
| Input validation | `express-validator` on every route that takes user input |
| Error leakage | generic error messages to the client; full detail only in server logs |

## Where to go next (in order)

1. **Refresh tokens.** Right now access tokens expire in 15 minutes and
   there's no way to get a new one without logging in again. Add a
   refresh token stored in an httpOnly cookie.
2. **Move auth token out of localStorage.** Read the comment in
   `frontend/src/api.js` — switch to httpOnly cookies to close the XSS
   risk.
3. **2FA.** Add TOTP-based two-factor auth (e.g. `otplib`) on login.
4. **Audit log.** A banking system should log who did what, when — not
   just the transaction itself but login attempts, failed transfers, etc.
5. **Swap SQLite for Postgres.** SQLite is great for learning; a real
   deployment needs a server-based DB with proper connection pooling.
6. **Idempotency keys on transfers.** Right now, if a client retries a
   failed request, it's possible to double-submit a transfer. Real
   payment APIs (Stripe, etc.) require an idempotency key per request.
7. **Tests.** Nothing here has tests yet. Start with the transfer logic —
   it's the highest-stakes code in the app.
8. **Deployment.** Containerize with Docker, put the backend behind
   HTTPS (never run auth over plain HTTP), and use a secrets manager
   instead of a `.env` file in production.

Work through these one at a time — each one teaches a real concept used
in production fintech systems.
