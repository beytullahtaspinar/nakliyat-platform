import { stopImpersonatingCustomer } from "@/lib/actions/admin";

/** Yönetici müşteri hesabını müşterinin gözünden görüntülerken her sayfanın üstünde durur. */
export function CustomerImpersonationBanner({ userId, name }: { userId: string; name: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6">
      <div
        role="region"
        aria-label="Yönetici görünümü"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-slate-900"
      >
        <p>
          <strong>Yönetici olarak {name} adlı müşterinin hesabını görüntülüyorsun.</strong> Yaptığın değişiklikler
          müşteri adına kaydedilir ve müşterinin yönetim geçmişine senin adınla yazılır. Bu görünüm yalnızca
          Hesabım sayfalarında geçerli.
        </p>
        <form action={stopImpersonatingCustomer}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700"
          >
            Yönetime dön
          </button>
        </form>
      </div>
    </div>
  );
}
