import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogoutForm } from "@/components/logout-form";
import type { AuthUser } from "@/lib/api";
import { homeFor } from "@/lib/session";

const ROLE_NAMES = { CUSTOMER: "müşteri", COMPANY: "firma", ADMIN: "yönetici" } as const;
const PANEL_NAMES = { CUSTOMER: "Hesabıma git", COMPANY: "Firma paneline git", ADMIN: "Yönetim paneline git" } as const;

/**
 * Giriş veya kayıt sayfası açık bir oturumla ziyaret edilince gösterilir. Kişi fark etmeden
 * eski hesabın (ör. yönetici) paneline yönlendirilmesin; başka hesaba geçmek için önce çıkış yapılır.
 */
export function SignedInNotice({ user, returnTo }: { user: AuthUser; returnTo: string }) {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Zaten giriş yapmışsın</h1>
      <Card className="mt-6 p-5">
        <p className="text-sm text-zinc-700">
          Şu an <strong>{user.fullName}</strong> adına, <strong>{ROLE_NAMES[user.role]}</strong> hesabıyla
          giriştesin. Başka bir hesapla girmek veya yeni hesap açmak için önce çıkış yap.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <LogoutForm>
            <input type="hidden" name="next" value={returnTo} />
            <Button type="submit" className="w-full">
              Çıkış yap ve başka hesapla devam et
            </Button>
          </LogoutForm>
          <ButtonLink href={homeFor(user.role)} variant="secondary" className="w-full">
            {PANEL_NAMES[user.role]}
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
