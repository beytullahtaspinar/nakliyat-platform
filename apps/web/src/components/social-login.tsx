/**
 * "Google ile devam et" / "Apple ile devam et". Düz bağlantı: sayfaya sağlayıcı scripti
 * yüklenmez (PageSpeed). Yalnızca API'de anahtarı tanımlı sağlayıcılar gösterilir.
 */
export function SocialLogin({ providers, next, role }: { providers: string[]; next?: string; role?: "CUSTOMER" | "COMPANY" }) {
  const shown = providers.filter((p) => p === "google" || p === "apple");
  if (shown.length === 0) return null;
  const href = (provider: string) => {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (role === "COMPANY") params.set("rol", "firma");
    return `/api/giris/${provider}${params.size ? `?${params}` : ""}`;
  };
  return (
    <div className="space-y-3">
      {shown.includes("google") && (
        // Route handler'a gider; next/link ön yüklemesi yönlendirmeyi tetiklemesin diye düz <a>
        <a
          href={href("google")}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-5 py-3 font-medium text-zinc-900 hover:bg-zinc-50"
        >
          <GoogleIcon />
          Google ile devam et
        </a>
      )}
      {shown.includes("apple") && (
        <a
          href={href("apple")}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-zinc-800"
        >
          <AppleIcon />
          Apple ile devam et
        </a>
      )}
      <div className="flex items-center gap-3 py-1 text-xs text-zinc-500" aria-hidden="true">
        <span className="h-px flex-1 bg-zinc-200" />
        ya da
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" width="16" height="18" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 141-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-58-156-127C46 790 0 663 0 543 0 350 125 248 249 248c66 0 121 43 162 43 40 0 102-46 177-46 29 0 131 3 200 96zM554 159c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 101-30 134-72z" />
    </svg>
  );
}
