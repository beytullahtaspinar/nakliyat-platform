import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AppText } from '@/components/ui';
import { enabledProviders, PROVIDER_LABELS, signInWithProvider, type OAuthProviderId } from '@/lib/oauth';
import { useSession } from '@/lib/session';
import { variant } from '@/lib/variant';
import { colors, radius } from '@/theme';

/**
 * "Google ile devam et" / "Apple ile devam et". Sunucuda anahtarı olmayan sağlayıcının düğmesi görünmez.
 * Hesabı olmayan kişi müşteri uygulamasında kaydı tamamlar; firma kaydı belge gerektirdiği için sitede yapılır.
 */
export function SocialSignIn({
  onError,
  dividerFirst = true,
}: {
  onError: (message: string | null) => void;
  /** Form altındaysa "ya da" çizgisi düğmelerin üstünde, form üstündeyse altında */
  dividerFirst?: boolean;
}) {
  const { adopt } = useSession();
  const [providers, setProviders] = useState<OAuthProviderId[]>([]);
  const [busy, setBusy] = useState<OAuthProviderId | null>(null);

  useEffect(() => {
    void enabledProviders().then(setProviders);
  }, []);

  if (providers.length === 0) return null;

  async function start(provider: OAuthProviderId) {
    onError(null);
    setBusy(provider);
    try {
      const result = await signInWithProvider(provider);
      if (result.status === 'signed_in') return await adopt(result);
      if (result.status === 'signup_required') {
        if (variant === 'firma') {
          onError(`Bu ${PROVIDER_LABELS[provider]} hesabına bağlı bir firma hesabı yok. Firmanı evdenevenakliyat.app üzerinden kaydedebilirsin.`);
          return;
        }
        router.push({
          pathname: '/kayit-tamamla',
          params: { belirtec: result.signupToken, ad: result.profile.fullName ?? '', eposta: result.profile.email ?? '' },
        });
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Giriş yapılamadı, tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  const divider = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.zinc200 }} />
      <AppText style={{ color: colors.zinc500, fontSize: 13 }}>ya da</AppText>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.zinc200 }} />
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      {dividerFirst ? divider : null}
      {providers.map((p) => {
        const apple = p === 'apple';
        const fg = apple ? colors.white : colors.zinc900;
        return (
          <Pressable
            key={p}
            accessibilityRole="button"
            accessibilityState={{ busy: busy === p, disabled: busy !== null }}
            disabled={busy !== null}
            onPress={() => void start(p)}
            style={({ pressed }) => ({
              minHeight: 50,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: apple ? '#000000' : colors.white,
              borderWidth: apple ? 0 : 1,
              borderColor: colors.zinc300,
              opacity: pressed || (busy !== null && busy !== p) ? 0.7 : 1,
            })}
          >
            {busy === p ? (
              <ActivityIndicator color={fg} />
            ) : (
              <>
                <Ionicons name={apple ? 'logo-apple' : 'logo-google'} size={20} color={apple ? colors.white : '#4285F4'} />
                <AppText weight="semibold" style={{ color: fg, fontSize: 16 }}>
                  {PROVIDER_LABELS[p]} ile devam et
                </AppText>
              </>
            )}
          </Pressable>
        );
      })}
      {dividerFirst ? null : divider}
    </View>
  );
}
