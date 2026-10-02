import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiFetch } from "@/lib/api";
import { OAUTH_COOKIE, oauthErrorCode, type OAuthPending } from "@/lib/oauth";
import { safeNext } from "@/lib/session";

export const dynamic = "force-dynamic";

const random = () => randomBytes(32).toString("base64url");

/**
 * "Google ile devam et" / "Apple ile devam et": state, nonce ve PKCE anahtarını üretip çereze yazar,
 * kişiyi sağlayıcının giriş sayfasına yönlendirir. Dönüş: ./donus
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/giris/[provider]">) {
  const { provider } = await params;
  const query = request.nextUrl.searchParams;
  const pending: OAuthPending = {
    provider,
    state: random(),
    nonce: random(),
    verifier: random(),
    next: safeNext(query.get("next")),
    role: query.get("rol") === "firma" ? "COMPANY" : "CUSTOMER",
  };
  const codeChallenge = createHash("sha256").update(pending.verifier).digest("base64url");
  const loginHint = query.get("login_hint") ?? undefined;

  let url: string;
  try {
    ({ url } = await apiFetch<{ url: string }>(`/auth/oauth/${encodeURIComponent(provider)}/start`, {
      method: "POST",
      body: { state: pending.state, nonce: pending.nonce, codeChallenge, ...(loginHint && { loginHint }) },
    }));
  } catch (err) {
    const code = err instanceof ApiError ? oauthErrorCode(err.status) : "genel";
    return new NextResponse(null, { status: 303, headers: { Location: `/giris?hata=${code}` } });
  }

  const response = new NextResponse(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });
  response.cookies.set(OAUTH_COOKIE, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax yeterli: Apple'ın form POST'u ./donus'ta GET'e çevrilir, çerez o GET ile gelir
    sameSite: "lax",
    path: "/api/giris",
    maxAge: 600,
  });
  return response;
}
