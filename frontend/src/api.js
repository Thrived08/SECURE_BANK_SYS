const API_BASE = 'http://localhost:4000/api';

// NOTE on security: we store the JWT in localStorage here because it's the
// simplest thing to learn with. The tradeoff: localStorage is readable by
// any JS running on your page, so if your app ever has an XSS bug, the
// attacker can steal the token. Production banking apps typically use
// httpOnly cookies instead, which JS can't read at all. Once you're
// comfortable with this version, try converting auth to httpOnly cookies
// as a follow-up exercise.
export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  myAccounts: () => request('/accounts/me'),
  deposit: (body) => request('/transactions/deposit', { method: 'POST', body: JSON.stringify(body) }),
  transfer: (body) => request('/transactions/transfer', { method: 'POST', body: JSON.stringify(body) }),
  history: (accountId) => request(`/transactions/history/${accountId}`),
};
