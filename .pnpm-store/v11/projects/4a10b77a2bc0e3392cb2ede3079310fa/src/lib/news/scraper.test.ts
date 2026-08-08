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

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
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

  it("utilise uniquement la page Musique si la catégorie API est introuvable", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        htmlResponse(`
          <article>
            <img src="/uploads/concert.jpg" />
            <a href="https://www.chokarella.com/2026/07/28/nouveau-concert/">
              Nouveau concert à Port-au-Prince
            </a>
          </article>
        `)
      );

    const articles = await scrapeChokarella(SOURCE_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toBe(SOURCE_URL);
    expect(articles).toMatchObject([
      {
        sourceUrl: "https://www.chokarella.com/2026/07/28/nouveau-concert/",
        title: "Nouveau concert à Port-au-Prince",
        categorySlug: "musique",
      },
    ]);
  });

  it("ne revient jamais aux derniers articles globaux si l'API catégorie échoue", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(htmlResponse("<html>Aucun article</html>"));

    await expect(scrapeChokarella(SOURCE_URL)).rejects.toThrow(
      "Chokarella ne répond pas correctement"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toBe(SOURCE_URL);
  });

  it("bascule sur la page Musique lorsque l'API dépasse le délai", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("Timeout", "TimeoutError"))
      .mockResolvedValueOnce(
        htmlResponse(`
          <a href="/2026/07/29/sortie-musicale/">Une nouvelle sortie musicale</a>
        `)
      );

    const articles = await scrapeChokarella(SOURCE_URL);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(articles[0].sourceUrl).toBe(
      "https://www.chokarella.com/2026/07/29/sortie-musicale/"
    );
  });

  it("refuse une URL de source qui ne cible pas la catégorie Musique", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      scrapeChokarella("https://www.chokarella.com/category/sports/")
    ).rejects.toThrow("exclusivement la catégorie Musique");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
