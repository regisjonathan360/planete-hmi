"use server";

import { z } from "zod";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const reviewSchema = z.object({
  userId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export async function reviewArtistClaimAction(input: unknown): Promise<{
  ok: boolean;
  error?: string;
}> {
  const adminUser = await getAdminUser();
  if (!adminUser) return { ok: false, error: "Acces refuse." };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("review_artist_claim", {
    target_user_id: parsed.data.userId,
    decision: parsed.data.decision,
    reviewer_id: adminUser.id,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Cette fiche est deja rattachee a un autre compte valide."
          : "La demande n'a pas pu etre traitee.",
    };
  }

  return { ok: true };
}
