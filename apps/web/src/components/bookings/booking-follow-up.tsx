import type { BookingActor, BookingDispute } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Props = BookingDispute & {
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  canComplete: boolean;
  autoCompleteOn: string | null;
  /** Ekranı gören taraf: kendi itirazı "sen" diye anlatılır */
  viewer: "CUSTOMER" | "COMPANY";
  className?: string;
};

const WHO: Record<BookingActor, string> = { CUSTOMER: "Müşteri", COMPANY: "Firma", SYSTEM: "Sistem", ADMIN: "Yönetim" };

/**
 * Taşınma sonrası durum satırı: kimse işaretlemezse ne zaman tamamlanacağı, bekleyen itiraz ya da yönetimin kararı.
 * Kurallar: docs/tasinma-sonrasi.md
 */
export function BookingFollowUp({ viewer, className = "", ...b }: Props) {
  const own = b.disputedBy === viewer;
  let text: string | null = null;
  if (b.status === "SCHEDULED" && b.disputedAt) {
    text = `${own ? "Taşınmanın yapılmadığını bildirdin" : `${WHO[b.disputedBy ?? "CUSTOMER"]} taşınmanın yapılmadığını bildirdi`} (${formatDate(b.disputedAt)}). Yönetim inceleyip karar verecek; bu sürede iş tamamlanmaz ve iptal edilemez.${b.disputeReason ? ` İtiraz: "${b.disputeReason}"` : ""}`;
  } else if (b.disputeResolvedAt && b.disputeResolution) {
    text = `Yönetim itirazı karara bağladı (${formatDate(b.disputeResolvedAt)}): ${b.status === "COMPLETED" ? "taşınma yapılmış sayıldı" : "taşınma yapılmadı, iş iptal edildi"}. Açıklama: ${b.disputeResolution}`;
  } else if (b.status === "COMPLETED" && b.completedBy === "SYSTEM") {
    text = "Taşınma gününden sonra itiraz gelmediği için iş kendiliğinden tamamlandı.";
  } else if (b.status === "SCHEDULED" && b.canComplete && b.autoCompleteOn) {
    text = `Taşınma yapıldıysa işi tamamlandı olarak işaretle. Kimse işaretlemez ve itiraz gelmezse iş ${formatDate(`${b.autoCompleteOn}T00:00:00.000Z`)} tarihinde kendiliğinden tamamlanır.`;
  }
  if (!text) return null;
  return <p className={`text-sm ${className}`}>{text}</p>;
}
