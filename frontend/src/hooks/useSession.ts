import { useCallback, useRef, useState } from 'react';
import { authenticatedRequest, postJson } from '../services/apiClient';
import type { AuthResponse, Session } from '../types';

const SESSION_KEY = 'fb-outlet-session';

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    return null;
  }
}

function persistSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Keep the active session in memory if browser storage is unavailable.
  }
}

function toSession(data: AuthResponse, previous?: Session): Session {
  return {
    accessToken: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    role: data.user.role,
    companyId: data.user.companyId,
    ...(data.user.outletId && { outletId: data.user.outletId }),
    companyName: data.company?.name ?? previous?.companyName
  };
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const sessionRef = useRef(session);
  const refreshRequest = useRef<Promise<Session | null> | null>(null);

  const updateSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    persistSession(next);
    setSession(next);
  }, []);

  const refreshSession = useCallback((current: Session) => {
    if (!refreshRequest.current) {
      refreshRequest.current = postJson<AuthResponse>('/auth/refresh', { refreshToken: current.refreshToken })
        .then((response) => toSession(response, current))
        .catch(() => null)
        .then((next) => {
          refreshRequest.current = null;
          updateSession(next);
          return next;
        });
    }
    return refreshRequest.current;
  }, [updateSession]);

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const current = sessionRef.current;
    if (!current) throw new Error('Please sign in');

    try {
      return await authenticatedRequest<T>(path, current.accessToken, options);
    } catch (error) {
      if (!(error instanceof Error) || !('status' in error) || error.status !== 401) throw error;

      const refreshed = await refreshSession(current);
      if (!refreshed) throw new Error('Session expired, please sign in again');
      return authenticatedRequest<T>(path, refreshed.accessToken, options);
    }
  }, [refreshSession]);

  const signIn = useCallback(async (path: '/auth/login' | '/auth/register', body: unknown) => {
    const response = await postJson<AuthResponse>(path, body);
    const next = toSession(response);
    updateSession(next);
    return next;
  }, [updateSession]);

  return { session, sessionRef, updateSession, request, signIn };
}
