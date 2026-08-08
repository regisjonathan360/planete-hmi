"use client";

import { useCallback, useEffect, useState } from "react";

interface ContributionRow {
  id: string;
  reference: string;
  provider: string;
  payment_mode: string;
  amount: number | string;
  currency: string;
  status: string;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  donor_message: string | null;
  is_anonymous: boolean;
  manual_transaction_code: string | null;
  proof_storage_path: string | null;
  internal_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUSES = [
  "PENDING",
  "PENDING_REVIEW",
  "PROCESSING",
  "CONFIRMED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
] as const;

const PROVIDERS = [
  "moncash",
  "natcash",
  "paypal",
  "mannitoks",
  "remitly",
  "western_union",
  "taptap_send",
] as const;

export function ContributionsManager() {
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [currency, setCurrency] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (provider) params.set("provider", provider);
    if (currency) params.set("currency", currency);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const response = await fetch(`/api/admin/contributions?${params}`, { signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
      setRows(payload.contributions ?? []);
      setTotal(payload.total ?? 0);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Chargement impossible.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [currency, dateFrom, dateTo, offset, provider, search, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setProvider("");
    setCurrency("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  }

  async function review(row: ContributionRow, nextStatus: "CONFIRMED" | "REJECTED") {
    const action = nextStatus === "CONFIRMED" ? "confirmer" : "rejeter";
    if (!window.confirm(`Voulez-vous vraiment ${action} la contribution ${row.reference} ?`)) {
      return;
    }
    const reason = window.prompt(
      nextStatus === "CONFIRMED"
        ? "Indiquez la méthode de vérification utilisée."
        : "Indiquez la raison du rejet.",
    )?.trim();
    if (!reason || reason.length < 3) return;
    const internalNotes = window.prompt("Note interne facultative :", row.internal_notes ?? "") ?? "";

    setBusyId(row.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/contributions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason, internalNotes }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Modification impossible.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modification impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function openProof(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/contributions/${id}/proof`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Preuve indisponible.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preuve indisponible.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <section className="admin-card contribution-filters" aria-label="Filtres des contributions">
        <label className="field">
          <span>Référence, nom ou transaction</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label className="field">
          <span>Statut</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}>
            <option value="">Tous</option>
            {STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Fournisseur</span>
          <select value={provider} onChange={(event) => { setProvider(event.target.value); setOffset(0); }}>
            <option value="">Tous</option>
            {PROVIDERS.map((value) => <option key={value} value={value}>{providerLabel(value)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Devise</span>
          <select value={currency} onChange={(event) => { setCurrency(event.target.value); setOffset(0); }}>
            <option value="">Toutes</option>
            <option value="HTG">HTG</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="field">
          <span>Du</span>
          <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setOffset(0); }} />
        </label>
        <label className="field">
          <span>Au</span>
          <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setOffset(0); }} />
        </label>
        <button className="btn btn--ghost" type="button" onClick={resetFilters}>Réinitialiser</button>
      </section>

      {error ? <p className="banner banner--error" role="alert">{error}</p> : null}

      <section className="admin-card">
        <div className="contribution-list-heading">
          <h2 className="admin-card__title">Contributions reçues</h2>
          <span>{total} résultat{total > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="contribution-loading" aria-label="Chargement">
            <span /><span /><span />
          </div>
        ) : rows.length === 0 ? (
          <div className="contribution-empty">
            <strong>Aucune contribution correspondante</strong>
            <p>Modifiez les filtres ou partagez la page publique de soutien.</p>
          </div>
        ) : (
          <div className="contribution-table-wrap">
            <table className="contribution-table">
              <thead>
                <tr>
                  <th>Référence et date</th>
                  <th>Contributeur</th>
                  <th>Montant</th>
                  <th>Fournisseur</th>
                  <th>Transaction</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.reference}</strong>
                      <small>{new Date(row.created_at).toLocaleString("fr-HT")}</small>
                    </td>
                    <td>
                      <span>{row.is_anonymous ? "Anonyme" : row.donor_name || "Non renseigné"}</span>
                      {row.donor_email ? <small>{row.donor_email}</small> : null}
                    </td>
                    <td><strong>{Number(row.amount).toLocaleString("fr-HT")} {row.currency}</strong></td>
                    <td>
                      <span>{providerLabel(row.provider)}</span>
                      <small>{modeLabel(row.payment_mode)}</small>
                    </td>
                    <td>{row.manual_transaction_code || "Non transmis"}</td>
                    <td><span className={`badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                    <td>
                      <div className="entry__actions">
                        {row.proof_storage_path ? (
                          <button className="btn btn--sm btn--ghost" type="button" disabled={busyId === row.id} onClick={() => openProof(row.id)}>
                            Preuve
                          </button>
                        ) : null}
                        <button className="btn btn--sm btn--ok" type="button" disabled={busyId === row.id || row.status === "CONFIRMED"} onClick={() => review(row, "CONFIRMED")}>
                          Confirmer
                        </button>
                        <button className="btn btn--sm btn--danger" type="button" disabled={busyId === row.id || row.status === "REJECTED"} onClick={() => review(row, "REJECTED")}>
                          Rejeter
                        </button>
                      </div>
                      {(row.donor_message || row.internal_notes) ? (
                        <details className="contribution-details">
                          <summary>Détails</summary>
                          {row.donor_message ? <p><strong>Message :</strong> {row.donor_message}</p> : null}
                          {row.internal_notes ? <p><strong>Note interne :</strong> {row.internal_notes}</p> : null}
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="contribution-pagination">
          <button className="btn btn--ghost" type="button" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>
            Précédent
          </button>
          <span>Page {Math.floor(offset / limit) + 1}</span>
          <button className="btn btn--ghost" type="button" disabled={offset + limit >= total || loading} onClick={() => setOffset(offset + limit)}>
            Suivant
          </button>
        </div>
      </section>
    </>
  );
}

function providerLabel(provider: string): string {
  return {
    moncash: "MonCash",
    natcash: "NatCash",
    paypal: "PayPal",
    mannitoks: "Mannitòks",
    remitly: "Remitly",
    western_union: "Western Union",
    taptap_send: "TapTap Send",
  }[provider] ?? provider;
}

function modeLabel(mode: string): string {
  return {
    MANUAL: "Validation manuelle",
    AUTOMATIC: "Automatique",
    EXTERNAL_REDIRECT: "Service externe",
  }[mode] ?? mode;
}

function statusLabel(status: string): string {
  return {
    PENDING: "Préparée",
    PENDING_REVIEW: "À vérifier",
    PROCESSING: "En traitement",
    CONFIRMED: "Confirmée",
    REJECTED: "Rejetée",
    FAILED: "Échec",
    CANCELLED: "Annulée",
    REFUNDED: "Remboursée",
  }[status] ?? status;
}

function statusClass(status: string): string {
  if (status === "CONFIRMED") return "badge--ok";
  if (status === "REJECTED" || status === "FAILED") return "badge--danger";
  if (status === "PENDING_REVIEW") return "badge--warn";
  return "badge--muted";
}
