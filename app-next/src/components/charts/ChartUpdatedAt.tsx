import { dateHaiti } from "@/lib/charts/format";

/** Date de mise à jour réelle (heure d'Haïti). N'affiche jamais « aujourd'hui »
 *  si la source n'a pas été actualisée. */
export function ChartUpdatedAt({ iso }: { iso: string | null | undefined }) {
  return (
    <span className="row__ctx">
      Mis à jour le {dateHaiti(iso)}
    </span>
  );
}
