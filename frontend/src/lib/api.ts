import type { ActivityEmail, DashboardData, User } from '@/types/dashboard';

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const API = `${apiOrigin}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  let response: Response;

  try {
    response = await fetch(`${API}${path}`, { ...options, credentials: 'include', signal: controller.signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new Error('The server took too long to respond. Check the backend and Redis connection.');
    }
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<User>('/auth/me'),
  dashboard: () => request<DashboardData>('/dashboard'),
  emails: (status: 'scheduled' | 'sent') => request<ActivityEmail[]>(`/emails/${status}`),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  schedule: (payload: { subject: string; body: string; recipients: string[]; startTime: string; delayMs: number; hourlyLimit: number }) => request('/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, startTime: new Date(payload.startTime).toISOString() }) })
};
