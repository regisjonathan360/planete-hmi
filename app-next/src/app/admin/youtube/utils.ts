const DATE_FORMAT = new Intl.DateTimeFormat("fr-HT", {
  dateStyle: "medium",
  timeZone: "America/Port-au-Prince",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("fr-HT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Port-au-Prince",
});

const NUMBER_FORMAT = new Intl.NumberFormat("fr-HT");

export function formatNumber(value: number | null | undefined): string {
  return NUMBER_FORMAT.format(Math.max(0, value ?? 0));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Non disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Non disponible" : DATE_FORMAT.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Non disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Non disponible" : DATE_TIME_FORMAT.format(date);
}

export function defaultYouTubePeriod(reference = new Date()): {
  periodStart: string;
  periodEnd: string;
} {
  const end = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate()
  ));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export function readApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown };
    const message = typeof e.message === "string" && e.message.trim() ? e.message : "";
    // Inclure les détails de validation si présents
    if (Array.isArray(e.details) && e.details.length > 0) {
      const detailsStr = e.details.map((d: { path?: string; msg?: string }) => `${d.path}: ${d.msg}`).join(" | ");
      return message ? `${message} (${detailsStr})` : detailsStr;
    }
    if (message) return message;
  }
  return fallback;
}

export function isRunTerminal(status: string): boolean {
  return ["COMPLETED", "COMPLETED_WITH_WARNINGS", "FAILED", "CANCELLED"].includes(status);
}

