const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.code || 'UNKNOWN',
      body?.error?.message || res.statusText,
      body?.error?.details,
    );
  }
  return res.json();
}

function getHeaders(token?: string): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export const api = {
  get: <T>(path: string, token?: string) =>
    fetch(`${API_BASE}${path}`, { headers: getHeaders(token), credentials: 'include' }).then(r => handleResponse<T>(r)),

  post: <T>(path: string, body?: Record<string, unknown>, token?: string) =>
    fetch(`${API_BASE}${path}`, { method: 'POST', headers: getHeaders(token), body: body ? JSON.stringify(body) : undefined, credentials: 'include' }).then(r => handleResponse<T>(r)),

  patch: <T>(path: string, body?: Record<string, unknown>, token?: string) =>
    fetch(`${API_BASE}${path}`, { method: 'PATCH', headers: getHeaders(token), body: body ? JSON.stringify(body) : undefined, credentials: 'include' }).then(r => handleResponse<T>(r)),

  delete: <T>(path: string, token?: string) =>
    fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: getHeaders(token), credentials: 'include' }).then(r => handleResponse<T>(r)),
};
