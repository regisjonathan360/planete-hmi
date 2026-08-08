import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  YouTubeAlert,
  YouTubeCollectionProgress,
  YouTubeEmptyState,
  YouTubeStatusBadge,
} from "..";

describe("YouTubeStatusBadge", () => {
  it("traduit les statuts métier en français", () => {
    const markup = renderToStaticMarkup(
      <YouTubeStatusBadge
        category="collection"
        status="COMPLETED_WITH_WARNINGS"
      />
    );

    expect(markup).toContain("Terminée avec avertissements");
    expect(markup).toContain(
      'data-youtube-status="COMPLETED_WITH_WARNINGS"'
    );
  });
});

describe("YouTubeEmptyState", () => {
  it("affiche le contenu et une action facultative", () => {
    const markup = renderToStaticMarkup(
      <YouTubeEmptyState
        title="Aucune vidéo à vérifier"
        description="La prochaine collecte ajoutera ici les nouvelles vidéos."
        action={<a href="/admin/youtube/channels">Voir les chaînes</a>}
      />
    );

    expect(markup).toContain("Aucune vidéo à vérifier");
    expect(markup).toContain('href="/admin/youtube/channels"');
  });
});

describe("YouTubeAlert", () => {
  it("annonce immédiatement une erreur bloquante", () => {
    const markup = renderToStaticMarkup(
      <YouTubeAlert
        tone="error"
        title="Publication impossible"
        details={["Un snapshot de fin manque."]}
      >
        Corrigez les erreurs avant de publier.
      </YouTubeAlert>
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Un snapshot de fin manque.");
  });
});

describe("YouTubeCollectionProgress", () => {
  it("borne le pourcentage et expose les compteurs réels", () => {
    const markup = renderToStaticMarkup(
      <YouTubeCollectionProgress
        progress={{
          status: "RUNNING",
          progressPercent: 145,
          currentStep: "Actualisation des statistiques",
          channelsScanned: 8,
          videosDiscovered: 12,
          videosRefreshed: 96,
          warningsCount: 2,
          errorsCount: 1,
          startedAt: "2026-07-24T14:00:00.000Z",
          finishedAt: null,
        }}
      />
    );

    expect(markup).toContain('value="100"');
    expect(markup).toContain("Actualisation des statistiques");
    expect(markup).toContain("96");
    expect(markup).toContain("En cours");
  });
});
