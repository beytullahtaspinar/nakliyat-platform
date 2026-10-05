import { getCurrentUser, isImpersonating } from "@/lib/session";
import { CustomerImpersonationBanner } from "./impersonation-banner";

export default async function AccountLayout({ children }: LayoutProps<"/hesabim">) {
  // Sayfalar kendi oturum ve rol kontrolünü yapar; burada yalnızca yönetici görünümü şeridi eklenir
  const [impersonating, user] = await Promise.all([isImpersonating(), getCurrentUser()]);
  return (
    <>
      {impersonating && user?.role === "CUSTOMER" && <CustomerImpersonationBanner userId={user.id} name={user.fullName} />}
      {children}
    </>
  );
}
