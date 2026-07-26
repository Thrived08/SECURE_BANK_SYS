// Centralized error handler. Keeps internal error details (stack traces,
// SQL errors) out of API responses - leaking those helps attackers.
export function errorHandler(err, req, res, next) {
  console.error(err); // full detail goes to server logs only

  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({ error: message });
}

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
