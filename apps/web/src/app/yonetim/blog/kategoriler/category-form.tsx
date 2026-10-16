"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Field, FormError, inputClass } from "@/components/forms/fields";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { deleteCategory, saveCategory } from "@/lib/actions/blog";
import type { AdminBlogCategory } from "@/lib/blog/admin";
import { BLOG_RULES } from "@/lib/blog/rules";

export function CategoryForm({ category }: { category: AdminBlogCategory | null }) {
  const { state, pending, invalid, formProps } = useFormAction(saveCategory.bind(null, category?.id ?? null), {});
  const form = useRef<HTMLFormElement>(null);
  // Yeni kategori eklenince form boşalır
  useEffect(() => {
    if (state.notice && !category) form.current?.reset();
  }, [state, category]);

  return (
    <form ref={form} {...formProps} className="space-y-3">
      <Field label="Ad">
        <input name="name" required minLength={2} maxLength={BLOG_RULES.categoryNameMax} defaultValue={category?.name} className={inputClass} />
      </Field>
      <Field label="Adres" hint="Boş bırakırsan addan üretilir (ör. tasinma-rehberi).">
        <input name="slug" maxLength={BLOG_RULES.slugMax} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={category?.slug} className={inputClass} />
      </Field>
      <Field label="Açıklama" hint="Kategori sayfasının giriş metni; 1-2 cümle.">
        <textarea name="description" rows={2} maxLength={BLOG_RULES.categoryDescriptionMax} defaultValue={category?.description ?? ""} className={inputClass} />
      </Field>
      <Field label="Sıra" hint="Menüde küçük sayı önce gelir.">
        <input name="sortOrder" type="number" min={0} max={999} defaultValue={category?.sortOrder ?? 0} className={inputClass} />
      </Field>
      <FormError message={state.error ?? invalid} />
      {state.notice && (
        <p role="status" className="text-sm text-green-800">
          {state.notice}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor…" : category ? "Kaydet" : "Kategori ekle"}
      </Button>
    </form>
  );
}

export function DeleteCategory({ categoryId, name, postCount }: { categoryId: string; name: string; postCount: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const note = postCount ? ` ${postCount} yazı kategorisiz kalacak.` : "";
          if (!confirm(`"${name}" kategorisi silinsin mi?${note}`)) return;
          start(async () => {
            const result = await deleteCategory(categoryId);
            if (result.error) setError(result.error);
          });
        }}
        className="text-sm font-medium text-red-700 hover:underline"
      >
        {pending ? "Siliniyor…" : "Kategoriyi sil"}
      </button>
      <FormError message={error} />
    </div>
  );
}
