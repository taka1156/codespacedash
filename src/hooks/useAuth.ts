import { useCallback, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { GithubUser } from '../lib/types';

export type AuthState = 'idle' | 'loading' | 'authenticated' | 'error';

export const useAuth = () => {
  const [state, setState] = useState<AuthState>('idle');
  const [user, setUser] = useState<GithubUser | null>(null);
  const [token, setToken] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const login = useCallback(async (pat: string) => {
    setState('loading');
    setErrorMsg(null);
    try {
      const data = await apiFetch<GithubUser>('/user', pat);
      setUser(data);
      setToken(pat);
      setState('authenticated');
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErrorMsg(
          e.message.includes('401') ? 'トークンが無効です' : e.message,
        );
        setState('error');
      }
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken('');
    setState('idle');
    setErrorMsg(null);
  }, []);

  return { state, user, token, errorMsg, login, logout };
};
