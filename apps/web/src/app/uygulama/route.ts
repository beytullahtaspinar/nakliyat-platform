import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/session";

/**
 * Ana ekrana kurulan uygulamanın açılış adresi (manifest start_url) ve bildirim deneme bağlantısı:
 * oturum açıksa kişinin kendi paneline, değilse ana sayfaya gider.
 */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  redirect(user ? homeFor(user.role) : "/");
}
