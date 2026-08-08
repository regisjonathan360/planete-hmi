import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decodeHtml,
  detectSourceType,
  dropFinishedEvents,
  extractJsonLdEvents,
  extractTime,
  findFrenchDate,
  formatDateLabel,
  scrapeEvents,
  toIsoDate,
  type ScrapedEvent,
} from "./scraper";

function html(body: string): string {
  return `<!doctype html><html><head>${body}</head><body></body></html>`;
}

function jsonLd(payload: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

function htmlResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as Response;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload,
  } as Response;
}

const EVENTBRITE_ITEM_LIST = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: [
    {
      position: 1,
      "@type": "ListItem",
      item: {
        "@type": "Event",
        name: "KREYOL La Carice 18 Aout",
        url: "https://www.eventbrite.com/e/kreyol-la-carice-18-aout-tickets-1994915712598",
        startDate: "2026-08-18",
        endDate: "2026-08-19",
        description: "Bal Boul Pik nan Lakou Leopold",
        image: "https://img.evbuc.com/photo.jpg",
        location: {
          "@type": "Place",
          name: "Cap Haitien",
          address: { addressLocality: "Cap haitien", addressRegion: "Nord Department" },
        },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    },
  ],
};

describe("detectSourceType", () => {
  it("reconnaît chaque famille depuis l'URL", () => {
    expect(detectSourceType("eventbrite-pap", "https://www.eventbrite.fr/d/haiti/")).toBe(
      "eventbrite",
    );
    expect(detectSourceType("bandsintown-pap", "https://www.bandsintown.com/c/x")).toBe(
      "bandsintown",
    );
    expect(detectSourceType("chokarella-evenements", "https://www.chokarella.com/x")).toBe(
      "wordpress",
    );
    expect(detectSourceType("autre", "https://exemple.ht/agenda")).toBe("jsonld");
  });
});

describe("extractJsonLdEvents", () => {
  it("lit les événements imbriqués dans un ItemList", () => {
    const events = extractJsonLdEvents(html(jsonLd(EVENTBRITE_ITEM_LIST)));
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("KREYOL La Carice 18 Aout");
  });

  it("lit un Event isolé et un @graph", () => {
    expect(extractJsonLdEvents(html(jsonLd({ "@type": "Event", name: "Solo" })))).toHaveLength(1);
    expect(
      extractJsonLdEvents(html(jsonLd({ "@graph": [{ "@type": "MusicEvent", name: "Concert" }] }))),
    ).toHaveLength(1);
  });

  it("ignore un bloc JSON invalide sans faire échouer les autres", () => {
    const page = html(
      `<script type="application/ld+json">{oops</script>` + jsonLd(EVENTBRITE_ITEM_LIST),
    );
    expect(extractJsonLdEvents(page)).toHaveLength(1);
  });

  it("ne renvoie rien quand la page n'a pas de données structurées", () => {
    expect(extractJsonLdEvents(html("<title>rien</title>"))).toEqual([]);
  });
});

describe("toIsoDate / formatDateLabel", () => {
  it("ancre une date sans heure à midi UTC", () => {
    expect(toIsoDate("2026-08-18")).toBe("2026-08-18T12:00:00.000Z");
  });

  it("affiche le jour publié par la source, sans décalage de fuseau", () => {
    expect(formatDateLabel("2026-08-18")).toBe("18 août 2026");
    expect(formatDateLabel("2026-08-18T21:30:00-04:00")).toBe("18 août 2026");
  });

  it("conserve l'instant exact d'un horodatage complet", () => {
    expect(toIsoDate("2026-08-18T21:30:00Z")).toBe("2026-08-18T21:30:00.000Z");
  });

  it("rejette les valeurs non exploitables", () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate("bientôt")).toBeNull();
    expect(formatDateLabel("")).toBeNull();
  });
});

describe("extractTime", () => {
  it("lit l'heure locale telle que publiée", () => {
    expect(extractTime("2026-08-18T21:30:00-04:00")).toBe("21:30");
  });

  it("renvoie null sur une date sans heure", () => {
    expect(extractTime("2026-08-18")).toBeNull();
  });
});

