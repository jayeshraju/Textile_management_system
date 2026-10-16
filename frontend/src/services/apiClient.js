/**
 * Base HTTP Client for LoomIQ API.
 * Dynamically resolves API URL matching host environment for cross-device & mobile QR access.
 * Always sends credentials (HttpOnly cookies) with every request.
 */
const getBaseUrl = () => {
  // If explicitly configured with an absolute custom URL, respect it
  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }

  // When running in the browser (on online public tunnel, LAN, or local dev)
  // Relative requests routed via Vite proxy or reverse proxy ensure zero CORS / port issues
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }

  // Fallback for node scripts / testing
  return 'http://127.0.0.1:5000';
};

export const request = async (endpoint, options = {}) => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutMs = options.timeout || 60000; // 60s default timeout for free-tier cold starts
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      credentials: 'include', // Include HttpOnly session cookies
      ...options,
      headers,
      signal: options.signal || controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // Mid-session 401 dispatch
      if (response.status === 401 && typeof window !== 'undefined') {
        const isAuthRoute = window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/accept-invite') ||
          window.location.pathname.startsWith('/signup');
        if (!isAuthRoute) {
          window.dispatchEvent(new CustomEvent('loomiq:session-expired', { detail: { path: window.location.pathname } }));
        }
      }

      const errorMessage = data?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      const errorCode = data?.error?.code || 'REQUEST_FAILED';
      const error = new Error(errorMessage);
      error.code = errorCode;
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. The backend may be waking up from sleep. Please retry.`);
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }
    if (!err.status) {
      // Network failure / connection refused / CORS blocked
      const networkError = new Error(err.message || 'Unable to connect to backend service. Please check server status.');
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
    throw err;
  }
};

export const apiClient = {
  request,
  get: (endpoint, options = {}) => {
    const qs = options.params ? `?${new URLSearchParams(options.params).toString()}` : '';
    const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    return request(`${cleanEndpoint}${qs}`, { method: 'GET', ...options });
  },
  post: (endpoint, body, options = {}) => {
    const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    return request(cleanEndpoint, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    });
  },
  patch: (endpoint, body, options = {}) => {
    const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    return request(cleanEndpoint, {
      method: 'PATCH',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    });
  },
  delete: (endpoint, options = {}) => {
    const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    return request(cleanEndpoint, { method: 'DELETE', ...options });
  },
};

export default apiClient;
