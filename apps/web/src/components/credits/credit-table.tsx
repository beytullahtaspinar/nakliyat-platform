import Link from "next/link";
import { DataTable, EmptyRow, td, th } from "@/components/panel/panel-bits";
import { CREDIT_TYPE_LABELS, creditRoute, signedCredits, type CreditTransaction } from "@/lib/credits";
import { formatDateTime } from "@/lib/format";

/**
 * Kredi hareketleri tablosu. Firma panelinde talep firma ekranına, yönetimde talep ve firma kaydına bağlanır;
 * yönetim görünümünde firma ve işlemi yapan kişi de görünür.
 */
export function CreditTable({ items, admin = false, empty }: { items: CreditTransaction[]; admin?: boolean; empty: React.ReactNode }) {
  const cols = admin ? 6 : 5;
  return (
    <DataTable label="Kredi hareketleri" minWidth={admin ? 820 : 640}>
      <thead>
        <tr>
          <th scope="col" className={th}>Tarih</th>
          {admin && <th scope="col" className={th}>Firma</th>}
          <th scope="col" className={th}>İşlem</th>
          <th scope="col" className={th}>Talep</th>
          <th scope="col" className={`${th} text-right`}>Miktar</th>
          <th scope="col" className={`${th} text-right`}>Bakiye</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && <EmptyRow colSpan={cols}>{empty}</EmptyRow>}
        {items.map((t) => (
          <tr key={t.id} className="hover:bg-slate-50">
            <td className={`${td} whitespace-nowrap text-slate-600`}>{formatDateTime(t.createdAt)}</td>
            {admin && (
              <td className={td}>
                <Link href={`/yonetim/firmalar/${t.company.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                  {t.company.displayName}
                </Link>
              </td>
            )}
            <td className={td}>
              <span className="font-medium text-slate-900">{CREDIT_TYPE_LABELS[t.type]}</span>
              {t.note && <span className="block text-sm text-slate-600">{t.note}</span>}
              {admin && t.actor && <span className="block text-xs text-slate-500">{t.actor.fullName}</span>}
            </td>
            <td className={td}>
              {t.request ? (
                <Link
                  href={admin ? `/yonetim/talepler/${t.request.id}` : `/firma-paneli/talepler/${t.request.id}`}
                  className="text-slate-700 hover:text-brand-700 hover:underline"
                >
                  {creditRoute(t.request)}
                </Link>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </td>
            <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums ${t.amount > 0 ? "text-green-700" : "text-slate-900"}`}>
              {signedCredits(t.amount)}
            </td>
            <td className={`${td} whitespace-nowrap text-right tabular-nums text-slate-600`}>{t.balanceAfter.toLocaleString("tr-TR")}</td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
