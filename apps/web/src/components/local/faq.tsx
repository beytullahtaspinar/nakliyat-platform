import { JsonLd } from "@/components/json-ld";

export type FaqItem = { question: string; answer: string };

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">Sık sorulan sorular</h2>
      <div className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((item) => (
          <details key={item.question} className="py-4">
            <summary className="cursor-pointer font-medium">{item.question}</summary>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">{item.answer}</p>
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
