import { requireAdmin } from "@/lib/auth/require-admin";
import { ResolveButtons } from "@/components/admin/ResolveButtons";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { supabase } = await requireAdmin();
  const { data: file } = await supabase
    .from("chart_match_queue")
    .select("id, raw_entry, confidence, resolution_status, created_at")
    .eq("resolution_status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <h1>File de correspondance</h1>
      <p>
        Correspondances incertaines à vérifier manuellement. Une correspondance
        inférieure au seuil n’est jamais publiée sans résolution.
      </p>
      {(!file || file.length === 0) ? (
        <p className="admin__ok">Aucune correspondance en attente. ✔</p>
      ) : (
        <table>
          <thead>
            <tr><th>Entrée brute</th><th>Confiance</th><th>Résolution</th></tr>
          </thead>
          <tbody>
            {file.map((m) => (
              <tr key={m.id}>
                <td><code style={{ fontSize: "0.78rem" }}>{JSON.stringify(m.raw_entry)}</code></td>
                <td>{m.confidence != null ? `${(Number(m.confidence) * 100).toFixed(0)}%` : "—"}</td>
                <td><ResolveButtons queueId={m.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
