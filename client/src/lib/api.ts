import type {
  Analysis, Alternative, Analysis as AnalysisT, DashboardData, DayLog, IntakeEntry, Meta,
  Nutrition, Product, Scan, User, Additive, AdminOverview, AdminUser, MailMessage,
} from './types';

const TOKEN_KEY = 'nutrilens.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      clearToken();
      window.dispatchEvent(new Event('nutrilens:unauthorized'));
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

const post = (path: string, body?: unknown) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
const put = (path: string, body?: unknown) => request(path, { method: 'PUT', body: JSON.stringify(body || {}) });
const patch = (path: string, body?: unknown) => request(path, { method: 'PATCH', body: JSON.stringify(body || {}) });
const del = (path: string) => request(path, { method: 'DELETE' });

export interface ProductPayload {
  name: string;
  brand: string;
  category: string;
  servingG: number;
  servingLabel?: string;
  nutrition: Nutrition;
  ingredients: string;
  additives?: string[];
  nova: number;
  emoji?: string;
  notes?: string;
}

export interface AnalyzePayload {
  productName: string;
  brand?: string;
  category: string;
  portionG: number;
  servingG: number;
  nutrition: Nutrition;
  ingredients: string;
  additives?: string[];
  nova: number;
}

export const api = {
  auth: {
    login: (email: string, password: string) => post('/auth/login', { email, password }) as Promise<{ token: string; user: User }>,
    register: (body: Record<string, unknown>) =>
      post('/auth/register', body) as Promise<{ token: string; user: User; verification?: { sent: boolean } }>,
    me: () => request('/auth/me') as Promise<{ user: User }>,
    update: (body: Partial<User>) => put('/auth/me', body) as Promise<{ user: User }>,
    password: (currentPassword: string, newPassword: string) => post('/auth/password', { currentPassword, newPassword }),

    // --- email verification & password reset ---------------------------------
    verifyEmail: (token: string) =>
      post('/auth/verify-email', { token }) as Promise<{ ok: boolean; user: User; message: string }>,
    resendVerification: () => post('/auth/resend-verification') as Promise<{ ok: boolean; message: string }>,
    forgotPassword: (email: string) => post('/auth/forgot-password', { email }) as Promise<{ ok: boolean; message: string }>,
    resetPassword: (token: string, password: string) =>
      post('/auth/reset-password', { token, password }) as Promise<{ token: string; user: User; message: string }>,

    // --- dev mailbox (no SMTP in this build) ---------------------------------
    mailbox: () => request('/auth/dev-mailbox') as Promise<{ enabled: boolean; messages: MailMessage[]; transport: string }>,
    clearMailbox: () => del('/auth/dev-mailbox') as Promise<{ ok: boolean }>,

    // --- OAuth ---------------------------------------------------------------
    oauthProviders: () =>
      request('/auth/oauth/providers') as Promise<{
        providers: { key: string; label: string; configured: boolean; demo: boolean }[];
        note: string;
      }>,
    oauthDemo: (provider: string) =>
      post('/auth/oauth/demo', { provider }) as Promise<{ token: string; user: User; created: boolean; demo: boolean; message: string }>,
    oauthStartUrl: (provider: string) => `/api/auth/oauth/${provider}`,
  },

  admin: {
    overview: () => request('/admin/overview') as Promise<AdminOverview>,
    users: (q = '') => request(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`) as Promise<{ items: AdminUser[] }>,
    updateUser: (id: number, body: { role?: string; emailVerified?: boolean; name?: string }) =>
      patch(`/admin/users/${id}`, body) as Promise<{ item: AdminUser; message: string }>,
    removeUser: (id: number) => del(`/admin/users/${id}`) as Promise<{ ok: boolean; id: number }>,
  },
  meta: () => request('/meta') as Promise<Meta>,
  dashboard: (date: string) => request(`/dashboard?date=${date}`) as Promise<DashboardData>,
  products: {
    list: (params: { q?: string; category?: string; sort?: string } = {}) => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
      return request(`/products${qs ? `?${qs}` : ''}`) as Promise<{ items: Product[] }>;
    },
    get: (id: number) => request(`/products/${id}`) as Promise<{ item: Product }>,
    create: (body: ProductPayload) => post('/products', body) as Promise<{ item: Product }>,
    update: (id: number, body: ProductPayload) => put(`/products/${id}`, body) as Promise<{ item: Product }>,
    remove: (id: number) => del(`/products/${id}`) as Promise<{ ok: boolean; id: number }>,
  },
  catalogue: {
    list: (q = '') => request(`/catalogue?q=${encodeURIComponent(q)}`) as Promise<{ items: Product[] }>,
    import: (id: number) => post(`/catalogue/${id}/import`) as Promise<{ item: Product }>,
  },
  scans: {
    analyze: (body: AnalyzePayload) => post('/scans/analyze', body) as Promise<{ analysis: Analysis; alternatives: Alternative[] }>,
    list: (q = '') => request(`/scans${q ? `?q=${encodeURIComponent(q)}` : ''}`) as Promise<{ items: Scan[] }>,
    get: (id: number) => request(`/scans/${id}`) as Promise<{ item: Scan; alternatives: Alternative[] }>,
    create: (body: AnalyzePayload & { notes?: string }) => post('/scans', body) as Promise<{ item: Scan; alternatives: Alternative[] }>,
    update: (id: number, body: { notes?: string; portionG?: number }) => patch(`/scans/${id}`, body) as Promise<{ item: Scan }>,
    remove: (id: number) => del(`/scans/${id}`) as Promise<{ ok: boolean; id: number }>,
    fromProduct: (productId: number, portionG?: number) => post(`/scans/from-product/${productId}`, { portionG }) as Promise<{ item: Scan }>,
  },
  logs: {
    day: (date: string) => request(`/logs?date=${date}`) as Promise<DayLog>,
    week: (end: string) => request(`/logs/week?end=${end}`) as Promise<{ days: any[]; limits: Record<string, number> }>,
    create: (body: Record<string, unknown>) => post('/logs', body) as Promise<{ item: IntakeEntry }>,
    update: (id: number, body: Record<string, unknown>) => patch(`/logs/${id}`, body) as Promise<{ item: IntakeEntry }>,
    remove: (id: number) => del(`/logs/${id}`) as Promise<{ ok: boolean; id: number }>,
  },
  library: {
    additives: (q = '') => request(`/additives?q=${encodeURIComponent(q)}`) as Promise<{ items: Additive[]; total: number }>,
    alternatives: (category = '') => request(`/alternatives?category=${encodeURIComponent(category)}`) as Promise<{ items: Alternative[] }>,
    parseLabel: (text: string) =>
      post('/parse-label', { text }) as Promise<{
        nutrition: Partial<Nutrition>;
        ingredients: string;
        servingG: number | null;
        nova: number;
        confidence: 'high' | 'medium' | 'low';
        note: string | null;
        additives: string[];
        detectedFields: string[];
      }>,
  },
};

export type { AnalysisT };
