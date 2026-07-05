import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const accessToken = Cookies.get('accessToken');

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  // Access token expired — try a silent refresh, then retry once
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options);
    }
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = Cookies.get('refreshToken');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    Cookies.set('accessToken', data.accessToken, { expires: 1 / 96 }); // ~15 min
    Cookies.set('refreshToken', data.refreshToken, { expires: 7 });
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T,>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T,>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};
