import { Badge } from "@/components/ui/card";
import type { UserRole, VerificationStatus } from "@/lib/api";

export const ROLE_LABELS: Record<UserRole, string> = { CUSTOMER: "Müşteri", COMPANY: "Firma", ADMIN: "Yönetici" };

export const VERIFICATION: Record<VerificationStatus, { label: string; tone: "warning" | "success" | "neutral" }> = {
  PENDING: { label: "Onay bekliyor", tone: "warning" },
  VERIFIED: { label: "Onaylı", tone: "success" },
  REJECTED: { label: "Reddedildi", tone: "neutral" },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const v = VERIFICATION[status];
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export { DataTable, EmptyRow, FilterTabs, PageHeader, Pager, SearchForm, query, td, th } from "@/components/panel/panel-bits";
