import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed authorization header' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub; // 'sub' (subject) is the JWT-standard claim for user id
    next();
  } catch (err) {
    // Don't leak whether it's expired vs invalid vs tampered - just reject
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
