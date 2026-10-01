import type { Metadata } from "next";
import { getAdminContext } from "@/lib/admin";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: { default: "Yönetim", template: "%s | Yönetim" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/yonetim">) {
  const { user } = await getAdminContext();
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <p className="text-sm text-zinc-500">Yönetim · {user.fullName}</p>
      <AdminNav />
      <div className="mt-6">{children}</div>
    </main>
  );
}
