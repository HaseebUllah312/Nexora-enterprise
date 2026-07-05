import Cookies from 'js-cookie';
import { api } from './api';

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: { name: string };
    branch: { id: string; name: string } | null;
  };
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string) {
  const data = await api.post<LoginResponse>('/auth/login', { email, password }, { auth: false });
  Cookies.set('accessToken', data.accessToken, { expires: 1 / 96 });
  Cookies.set('refreshToken', data.refreshToken, { expires: 7 });
  Cookies.set('user', JSON.stringify(data.user), { expires: 7 });
  return data;
}

export async function logout() {
  const refreshToken = Cookies.get('refreshToken');
  try {
    if (refreshToken) await api.post('/auth/logout', { refreshToken });
  } finally {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    Cookies.remove('user');
    window.location.href = '/login';
  }
}

export function getCurrentUser(): LoginResponse['user'] | null {
  const raw = Cookies.get('user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated() {
  return !!Cookies.get('accessToken');
}
