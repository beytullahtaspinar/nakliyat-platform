import Link from "next/link";
import type { AuthUser } from "@/lib/api";
import { verificationPath } from "@/lib/session";

/** Hesap doğrulanmadıysa panelin üstünde gösterilir; doğrulama ekranına götürür. */
export function VerifyNotice({ user, returnTo }: { user: AuthUser; returnTo: string }) {
  if (user.verified) return null;
  return (
    <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>{user.role === "COMPANY" ? "Teklif verebilmek için" : "Talebinin firmalara gitmesi için"} hesabını doğrula.</strong>{" "}
      {user.emailVerified ? "Telefon numarana bir kod göndereceğiz." : "E-posta adresine 6 haneli bir kod göndereceğiz."}{" "}
      <Link href={verificationPath(returnTo)} className="font-semibold underline">
        Şimdi doğrula
      </Link>
    </div>
  );
}
