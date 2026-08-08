import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MODULE_FILES = [
  "../../app/support/page.tsx",
  "../../app/support/SupportExperience.tsx",
  "../../app/support/PayPalHostedButton.tsx",
  "../../app/merci/page.tsx",
  "../../app/support/cancel/page.tsx",
  "../../app/support/status/[reference]/page.tsx",
  "../../components/DonationPrompt.tsx",
  "../../components/SiteFooter.tsx",
  "../../components/SiteHeader.tsx",
  "../../app/api/contributions/create/route.ts",
  "../../app/api/contributions/manual-proof/route.ts",
  "../../app/api/contributions/moncash/callback/route.ts",
  "../../app/api/contributions/moncash/return/route.ts",
  "../../app/api/contributions/status/[reference]/route.ts",
  "../../app/api/admin/contributions/route.ts",
  "../../app/api/admin/contributions/export/route.ts",
  "../../app/api/admin/contributions/[id]/route.ts",
  "../../app/api/admin/contributions/[id]/proof/route.ts",
  "../../app/admin/contributions/ContributionsManager.tsx",
  "../../app/admin/contributions/page.tsx",
  "./config.ts",
] as const;

const MOJIBAKE =
  /(?:Ã.|Â.|â(?:€|€™|€œ|€)|ï¿½|\uFFFD)/u;

async function readUtf8(relativePath: string): Promise<string> {
  const absolutePath = fileURLToPath(new URL(relativePath, import.meta.url));
  const bytes = await readFile(absolutePath);

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

describe("encodage UTF-8 du module de soutien", () => {
  it.each(MODULE_FILES)("%s est un fichier UTF-8 sans texte corrompu", async (file) => {
    const content = await readUtf8(file);

    expect(content).not.toMatch(MOJIBAKE);
  });

  it("conserve les libellés accentués visibles par les visiteurs", async () => {
    const supportPage = await readUtf8("../../app/support/SupportExperience.tsx");
    const statusPage = await readUtf8(
      "../../app/support/status/[reference]/page.tsx",
    );
    const apiMessages = [
      await readUtf8("../../app/api/contributions/create/route.ts"),
      await readUtf8("../../app/api/contributions/manual-proof/route.ts"),
      await readUtf8("../../app/api/contributions/status/[reference]/route.ts"),
    ].join("\n");

    expect(supportPage).toContain("Soutenir Planète HMI");
    expect(supportPage).toContain("musique haïtienne");
    expect(supportPage).toContain("Depuis l’étranger");
    expect(supportPage).toContain("Montant personnalisé");
    expect(supportPage).toContain("Votre sécurité avant tout");
    expect(statusPage).toContain("Référence");
    expect(statusPage).toContain("Confirmé");
    expect(statusPage).toContain("Rejeté");
    expect(apiMessages).toContain("Données invalides.");
    expect(apiMessages).toContain("Réessayez plus tard.");
    expect(apiMessages).toContain("Référence introuvable.");
  });

  it("annonce et marque l’export CSV en UTF-8", async () => {
    const csvRoute = await readUtf8(
      "../../app/api/admin/contributions/export/route.ts",
    );

    expect(csvRoute).toContain('"Référence"');
    expect(csvRoute).toContain("`\\uFEFF${headers.map(csvCell)");
    expect(csvRoute).toContain('"Content-Type": "text/csv; charset=utf-8"');
  });
});
