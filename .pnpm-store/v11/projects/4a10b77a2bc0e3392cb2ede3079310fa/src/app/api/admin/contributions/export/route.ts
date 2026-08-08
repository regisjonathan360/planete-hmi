import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contributions")
    .select(
      "reference, created_at, donor_name, is_anonymous, amount, currency, provider, payment_mode, manual_transaction_code, status",
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) {
    return Response.json({ error: "Export impossible." }, { status: 500 });
  }

  const headers = [
    "Référence",
    "Date",
    "Contributeur",
    "Anonyme",
    "Montant",
    "Devise",
    "Fournisseur",
    "Mode",
    "Transaction",
    "Statut",
  ];
  const rows = (data ?? []).map((row) =>
    [
      row.reference,
      row.created_at,
      row.donor_name,
      row.is_anonymous ? "Oui" : "Non",
      row.amount,
      row.currency,
      row.provider,
      row.payment_mode,
      row.manual_transaction_code,
      row.status,
    ]
      .map(csvCell)
      .join(","),
  );

  return new Response(`\uFEFF${headers.map(csvCell).join(",")}\n${rows.join("\n")}`, {
    headers: {
      "Content-Disposition": `attachment; filename="contributions-planete-hmi-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
