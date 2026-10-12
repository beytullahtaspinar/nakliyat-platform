import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Google / Apple girişinin dönüş adresi (evdenevenakliyat://oauth). Sonucu giriş penceresi okur
 * (lib/oauth.ts); Android bu adresi uygulamaya da ilettiğinde boş sayfa kalmasın diye geri dönülür.
 */
export default function OAuthReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return null;
}
