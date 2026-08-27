/**
 * Estimation de force d'un mot de passe, sans dépendance externe.
 * Score 0-4 : très faible, faible, moyen, bon, excellent.
 */
export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { score: 0, label: "" };

  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;

  // Entropie brute en bits.
  const entropy = password.length * Math.log2(pool || 1);

  // Pénalités : motifs triviaux.
  const trivial =
    /^(?:1234|abcd|azert|qwer|password|motdepasse|0000|1111)/i.test(password) ||
    /(.)\1{3,}/.test(password) ||
    new RegExp(`^${escapeRe(password.slice(0, 4))}\\1?$`, "i").test(password);
  const bonus = trivial ? -15 : 0;

  const bits = Math.max(0, entropy + bonus);

  if (bits < 28) return { score: password.length < 8 ? 0 : 1, label: "Très faible" };
  if (bits < 40) return { score: 1, label: "Faible" };
  if (bits < 60) return { score: 2, label: "Moyen" };
  if (bits < 80) return { score: 3, label: "Bon" };
  return { score: 4, label: "Excellent" };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const STRENGTH_COLORS = ["#ff5c7c", "#ff5c7c", "#ffb347", "#3ddc84", "#3ddc84"] as const;
