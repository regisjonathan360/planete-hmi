import { describe, expect, it } from "vitest";
import { buildHmiShortsHtml } from "./hmi-shorts-html";

describe("buildHmiShortsHtml", () => {
  it("rend un lecteur YouTube respectueux de la vie privée", () => {
    const html = buildHmiShortsHtml([
      {
        id: "one",
        platform: "youtube",
        source_url: "https://www.youtube.com/shorts/abc123",
        external_id: "abc123",
        title: "Nouveau clip",
        creator_name: "Artiste HMI",
        thumbnail_url: null,
        description: null,
        display_order: 1,
      },
    ]);
    expect(html).toContain("youtube-nocookie.com/embed/abc123");
    expect(html).toContain("YouTube Shorts");
  });

  it("échappe le contenu éditorial", () => {
    const html = buildHmiShortsHtml([
      {
        id: "one",
        platform: "instagram",
        source_url: "https://www.instagram.com/reel/abc123/",
        external_id: "abc123",
        title: "<script>alert(1)</script>",
        creator_name: null,
        thumbnail_url: null,
        description: null,
        display_order: 1,
      },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
