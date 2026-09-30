import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { SITE_NAME } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          {SITE_NAME}
        </Link>
        <nav className="flex items-center gap-4">
          <AccountMenu />
          <Link
            href="/talep-olustur"
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            Teklif al
          </Link>
        </nav>
      </div>
    </header>
  );
}
