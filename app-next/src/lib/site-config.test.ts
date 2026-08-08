import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import {
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
  SOCIAL_IMAGE,
} from "./site-config";

describe("identité publique Planète HMI", () => {
  it("utilise une URL et une locale officielles valides", () => {
    expect(new URL(SITE_URL).origin).toBe("https://planete-hmi.vercel.app");
    expect(SITE_LOCALE).toBe("fr_HT");
  });

  it("déclare une image sociale au format Open Graph", () => {
    expect(SOCIAL_IMAGE).toMatchObject({
      width: 1200,
      height: 630,
    });
  });

  it("déclare le manifest et ses deux icônes d’application", () => {
    expect(manifest()).toMatchObject({
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      display: "standalone",
      icons: [
        { sizes: "192x192", type: "image/png" },
        { sizes: "512x512", type: "image/png" },
      ],
    });
  });
});
