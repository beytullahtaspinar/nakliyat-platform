import { ApiError, type AuthUser } from '@nakliyat/api-client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, hasStoredSession, setSessionExpiredHandler } from './api';
import { allowedRole, wrongAppMessage } from './variant';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: AuthUser }
  /** Kayıtlı oturum var ama sunucuya ulaşılamadı: oturum silinmez, tekrar denenir */
  | { status: 'offline'; message: string };

type SessionContextValue = {
  state: SessionState;
  signIn(phone: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const reload = useCallback(async () => {
    if (!(await hasStoredSession())) {
      setState({ status: 'signedOut' });
      return;
    }
    try {
      const user = await api.me();
      if (user.role !== allowedRole) {
        await api.logout();
        setState({ status: 'signedOut' });
        return;
      }
      setState({ status: 'signedIn', user });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setState({ status: 'signedOut' });
      else setState({ status: 'offline', message: error instanceof Error ? error.message : 'Bağlantı kurulamadı.' });
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setState({ status: 'signedOut' }));
    void reload();
    return () => setSessionExpiredHandler(undefined);
  }, [reload]);

  const signIn = useCallback(async (phone: string, password: string) => {
    const user = await api.login(phone, password);
    if (user.role !== allowedRole) {
      // Aynı giriş, farklı uygulama: oturumu bu cihazda tutma, doğru uygulamayı söyle.
      await api.logout();
      throw new ApiError(403, wrongAppMessage(user.role));
    }
    setState({ status: 'signedIn', user });
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setState({ status: 'signedOut' });
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut, reload }), [state, signIn, signOut, reload]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return value;
}

/** Oturum açık ekranlarda kullanıcı */
export function useUser(): AuthUser {
  const { state } = useSession();
  if (state.status !== 'signedIn') throw new Error('Oturum açık değil');
  return state.user;
}
