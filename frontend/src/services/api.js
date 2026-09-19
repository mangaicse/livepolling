// Centralized API Client

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In development, default to localhost:8081 or current host if served by backend
  return window.location.port === '5173' ? 'http://localhost:8081' : window.location.origin;
};

export const API_BASE = getBaseUrl();

// Retrieve or generate an anonymous unique voter fingerprint for this device/browser
export const getVoterFingerprint = () => {
  let id = localStorage.getItem('livepoll_voter_fingerprint');
  if (!id) {
    id = 'voter_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('livepoll_voter_fingerprint', id);
  }
  return id;
};

// Request helper with automatic Bearer token injection
const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('livepoll_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
};

export const api = {
  auth: {
    register: (name, email, password) =>
      request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),
    login: (email, password) =>
      request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request('/api/auth/me'),
  },
  polls: {
    create: (pollData) =>
      request('/api/polls', {
        method: 'POST',
        body: JSON.stringify(pollData),
      }),
    getMyPolls: () => request('/api/polls/my'),
    get: (idOrCode) => request(`/api/polls/${idOrCode}`),
    toggle: (pollId, isClosed) =>
      request(`/api/polls/${pollId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ is_closed: isClosed }),
      }),
    reset: (pollId) =>
      request(`/api/polls/${pollId}/reset`, {
        method: 'POST',
      }),
    delete: (pollId) =>
      request(`/api/polls/${pollId}`, {
        method: 'DELETE',
      }),
    vote: (pollId, optionIds) =>
      request(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          option_ids: optionIds,
          voter_id: getVoterFingerprint(),
        }),
      }),
  },
};
