import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

/**
 * Bildirimdeki site yolunu (ör. /firma-paneli/talepler/abc) uygulamadaki ekrana çevirir.
 * Uygulamada karşılığı olmayan yollar panoya açılır.
 */
export function companyRoute(path: string, tag = ''): Href {
  const [, section, id] = path.split('#')[0].match(/^\/firma-paneli(?:\/([a-z-]+))?(?:\/([^/?]+))?/) ?? [];
  if (section === 'talepler') return id ? { pathname: '/talep/[id]', params: { id } } : '/talepler';
  if (section === 'isler') {
    if (!id) return '/isler';
    return tag.startsWith('NEW_MESSAGE') ? { pathname: '/is/[id]/mesajlar', params: { id } } : { pathname: '/is/[id]', params: { id } };
  }
  return '/';
}

/**
 * Bildirime dokununca ilgili ekranı açar. Uygulama kapalıyken dokunulduysa açılışta, oturum
 * kapalıyken dokunulduysa girişten sonra açılır (bu kanca yalnızca oturum açık ekranlarda çalışır).
 */
export function useNotificationRouting(toRoute: (path: string, tag?: string) => Href) {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      Notifications.clearLastNotificationResponse();
      const { path, tag } = response.notification.request.content.data as { path?: unknown; tag?: unknown };
      if (typeof path === 'string') router.push(toRoute(path, typeof tag === 'string' ? tag : undefined));
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [toRoute]);
}