describe("findFrenchDate", () => {
  it("lit une date complète", () => {
    expect(findFrenchDate("Concert le 18 août 2026 à Carice")).toBe("2026-08-18T12:00:00.000Z");
  });

  it("exige une année : sans elle, aucune date n'est inventée", () => {
    expect(findFrenchDate("Konpa Day le 24 juillet")).toBeNull();
    expect(findFrenchDate("Leaders De Demain célèbre 10 ans d'engagement")).toBeNull();
  });

  it("rejette les dates impossibles", () => {
    expect(findFrenchDate("le 31 février 2026")).toBeNull();
  });
});

describe("dropFinishedEvents", () => {
  const base: ScrapedEvent = {
    sourceUrl: "https://exemple.ht/e/1",
    title: "Test",
    imageUrl: null,
    date: null,
    startsAt: null,
    time: null,
    location: null,
    price: null,
    excerpt: null,
  };

  it("écarte les événements terminés et le signale", () => {
    const warnings: string[] = [];
    const kept = dropFinishedEvents(
      [
        { ...base, startsAt: "2026-07-01T12:00:00.000Z" },
        { ...base, startsAt: "2026-08-18T12:00:00.000Z" },
        { ...base, startsAt: null },
      ],
      warnings,
      new Date("2026-07-27T00:00:00.000Z"),
    );

    expect(kept).toHaveLength(2);
    expect(warnings[0]).toContain("1 événement(s) déjà passé(s)");
  });

  it("ne signale rien quand tout est à venir", () => {
    const warnings: string[] = [];
    dropFinishedEvents([{ ...base, startsAt: "2026-12-01T12:00:00.000Z" }], warnings, new Date("2026-07-27"));
    expect(warnings).toEqual([]);
  });
});

describe("decodeHtml", () => {
  it("décode les entités nommées, décimales et hexadécimales", () => {
    expect(decodeHtml("d&rsquo;engagement")).toBe("d\u2019engagement");
    expect(decodeHtml("Caf&eacute; &laquo;&nbsp;Lakay&nbsp;&raquo;")).toBe("Café « Lakay »");
    expect(decodeHtml("Rock &amp; Konpa")).toBe("Rock & Konpa");
    expect(decodeHtml("&#8217;")).toBe("\u2019");
    expect(decodeHtml("&#x2019;")).toBe("\u2019");
  });

  it("laisse intacte une entité inconnue", () => {
    expect(decodeHtml("&inconnue;")).toBe("&inconnue;");
  });
});

describe("scrapeEvents — Eventbrite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("construit les événements depuis le JSON-LD", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      htmlResponse(html(jsonLd(EVENTBRITE_ITEM_LIST))),
    );

    const { events } = await scrapeEvents(
      "eventbrite-haiti",
      "https://www.eventbrite.fr/d/haiti/all-events/",
      "eventbrite",
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sourceUrl: "https://www.eventbrite.com/e/kreyol-la-carice-18-aout-tickets-1994915712598",
      title: "KREYOL La Carice 18 Aout",
      date: "18 août 2026",
      startsAt: "2026-08-18T12:00:00.000Z",
      imageUrl: "https://img.evbuc.com/photo.jpg",
      price: "Gratuit",
    });
    // Le lieu et la ville homonymes ne sont pas répétés.
    expect(events[0].location).toBe("Cap Haitien, Nord Department");
  });

  it("complète avec les liens billetterie absents du JSON-LD", async () => {
    const page = html(
      jsonLd(EVENTBRITE_ITEM_LIST) +
        `<a href="https://www.eventbrite.fr/e/summer-euphoria-tickets-1994389382330">x</a>`,
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(page));

    const { events } = await scrapeEvents("eventbrite-pap", "https://www.eventbrite.fr/x", "eventbrite");

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ title: "Summer Euphoria", startsAt: null });
  });

  it("ne duplique pas un événement déjà décrit par le JSON-LD", async () => {
    const page = html(
      jsonLd(EVENTBRITE_ITEM_LIST) +
        `<a href="https://www.eventbrite.fr/e/kreyol-la-carice-18-aout-tickets-1994915712598">x</a>`,
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(page));

    const { events } = await scrapeEvents("eventbrite-pap", "https://www.eventbrite.fr/x", "eventbrite");
    expect(events).toHaveLength(1);
  });

  it("échoue avec un message explicite sur réponse non OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse("", 404));

    await expect(
      scrapeEvents("eventbrite-pap", "https://www.eventbrite.fr/x", "eventbrite"),
    ).rejects.toThrow("HTTP 404");
  });

  it("avertit quand la page ne contient plus rien d'exploitable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(html("<title>vide</title>")));

    const { events, warnings } = await scrapeEvents(
      "eventbrite-pap",
      "https://www.eventbrite.fr/x",
      "eventbrite",
    );
    expect(events).toEqual([]);
    expect(warnings.join(" ")).toContain("Aucune donnée structurée");
  });
});

