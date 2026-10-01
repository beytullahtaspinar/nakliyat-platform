import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { ApiError, apiFetch, type AdminUserDetail } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PageHeader, ROLE_LABELS, VerificationBadge } from "../../admin-bits";
import { PasswordForm, UserForm } from "./user-forms";

export const metadata: Metadata = { title: "Kullanıcı" };

const ACTION_LABELS: Record<string, string> = {
  "user.update": "Bilgiler güncellendi",
  "user.password_set": "Yeni şifre belirlendi",
};
const FIELD_LABELS: Record<string, string> = {
  fullName: "ad soyad",
  phone: "telefon",
  email: "e-posta",
  status: "hesap durumu",
};

export default async function AdminUserPage({ params }: PageProps<"/yonetim/kullanicilar/[id]">) {
  const { token, user: admin } = await getAdminContext();
  const { id } = await params;
  const u = await apiFetch<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`, { token }).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/kullanicilar", label: "Kullanıcılar" }}
        title={u.fullName}
        description={
          <>
            {ROLE_LABELS[u.role]} · kayıt {formatDate(u.createdAt)}
            {u.role === "CUSTOMER" ? ` · ${u.requestCount} talep` : ""}
          </>
        }
      />
      {u.company && (
        <p className="-mt-2 mb-4 text-sm">
          Firma:{" "}
          <Link href={`/yonetim/firmalar/${u.company.id}`} className="font-medium text-brand-700 hover:underline">
            {u.company.displayName}
          </Link>{" "}
          <VerificationBadge status={u.company.verificationStatus} />
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Hesap bilgileri</h2>
          <div className="mt-3">
            <UserForm user={u} isSelf={u.id === admin.id} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold">Şifre</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Mevcut şifre kimseye gösterilmez. Yeni bir şifre belirleyip kullanıcıya iletebilirsin; kullanıcının
              açık oturumları kapatılır.
            </p>
            <div className="mt-3">
              <PasswordForm userId={u.id} />
            </div>
          </Card>
          {u.history.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold">Yönetim geçmişi</h2>
              <ol className="mt-2 space-y-2 text-sm">
                {u.history.map((h, i) => {
                  const fields = (h.details as { fields?: string[] } | null)?.fields;
                  return (
                    <li key={i}>
                      <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
                      {fields?.length ? ` (${fields.map((f) => FIELD_LABELS[f] ?? f).join(", ")})` : ""}{" "}
                      <span className="text-zinc-500">
                        · {h.actor.fullName} · {formatDate(h.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
