/**
 * Composant pour injecter les données structurées JSON-LD
 * Utilise dangerouslySetInnerHTML de manière sécurisée en échappant les caractères HTML
 */

interface StructuredDataProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function StructuredData({ data }: StructuredDataProps) {
  const jsonLd = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}
