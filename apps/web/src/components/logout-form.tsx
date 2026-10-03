"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { logout } from "@/lib/actions/auth";
import { currentPushSubscription, PUSH_CHANGE_EVENT } from "@/lib/pwa";

/**
 * Çıkış formu. Bu cihaz anlık bildirime kayıtlıysa çıkışta kayıt sunucudan silinir ve tarayıcıdaki
 * abonelik bırakılır: telefonu başkası kullanacaksa önceki hesabın bildirimleri gelmeye devam etmesin.
 */
export function LogoutForm({ children, ...props }: Omit<ComponentProps<"form">, "action" | "onSubmit">) {
  const [endpoint, setEndpoint] = useState("");
  useEffect(() => {
    const read = () =>
      void currentPushSubscription()
        .then((s) => setEndpoint(s?.endpoint ?? ""))
        .catch(() => undefined);
    read();
    window.addEventListener(PUSH_CHANGE_EVENT, read);
    return () => window.removeEventListener(PUSH_CHANGE_EVENT, read);
  }, []);

  return (
    <form
      {...props}
      action={logout}
      onSubmit={() => {
        if (endpoint) void currentPushSubscription().then((s) => s?.unsubscribe()).catch(() => undefined);
      }}
    >
      {endpoint && <input type="hidden" name="pushEndpoint" value={endpoint} />}
      {children}
    </form>
  );
}
