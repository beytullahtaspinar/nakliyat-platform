import { Badge } from "@/components/ui/card";
import type { CompanyBooking } from "@/lib/api";
import { place } from "@/lib/format";

export const BOOKING_STATUS = {
  SCHEDULED: { label: "Planlandı", tone: "brand" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  CANCELLED: { label: "İptal edildi", tone: "neutral" },
} as const;

export function BookingStatusBadge({ status }: { status: CompanyBooking["status"] }) {
  const s = BOOKING_STATUS[status];
  return (
    <Badge tone={s.tone} className="whitespace-nowrap">
      {s.label}
    </Badge>
  );
}

type Stop = { cityName: string | null; districtName: string | null };
export const bookingRoute = (from: Stop, to: Stop) =>
  `${place(from.cityName, from.districtName)} → ${place(to.cityName, to.districtName)}`;
