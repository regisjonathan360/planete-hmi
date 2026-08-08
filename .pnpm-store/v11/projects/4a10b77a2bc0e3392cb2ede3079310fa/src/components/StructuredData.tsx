import { generateWebSiteSchema, generateOrganizationSchema } from "@/lib/seo";

export function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [generateWebSiteSchema(), generateOrganizationSchema()],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  );
}
