/**
 * Composant de fil d'Ariane (breadcrumbs) pour la navigation et le SEO
 */

import Link from "next/link";
import { generateBreadcrumbSchema, type BreadcrumbItem } from "@/lib/seo";
import { StructuredData } from "./StructuredData";

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <>
      <StructuredData data={generateBreadcrumbSchema(items)} />
      <nav aria-label="Fil d'Ariane" className={className}>
        <ol className="breadcrumbs">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.url} className="breadcrumb-item">
                {isLast ? (
                  <span aria-current="page">{item.name}</span>
                ) : (
                  <>
                    <Link href={item.url}>{item.name}</Link>
                    <span className="breadcrumb-separator" aria-hidden="true">
                      {" / "}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
