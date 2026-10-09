import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Ekran açılınca GET isteği; reload() aşağı çekip yenilemede kullanılır. */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api.request<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilgiler yüklenemedi.');
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload };
}
