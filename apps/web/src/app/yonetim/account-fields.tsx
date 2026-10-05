"use client";

import { useState } from "react";
import { Checkbox, Field, Input, inputClass } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

/** Karışabilecek karakterler (0/O, 1/l/I) olmadan, telefonda okunup yazılabilecek şifre */
export function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Yönetimden açılan hesabın giriş bilgileri: müşteri formunda ve firma formunun başında aynı alanlar */
export function AccountFields({ nameLabel = "Ad soyad" }: { nameLabel?: string }) {
  const [password, setPassword] = useState("");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={nameLabel}>
          <Input name="fullName" minLength={2} maxLength={100} autoComplete="off" required />
        </Field>
        <Field label="Cep telefonu" hint="Giriş bu numarayla yapılır.">
          <Input name="phone" type="tel" inputMode="tel" placeholder="0532 123 45 67" autoComplete="off" required />
        </Field>
        <Field label="E-posta" hint="Teklif vermek ve kabul etmek için doğrulanmış e-posta gerekir.">
          <Input name="email" type="email" maxLength={200} autoComplete="off" required />
        </Field>
        <div>
          <Field label="Şifre" hint="En az 8 karakter. Şifreyi kişiye telefonla veya yüz yüze ilet.">
            <input
              name="password"
              type="text"
              autoComplete="off"
              spellCheck={false}
              minLength={8}
              maxLength={72}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => setPassword(generatePassword())}>
            Şifre oluştur
          </Button>
        </div>
      </div>
      <Checkbox
        name="markVerified"
        defaultChecked
        label="Telefon ve e-posta doğrulanmış sayılsın (kişiyle görüşüp bilgileri teyit ettiysen). İşaretlemezsen kişi ilk girişte kodla doğrular."
      />
    </div>
  );
}
