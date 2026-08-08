/**
 * GET  /api/arene/profile — Profil communautaire du membre connecté (crée si inexistant)
 * PATCH /api/arene/profile — Mise à jour du pseudo et/ou de l'avatar
 *
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 15.1
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pseudoSchema, validatePseudo } from "@/lib/arene/validation";
import { containsBannedTerm } from "@/lib/arene/moderation";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Zod schema for PATCH body
// ---------------------------------------------------------------------------

const patchProfileSchema = z.object({
  pseudo: pseudoSchema.optional(),
  avatar_url: z.string().url().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Génère un pseudo par défaut à partir de l'UUID du membre.
 * Format: "user-" + 8 premiers caractères de l'UUID.
 */
function generateDefaultPseudo(userId: string): string {
  return `user-${userId.slice(0, 8)}`;
}

/**
 * Génère 3 suggestions de pseudo alternatives à partir du pseudo demandé.
 */
function generatePseudoSuggestions(base: string): string[] {
  const suffix1 = Math.floor(Math.random() * 900) + 100;
  const suffix2 = Math.floor(Math.random() * 900) + 100;
  const suffix3 = Math.floor(Math.random() * 900) + 100;
  // Tronquer si besoin pour respecter la limite de 30 chars
  const maxBase = base.slice(0, 26);
  return [
    `${maxBase}${suffix1}`,
    `${maxBase}${suffix2}`,
    `${maxBase}-${Math.floor(Math.random() * 99)}`,
  ];
}

// ---------------------------------------------------------------------------
// GET /api/arene/profile
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentification requise." } },
      { status: 401 }
    );
  }

  // Tenter de récupérer le profil existant
  const { data: profile, error: fetchError } = await supabase
    .from("community_profiles")
    .select("*")
    .eq("member_id", user.id)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 = no rows found, tout autre code est une erreur réelle
    return NextResponse.json(
      { error: { code: "server_error", message: "Erreur lors de la récupération du profil." } },
      { status: 500 }
    );
  }

  // Si le profil existe, le retourner directement
  if (profile) {
    return NextResponse.json({ profile });
  }

  // Premier accès : créer le profil avec un pseudo par défaut
  const defaultPseudo = generateDefaultPseudo(user.id);

  const { data: newProfile, error: insertError } = await supabase
    .from("community_profiles")
    .insert({
      member_id: user.id,
      pseudo: defaultPseudo,
      niveau: "etoile",
      points_cosmiques: 0,
      comment_count: 0,
      vote_count: 0,
      reaction_count: 0,
    })
    .select("*")
    .single();

  if (insertError) {
    // Cas de race condition : le profil a été créé entre-temps
    if (insertError.code === "23505") {
      const { data: existingProfile } = await supabase
        .from("community_profiles")
        .select("*")
        .eq("member_id", user.id)
        .single();

      if (existingProfile) {
        return NextResponse.json({ profile: existingProfile });
      }
    }

    return NextResponse.json(
      { error: { code: "server_error", message: "Erreur lors de la création du profil." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: newProfile }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/arene/profile
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Authentification requise." } },
      { status: 401 }
    );
  }

  // Parser et valider le body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Corps de requête invalide." } },
      { status: 400 }
    );
  }

  const parsed = patchProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Données invalides.",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  // --- Validation du pseudo ---
  if (parsed.data.pseudo !== undefined) {
    const newPseudo = parsed.data.pseudo;

    // Récupérer les termes interdits
    const { data: bannedTermsData } = await supabase
      .from("banned_terms")
      .select("term");

    const bannedTerms = (bannedTermsData ?? []).map(
      (row: { term: string }) => row.term
    );

    // Valider le pseudo (format + termes interdits)
    const validationResult = validatePseudo(newPseudo, bannedTerms);
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: validationResult.reason,
          },
        },
        { status: 400 }
      );
    }

    // Vérification supplémentaire avec containsBannedTerm pour cohérence
    if (containsBannedTerm(newPseudo, bannedTerms)) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Le pseudo contient un terme interdit.",
          },
        },
        { status: 400 }
      );
    }

    // Vérifier l'unicité du pseudo (en excluant le profil du membre actuel)
    const { data: existingProfile } = await supabase
      .from("community_profiles")
      .select("id, member_id")
      .eq("pseudo", newPseudo)
      .single();

    if (existingProfile && existingProfile.member_id !== user.id) {
      // Pseudo déjà pris — proposer 3 alternatives
      const suggestions = generatePseudoSuggestions(newPseudo);
      return NextResponse.json(
        {
          error: {
            code: "pseudo_taken",
            message: "Ce pseudo est indisponible.",
            suggestions,
          },
        },
        { status: 409 }
      );
    }

    updates.pseudo = newPseudo;
  }

  // --- Validation de l'avatar ---
  if (parsed.data.avatar_url !== undefined) {
    updates.avatar_url = parsed.data.avatar_url;
  }

  // Rien à mettre à jour
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Aucune donnée à mettre à jour." } },
      { status: 400 }
    );
  }

  // Appliquer la mise à jour
  updates.updated_at = new Date().toISOString();

  const { data: updatedProfile, error: updateError } = await supabase
    .from("community_profiles")
    .update(updates)
    .eq("member_id", user.id)
    .select("*")
    .single();

  if (updateError) {
    // Conflit d'unicité sur le pseudo (race condition)
    if (updateError.code === "23505") {
      const suggestions = generatePseudoSuggestions(
        (updates.pseudo as string) ?? ""
      );
      return NextResponse.json(
        {
          error: {
            code: "pseudo_taken",
            message: "Ce pseudo est indisponible.",
            suggestions,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: { code: "server_error", message: "Erreur lors de la mise à jour du profil." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: updatedProfile });
}
