import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { scrapeChokarella } from "./scraper";

const SOURCE_URL = "https://www.chokarella.com/category/musique/";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function post(id: number, categories: number[]) {
  return {
    id,
    link: `https://www.chokarella.com/2026/07/25/article-${id}/`,
    categories,
    title: { rendered: `Article musique ${id}` },
    excerpt: { rendered: "<p>Une actualité musicale.</p>" },
    date: "2026-07-25T12:00:00",
    _embedded: {
      author: [{ name: "Chokarella" }],
      "wp:featuredmedia": [{ source_url: "https://www.chokarella.com/image.jpg" }],
    },
  };
}

describe("scrapeChokarella", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("demande exclusivement les articles de la catégorie Musique", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response([{ id: 42, slug: "musique" }]))
      .mockResolvedValueOnce(response([post(1, [42])]));

    const articles = await scrapeChokarella(SOURCE_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postsUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(postsUrl.searchParams.get("categories")).toBe("42");
    expect(articles).toHaveLength(1);
    expect(articles[0].categorySlug).toBe("musique");
  });

  it("écarte une réponse contenant un article d'une autre catégorie", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response([{ id: 42, slug: "musique" }]))
      .mockResolvedValueOnce(response([post(1, [42]), post(2, [8])]));

    const articles = await scrapeChokarella(SOURCE_URL);

    expect(articles.map((article) => article.sourceUrl)).toEqual([
      "https://www.chokarella.com/2026/07/25/article-1/",
    ]);
  });

  it("s'arrête si la catégorie Musique est introuvable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response([]));

    await expect(scrapeChokarella(SOURCE_URL)).rejects.toThrow(
      "La catégorie Musique n'a pas pu être confirmée."
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ne revient jamais aux derniers articles globaux si l'API catégorie échoue", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response({}, 503));

    await expect(scrapeChokarella(SOURCE_URL)).rejects.toThrow(
      "Catégorie Musique indisponible"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuse une URL de source qui ne cible pas la catégorie Musique", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      scrapeChokarella("https://www.chokarella.com/category/sports/")
    ).rejects.toThrow("exclusivement la catégorie Musique");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
