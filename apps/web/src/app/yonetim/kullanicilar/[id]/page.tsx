import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { ApiError, apiFetch, type AdminUserDetail } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { PageHeader, ROLE_LABELS, VerificationBadge } from "../../admin-bits";
import { ImpersonateCustomerButton } from "./impersonate-button";
import { DeleteUserForm, PasswordForm, UserForm } from "./user-forms";

export const metadata: Metadata = { title: "Kullanıcı" };

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Hesap yönetimden açıldı",
  "user.update": "Bilgiler güncellendi",
  "user.password_set": "Yeni şifre belirlendi",
  "user.delete": "Hesap silindi",
  "user.impersonate": "Müşteri hesabına geçildi",
  "user.impersonate.action": "Müşteri hesabında değişiklik",
};
const FIELD_LABELS: Record<string, string> = {
  fullName: "ad soyad",
  phone: "telefon",
  email: "e-posta",
  status: "hesap durumu",
};

/** Müşteri hesabında yönetici görünümüyle yapılan değişikliğin hangi bölümde olduğu */
function accountArea(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.includes("/messages")) return "mesajlar";
  if (path.includes("/complete")) return "iş tamamlandı";
  if (path.includes("/media")) return "dosyalar";
  if (path.includes("/quotes")) return "teklifler";
  if (path.includes("/requests")) return "talepler";
  if (path.includes("/notifications")) return "bildirimler";
  return undefined;
}

export default async function AdminUserPage({ params, searchParams }: PageProps<"/yonetim/kullanicilar/[id]">) {
  const { token, user: admin } = await getAdminContext();
  const { id } = await params;
  const created = Boolean((await searchParams).yeni);
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
        actions={u.role === "CUSTOMER" && u.status === "ACTIVE" && <ImpersonateCustomerButton userId={u.id} />}
      />
      {created && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Müşteri hesabı açıldı. Kişi telefon numarası ve belirlediğin şifreyle giriş yapabilir.
        </p>
      )}
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
          {u.role !== "ADMIN" && (
            <Card className="border-red-200 p-5">
              <h2 className="font-semibold">Hesabı sil</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Ad, telefon, e-posta ve şifre silinir; kişi bir daha bu hesapla giremez. Açık talepleri iptal
                edilir{u.company ? ", firması listelerden kalkar ve bekleyen teklifleri geri çekilir" : ""}. Geçmiş
                talep, teklif ve iş kayıtları raporlar için isimsiz olarak kalır. Planlanmış taşıma işi olan hesap
                iş bitene kadar silinemez.
              </p>
              <div className="mt-3">
                <DeleteUserForm userId={u.id} name={u.fullName} />
              </div>
            </Card>
          )}
          {u.history.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold">Yönetim geçmişi</h2>
              <ol className="mt-2 space-y-2 text-sm">
                {u.history.map((h, i) => {
                  const details = h.details as { fields?: string[]; path?: string } | null;
                  const fields = details?.fields;
                  const area = accountArea(details?.path);
                  return (
                    <li key={i}>
                      <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
                      {fields?.length ? ` (${fields.map((f) => FIELD_LABELS[f] ?? f).join(", ")})` : ""}
                      {area ? ` (${area})` : ""}{" "}
                      <span className="text-zinc-500">
                        · {h.actor.fullName} ·{" "}
                        {h.action.startsWith("user.impersonate") ? formatDateTime(h.createdAt) : formatDate(h.createdAt)}
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
