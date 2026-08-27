/**
 * Traduction FR des messages d'erreur Supabase Auth courants.
 * Évite d'exposer des messages techniques en anglais aux utilisateurs.
 * Les messages génériques ne révèlent pas si un email existe (anti-énumération).
 */
const ERROR_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email ou mot de passe incorrect."],
  [/user already registered/i, "Un compte existe déjà avec cet email."],
  [/email not confirmed/i, "Confirme ton email avant de te connecter (vérifie tes spams)."],
  [/password should be at least/i, "Le mot de passe est trop court (8 caractères minimum)."],
  [/password.*leaked/i, "Ce mot de passe a fuité lors d'une faille de sécurité connue. Choisis-en un autre."],
  [/same password/i, "Le nouveau mot de passe doit être différent de l'ancien."],
  [/rate limit|too many requests/i, "Trop de tentatives. Réessaie dans quelques minutes."],
  [/signup requires a valid password/i, "Mot de passe invalide (8 caractères minimum)."],
  [/unable to validate email/i, "Adresse email invalide."],
  [/captcha verification process failed/i, "Vérification anti-bot échouée. Réessaie."],
  [/email address.*invalid/i, "Adresse email invalide."],
  [/invalid claim|jwt/i, "Session expirée. Reconnecte-toi."],
];

export function traduireErreurAuth(message: string | undefined | null): string {
  if (!message) return "Une erreur est survenue. Réessaie.";
  for (const [pattern, fr] of ERROR_MAP) {
    if (pattern.test(message)) return fr;
  }
  return "Une erreur est survenue. Réessaie.";
}
