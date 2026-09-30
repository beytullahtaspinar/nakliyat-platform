import { JsonLd } from "@/components/json-ld";

export type FaqItem = { question: string; answer: string };

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">Sık sorulan sorular</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-xl border border-zinc-200 bg-white px-5 py-4 open:shadow-[var(--shadow-card)] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-zinc-900 dark:text-white [&::-webkit-details-marker]:hidden">
              {item.question}
              <span aria-hidden className="text-xl leading-none text-brand-600 transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">{item.answer}</p>
          </details>
        ))}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
    </section>
  );
}
