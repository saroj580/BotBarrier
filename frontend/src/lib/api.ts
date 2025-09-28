import axios from 'axios';
import { clearAuth, getAuth, setAuth } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const auth = getAuth();
  if (auth.accessToken) {
    config.headers = config.headers || new axios.AxiosHeaders();
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
    console.log('Sending request with Authorization header:', config.headers.Authorization); // Added log
  }
  // JS challenge header for bot middleware
  config.headers = config.headers || new axios.AxiosHeaders();
  (config.headers as any)['x-js-ok'] = '1';
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      console.log('Received 401 Unauthorized. Attempting token refresh...'); // Added log
      const auth = getAuth();
      if (!auth.refreshToken) {
        console.log('No refresh token found. Clearing auth and redirecting to login.'); // Added log
        clearAuth();
        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
      if (!refreshing) {
        refreshing = refreshAccessToken(auth.refreshToken)
          .finally(() => { refreshing = null; });
      }
      const newAccess = await refreshing;
      if (newAccess) {
        console.log('Token refreshed successfully. Retrying original request.'); // Added log
        const cfg = error.config;
        cfg.headers.Authorization = `Bearer ${newAccess}`;
        return api(cfg);
      } else {
        console.log('Token refresh failed. Clearing auth and redirecting to login.'); // Added log
        clearAuth();
        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

async function refreshAccessToken (refreshToken: string): Promise<string | null> {
  try {
    console.log('Attempting to refresh token...');
    const r = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
    const auth = getAuth();
    const next = { ...auth, accessToken: r.data.accessToken };
    setAuth(next);
    console.log('Token refresh successful');
    return r.data.accessToken as string;
  } catch (error: any) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    clearAuth();
    return null;
  }
}

export async function login (email: string, password: string) {
  const r = await axios.post(`${API_BASE}/api/auth/login`, { email, password }, { headers: { 'x-js-ok': '1' } });
  setAuth({ user: r.data.user, accessToken: r.data.accessToken, refreshToken: r.data.refreshToken });
  return r.data;
}

export async function signup (name: string, email: string, password: string, confirmPassword: string) {
  await axios.post(`${API_BASE}/api/auth/signup`, { name, email, password, confirmPassword }, { headers: { 'x-js-ok': '1' } });
  return login(email, password);
}

export async function logout () {
  const auth = getAuth();
  if (auth.refreshToken) {
    await axios.post(`${API_BASE}/api/auth/logout`, { refreshToken: auth.refreshToken });
  }
  clearAuth();
}

// Payment API functions
export async function initiatePayment (paymentData: {
  platform: string;
  ticketId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
}) {
  const r = await api.post('/payment/initiate', paymentData);
  return r.data;
}

export async function processPayment (transactionId: string, verificationData?: any) {
  const r = await api.post('/payment/process', { transactionId, verificationData });
  return r.data;
}

export async function getPaymentStatus (transactionId: string) {
  const r = await api.get(`/payment/status/${transactionId}`);
  return r.data;
}

export async function getPaymentHistory (page = 1, limit = 10, platform?: string) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (platform) params.append('platform', platform);
  const r = await api.get(`/payment/history?${params}`);
  return r.data;
}



