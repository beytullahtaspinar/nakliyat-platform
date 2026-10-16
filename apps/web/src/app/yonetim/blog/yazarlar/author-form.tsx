"use client";

import { useState, useTransition } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { deleteAuthor, saveAuthor } from "@/lib/actions/blog";
import type { AdminBlogAuthor } from "@/lib/blog/admin";
import type { BlogImage } from "@/lib/blog/api";
import { BLOG_RULES } from "@/lib/blog/rules";
import { ImagePicker } from "../image-picker";

export function AuthorForm({ author }: { author: AdminBlogAuthor | null }) {
  const { state, pending, invalid, formProps } = useFormAction(saveAuthor.bind(null, author?.id ?? null), {});
  const [photo, setPhoto] = useState<{ key: string; image: BlogImage } | null>(
    author?.photo && author.photoKey ? { key: author.photoKey, image: author.photo } : null,
  );
  // Yeni yazar eklenince form boşalır (alanlar yeniden kurulur)
  const [formKey, setFormKey] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.notice && !author) {
      setPhoto(null);
      setFormKey((k) => k + 1);
    }
  }

  return (
    <form key={formKey} {...formProps} className="space-y-3">
      <input type="hidden" name="photoKey" value={photo?.key ?? ""} />
      <Field label="Ad soyad">
        <input name="name" required minLength={2} maxLength={BLOG_RULES.authorNameMax} defaultValue={author?.name} className={inputClass} />
      </Field>
      <Field label="Unvan" hint="Ör. Nakliyat sektörü editörü, 12 yıllık lojistik uzmanı">
        <input name="jobTitle" maxLength={BLOG_RULES.authorJobTitleMax} defaultValue={author?.jobTitle ?? ""} className={inputClass} />
      </Field>
      <Field label="Kısa özgeçmiş" hint="Deneyimi ve uzmanlık alanı; yazıların altında ve yazar sayfasında görünür.">
        <textarea name="bio" rows={4} maxLength={BLOG_RULES.authorBioMax} defaultValue={author?.bio ?? ""} className={inputClass} />
      </Field>
      <Field label="Profil bağlantıları" hint="LinkedIn vb. her satıra bir https:// adresi (en fazla 6).">
        <textarea name="sameAs" rows={2} defaultValue={author?.sameAs.join("\n") ?? ""} className={inputClass} />
      </Field>
      <Field label="Adres" hint="Boş bırakırsan addan üretilir.">
        <input name="slug" maxLength={BLOG_RULES.slugMax} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={author?.slug} className={inputClass} />
      </Field>
      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-800">Fotoğraf</p>
        {photo && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.image.thumb.src} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
            <button type="button" onClick={() => setPhoto(null)} className="text-sm font-medium text-red-700 hover:underline">
              Fotoğrafı kaldır
            </button>
          </div>
        )}
        <ImagePicker uploadLabel={photo ? "Değiştir" : "Fotoğraf yükle"} onSelect={(item) => setPhoto({ key: item.key, image: item })} />
      </div>
      <FormError message={state.error ?? invalid} />
      {state.notice && (
        <p role="status" className="text-sm text-green-800">
          {state.notice}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor…" : author ? "Kaydet" : "Yazar ekle"}
      </Button>
    </form>
  );
}

export function DeleteAuthor({ authorId, name, postCount }: { authorId: string; name: string; postCount: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const note = postCount ? ` ${postCount} yazı imzasız kalacak.` : "";
          if (!confirm(`"${name}" silinsin mi?${note}`)) return;
          start(async () => {
            const result = await deleteAuthor(authorId);
            if (result.error) setError(result.error);
          });
        }}
        className="text-sm font-medium text-red-700 hover:underline"
      >
        {pending ? "Siliniyor…" : "Yazarı sil"}
      </button>
      <FormError message={error} />
    </div>
  );
}