describe("scrapeEvents — Bandsintown", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("explique que la source bloque la collecte serveur", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse("Cloudflare", 403));

    await expect(
      scrapeEvents("bandsintown-pap", "https://www.bandsintown.com/c/x", "bandsintown"),
    ).rejects.toThrow(/Cloudflare/);
  });
});

describe("scrapeEvents — WordPress", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lit la catégorie de l'URL puis les articles", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([{ id: 42 }]))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            link: "https://www.chokarella.com/2026/07/25/leaders-de-demain/",
            date: "2026-07-25T10:00:00",
            title: { rendered: "Leaders De Demain c&eacute;l&egrave;bre 10 ans d&rsquo;engagement" },
            excerpt: { rendered: "<p>Un anniversaire</p>" },
            _embedded: { "wp:featuredmedia": [{ source_url: "https://img/a.jpg" }] },
          },
        ]),
      );

    const { events, warnings } = await scrapeEvents(
      "chokarella-evenements",
      "https://www.chokarella.com/category/evenements/",
      "wordpress",
    );

    expect(fetchMock.mock.calls[0][0]).toContain("/categories?slug=evenements");
    expect(fetchMock.mock.calls[1][0]).toContain("categories=42");
    expect(warnings).toEqual([]);
    expect(events[0]).toMatchObject({
      title: "Leaders De Demain célèbre 10 ans d\u2019engagement",
      // Aucune date d'événement dans le titre : on n'en invente pas.
      startsAt: null,
      date: "Publié le 25 juillet 2026",
      imageUrl: "https://img/a.jpg",
    });
  });

  it("avertit et élargit la collecte si la catégorie est introuvable", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { warnings } = await scrapeEvents(
      "chokarella-evenements",
      "https://www.chokarella.com/category/agenda/",
      "wordpress",
    );

    expect(warnings[0]).toContain("agenda");
    expect(fetchMock.mock.calls[1][0]).not.toContain("categories=");
  });

  it("remonte une erreur claire si l'API est indisponible", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([{ id: 42 }]))
      .mockResolvedValueOnce(jsonResponse({}, 503));

    await expect(
      scrapeEvents("chokarella-evenements", "https://www.chokarella.com/category/evenements/", "wordpress"),
    ).rejects.toThrow("HTTP 503");
  });
});

describe("scrapeEvents — schema.org générique", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fonctionne sur n'importe quel site publiant des Event", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      htmlResponse(
        html(
          jsonLd({
            "@type": "MusicEvent",
            name: "Festival Nègès Mawon",
            url: "https://exemple.ht/festival",
            startDate: "2026-11-20T19:00:00-05:00",
            location: { "@type": "Place", name: "Yanvalou" },
            offers: [{ "@type": "Offer", price: "500", priceCurrency: "HTG" }],
          }),
        ),
      ),
    );

    const { events } = await scrapeEvents("autre", "https://exemple.ht/agenda");
    expect(events[0]).toMatchObject({
      title: "Festival Nègès Mawon",
      date: "20 novembre 2026",
      time: "19:00",
      location: "Yanvalou",
      price: "500 HTG",
    });
  });
});
