type JsonLdProps = { data: Record<string, unknown> | Record<string, unknown>[] };

/** schema.org yapısal verisi. `<` kaçışı XSS'e karşı. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
