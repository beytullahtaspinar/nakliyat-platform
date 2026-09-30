import type { ComponentProps } from "react";

export const cardClass =
  "rounded-[var(--radius-card)] border border-zinc-200 bg-white shadow-[var(--shadow-card)] " +
  "dark:border-zinc-800 dark:bg-zinc-900";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`${cardClass} ${className}`} />;
}

type Tone = "neutral" | "brand" | "accent" | "success" | "warning";

const tones: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  brand: "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200",
  accent: "bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200",
  success: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
  warning: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

export function Badge({ tone = "neutral", className = "", ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
    />
  );
}

/** Bölüm üst başlığı: küçük etiket + başlık + açıklama */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-wider text-accent-700 dark:text-accent-400">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-3xl font-bold text-zinc-900 sm:text-4xl dark:text-white">{title}</h2>
      {description && <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">{description}</p>}
    </div>
  );
}
