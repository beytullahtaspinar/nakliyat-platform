import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button } from '@/components/ui';
import { colors, radius } from '@/theme';

type Icon = ComponentProps<typeof Ionicons>['name'];

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Geri alınamayan işlemler: kırmızı düğme ve uyarı simgesi */
  destructive?: boolean;
  icon?: Icon;
  /**
   * Onaylanınca çalışır; bitene kadar pencere açık kalır ve düğme bekler.
   * Hata verirse ileti pencerede gösterilir, kullanıcı tekrar deneyebilir.
   */
  action?: () => Promise<unknown>;
};

type DialogState = ConfirmOptions & { kind: 'confirm' | 'alert'; resolve: (ok: boolean) => void };

type DialogApi = {
  /** Onay penceresi; onaylanırsa (ve action başarılıysa) true döner */
  confirm(options: ConfirmOptions): Promise<boolean>;
  /** Tek düğmeli bilgi penceresi */
  alert(title: string, message?: string): Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

/** Sistem Alert'i yerine uygulamanın görünümüyle alttan açılan pencere */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<DialogState | null>(null);
  const insets = useSafeAreaInsets();

  const open = useCallback((state: DialogState) => {
    // Açık bir pencere varsa vazgeçilmiş sayılır
    current.current?.resolve(false);
    current.current = state;
    setError(null);
    setBusy(false);
    setDialog(state);
  }, []);

  const close = useCallback((ok: boolean) => {
    current.current?.resolve(ok);
    current.current = null;
    setDialog(null);
    setBusy(false);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => new Promise<boolean>((resolve) => open({ ...options, kind: 'confirm', resolve })),
      alert: (title, message) =>
        new Promise<void>((resolve) => open({ title, message, confirmLabel: 'Tamam', kind: 'alert', resolve: () => resolve() })),
    }),
    [open],
  );

  async function confirm() {
    if (!dialog?.action) return close(true);
    setBusy(true);
    setError(null);
    try {
      await dialog.action();
      close(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı, tekrar dene.');
      setBusy(false);
    }
  }

  const destructive = dialog?.destructive;
  const icon: Icon = dialog?.icon ?? (dialog?.kind === 'alert' ? 'information-circle' : destructive ? 'warning' : 'help-circle');

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal visible={dialog !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => !busy && close(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityLabel="Kapat"
            onPress={() => !busy && close(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
          />
          {dialog ? (
            <View
              accessibilityViewIsModal
              style={{
                backgroundColor: colors.white,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                gap: 16,
              }}
            >
              <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.zinc200 }} />
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: destructive ? colors.red50 : colors.brand50,
                  }}
                >
                  <Ionicons name={icon} size={24} color={destructive ? colors.red700 : colors.brand700} />
                </View>
                <View style={{ flex: 1, gap: 4, paddingTop: 2 }}>
                  <AppText weight="bold" accessibilityRole="header" style={{ fontSize: 18, lineHeight: 24 }}>
                    {dialog.title}
                  </AppText>
                  {dialog.message ? <AppText style={{ color: colors.zinc600 }}>{dialog.message}</AppText> : null}
                </View>
              </View>
              {error ? (
                <View accessibilityRole="alert" style={{ backgroundColor: colors.red50, borderRadius: radius.md, padding: 12 }}>
                  <AppText style={{ color: colors.red700 }}>{error}</AppText>
                </View>
              ) : null}
              <View style={{ gap: 10 }}>
                <Button
                  title={dialog.confirmLabel}
                  kind={destructive ? 'danger' : 'primary'}
                  loading={busy}
                  onPress={() => void confirm()}
                />
                {dialog.kind === 'confirm' ? (
                  <Button title={dialog.cancelLabel ?? 'Vazgeç'} kind="secondary" disabled={busy} onPress={() => close(false)} />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog, DialogProvider içinde kullanılmalı');
  return value;
}
