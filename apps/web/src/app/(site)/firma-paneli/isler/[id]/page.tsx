import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, apiFetch, type CompanyBooking, type Conversation as ConversationData, type Paginated } from "@/lib/api";
import { getCompanyContext } from "@/lib/company";
import { formatDate, formatMoney, formatPhone, place } from "@/lib/format";
import { homeTypeLabel } from "@/lib/request-options";
import { Conversation } from "@/components/messages/conversation";

export const metadata: Metadata = { title: "Müşteriyle mesajlar" };

export default async function CompanyBookingMessagesPage({ params }: PageProps<"/firma-paneli/isler/[id]">) {
  const { id } = await params;
  const { token, profile } = await getCompanyContext();
  if (!profile) return null;

  let conversation: ConversationData;
  try {
    conversation = await apiFetch<ConversationData>(`/bookings/${encodeURIComponent(id)}/messages`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { items } = await apiFetch<Paginated<CompanyBooking>>("/company/bookings?limit=50", { token });
  const booking = items.find((b) => b.id === id);

  return (
    <div>
      <Link href="/firma-paneli/isler" className="text-sm text-zinc-600 hover:underline">
        ← İşlerim
      </Link>
      <h2 className="mt-3 text-xl font-semibold">{conversation.counterpart} ile mesajlar</h2>
      {booking && (
        <p className="mt-1 text-sm text-zinc-600">
          {place(booking.request.from.cityName, booking.request.from.districtName)} →{" "}
          {place(booking.request.to.cityName, booking.request.to.districtName)} · {homeTypeLabel(booking.request.homeType)} ·{" "}
          {formatDate(booking.scheduledAt)} · {formatMoney(booking.priceTry)} · Telefon:{" "}
          <a href={`tel:${booking.customer.phone}`} className="font-semibold text-brand-700 underline">
            {formatPhone(booking.customer.phone)}
          </a>
        </p>
      )}
      <div className="mt-4">
        <Conversation initial={conversation} refreshBadges />
      </div>
    </div>
  );
}
