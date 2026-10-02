import { NextResponse, type NextRequest } from "next/server";
import { ApiError, apiFetch } from "@/lib/api";
import { OAUTH_COOKIE, SIGNUP_COOKIE, oauthErrorCode, seeOther, type OAuthErrorCode, type OAuthPending, type OAuthResult } from "@/lib/oauth";
import { sessionCookies } from "@/lib/session-cookies";
import { homeFor, verificationPath } from "@/lib/session";

export const dynamic = "force-dynamic";

const failed = (code: OAuthErrorCode) => seeOther(`/giris?hata=${code}`);

/**
 * Apple ad ve e-posta istendiğinde dönüşü başka siteden form POST'u ile yapar. Bu istekte
 * SameSite=Lax çerezler gelmez; aynı adrese GET ile yönlendirilir, işlem orada yapılır.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const query = new URLSearchParams();
  for (const name of ["code", "state", "error", "user"]) {
    const value = form.get(name);
    if (typeof value === "string") query.set(name, value);
  }
  return seeOther(`${request.nextUrl.pathname}?${query}`);
}

export async function GET(request: NextRequest, { params }: RouteContext<"/api/giris/[provider]/donus">) {
  const { provider } = await params;
  const query = request.nextUrl.searchParams;
  const pending = readPending(request.cookies.get(OAUTH_COOKIE)?.value);

  // Kişi sağlayıcının ekranında vazgeçtiyse
  if (query.get("error")) return clearPending(failed("iptal"));
  const code = query.get("code");
  if (!pending || pending.provider !== provider || !code || query.get("state") !== pending.state) {
    return clearPending(failed("sure"));
  }

  let result: OAuthResult;
  try {
    result = await apiFetch<OAuthResult>(`/auth/oauth/${encodeURIComponent(provider)}/callback`, {
      method: "POST",
      body: {
        code,
        codeVerifier: pending.verifier,
        nonce: pending.nonce,
        ...(query.get("user") && { appleUser: query.get("user") }),
      },
    });
  } catch (err) {
    return clearPending(failed(err instanceof ApiError ? oauthErrorCode(err.status) : "genel"));
  }

  if (result.status === "signup_required") {
    const params = new URLSearchParams();
    if (pending.next) params.set("next", pending.next);
    if (pending.role === "COMPANY") params.set("rol", "firma");
    const response = clearPending(seeOther(`/kayit/tamamla${params.size ? `?${params}` : ""}`));
    response.cookies.set(SIGNUP_COOKIE, result.signupToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 20 * 60,
    });
    return response;
  }

  const target = pending.next ?? homeFor(result.user.role);
  const response = clearPending(seeOther(result.user.verified ? target : verificationPath(target)));
  for (const [name, value, options] of sessionCookies(result, result.user.role)) {
    response.cookies.set(name, value, options);
  }
  return response;
}

function readPending(raw: string | undefined): OAuthPending | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthPending;
  } catch {
    return null;
  }
}

function clearPending(response: Response): NextResponse {
  const next = new NextResponse(null, { status: response.status, headers: response.headers });
  next.cookies.set(OAUTH_COOKIE, "", { path: "/api/giris", maxAge: 0 });
  return next;
}
