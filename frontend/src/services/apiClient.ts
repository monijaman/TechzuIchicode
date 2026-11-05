import type { ApiErrorDetails } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly details?: ApiErrorDetails) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return null as T;

  const data = await response.json();
  if (!response.ok) {
    throw new ApiRequestError(
      data.error?.message ?? 'Request failed',
      response.status,
      data.error?.code,
      data.error?.details
    );
  }

  return data as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readResponse<T>(response);
}

export async function authenticatedRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return readResponse<T>(response);
}
