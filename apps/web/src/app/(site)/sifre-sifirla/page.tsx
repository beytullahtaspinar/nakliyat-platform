import type { Metadata } from "next";
import { PasswordResetForm } from "./password-reset-form";

export const metadata: Metadata = {
  title: "Şifremi unuttum",
  robots: { index: false, follow: false },
};

export default function PasswordResetPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Şifremi unuttum</h1>
      <PasswordResetForm />
    </main>
  );
}
