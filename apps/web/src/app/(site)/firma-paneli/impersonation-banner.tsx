import { stopImpersonating } from "@/lib/actions/admin";

/** Yönetici firma panelini firmanın gözünden görüntülerken her sayfanın üstünde durur. */
export function ImpersonationBanner({ companyId, companyName }: { companyId?: string; companyName: string }) {
  return (
    <div
      role="region"
      aria-label="Yönetici görünümü"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-300 bg-accent-50 px-4 py-3 text-sm text-slate-900"
    >
      <p>
        <strong>Yönetici olarak {companyName} firmasının panelini görüntülüyorsun.</strong> Yaptığın değişiklikler
        firma adına kaydedilir ve firmanın yönetim geçmişine senin adınla yazılır.
      </p>
      <form action={stopImpersonating}>
        {companyId && <input type="hidden" name="companyId" value={companyId} />}
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700"
        >
          Yönetime dön
        </button>
      </form>
    </div>
  );
}
