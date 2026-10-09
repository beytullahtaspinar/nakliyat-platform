import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/**
 * Ekran her öne geldiğinde GET isteği (ayrıntıdan geri dönünce liste güncel olsun).
 * reload() aşağı çekip yenilemede ve kayıttan sonra kullanılır. path null ise istek atılmaz.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);

  // Süzgeç değişince eski listenin bir an görünmesini engelle
  useEffect(() => {
    setData(null);
    setError(null);
  }, [path]);

  const reload = useCallback(async () => {
    if (path === null) return;
    setLoading(true);
    try {
      setData(await api.request<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilgiler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, loading, reload };
}
