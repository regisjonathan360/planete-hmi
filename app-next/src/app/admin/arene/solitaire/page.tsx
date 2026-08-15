"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allCardKeys,
  buildCardFaceConfigs,
  cardKeyOf,
  MASK_TYPES,
  RANK_LABELS,
  RANKS,
  SUIT_GLYPHS,
  SUITS,
  CARD_MASK_PRESETS,
  type CardFaceConfig,
  type CardStyleConfig,
  type MaskType,
  type Rank,
  type SolitaireCardRow,
  type SolitaireRankPresetRow,
} from "@/lib/solitaire/cards";
import { SolitaireCardFace } from "@/components/solitaire/SolitaireCardFace";
import { artistAvatarSrc } from "@/lib/artists/avatar";
import { SOLITAIRE_RANKS } from "@/lib/arene/validation";

interface AdminCardRow extends SolitaireCardRow {
  artistName: string | null;
  artistImageUrl: string | null;
}

interface AdminPresetRow extends SolitaireRankPresetRow {}

interface ArtistHit {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

const CARD_KEYS = allCardKeys();

const FIELD_DEFS: {
  key: keyof CardStyleConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "maskScale", label: "Taille du masque", min: 0.1, max: 10, step: 0.01 },
  { key: "maskPositionX", label: "Centre X du masque", min: 0, max: 1, step: 0.01 },
  { key: "maskPositionY", label: "Centre Y du masque", min: 0, max: 1, step: 0.01 },
  { key: "imageZoom", label: "Zoom image", min: 1, max: 2.5, step: 0.05 },
  { key: "imagePositionX", label: "Point de mire X", min: 0, max: 1, step: 0.01 },
  { key: "imagePositionY", label: "Point de mire Y", min: 0, max: 1, step: 0.01 },
];

const MASK_TYPE_LABELS: Record<MaskType, string> = {
  circle: "Cercle (A à 5)",
  "rounded-square": "Carré arrondi (6 à 10)",
  square: "Carré (J/Q/K)",
};

const STYLE_TO_API_KEY: Record<keyof CardStyleConfig, string> = {
  maskType: "mask_type",
  maskScale: "mask_scale",
  maskPositionX: "mask_pos_x",
  maskPositionY: "mask_pos_y",
  imageZoom: "image_zoom",
  imagePositionX: "image_pos_x",
  imagePositionY: "image_pos_y",
};

function emptyRowFor(rank: Rank, style: CardStyleConfig): AdminPresetRow {
  return {
    rank,
    mask_type: style.maskType,
    mask_scale: style.maskScale,
    mask_pos_x: style.maskPositionX,
    mask_pos_y: style.maskPositionY,
    image_zoom: style.imageZoom,
    image_pos_x: style.imagePositionX,
    image_pos_y: style.imagePositionY,
  };
}

export default function AdminSolitairePage() {
  const [bundle, setBundle] = useState<{
    cards: AdminCardRow[];
    presets: AdminPresetRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Éditeur de carte
  const [draft, setDraft] = useState<CardFaceConfig | null>(null);
  const [touched, setTouched] = useState<Set<keyof CardStyleConfig>>(new Set());
  const [artistQuery, setArtistQuery] = useState("");
  const [artistHits, setArtistHits] = useState<ArtistHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Presets par rang
  const [presetDrafts, setPresetDrafts] = useState<Record<string, AdminPresetRow>>({});
  const [savingPreset, setSavingPreset] = useState<string | null>(null);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/arene/solitaire");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur de chargement");
      }
      const data = await res.json();
      setBundle({ cards: data.cards ?? [], presets: data.presets ?? [] });
      setPresetDrafts((prev) => {
        const next: Record<string, AdminPresetRow> = {};
        for (const preset of data.presets ?? []) {
          next[preset.rank] = prev[preset.rank] ?? { ...preset };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Configurations fusionnées (preset + override) avec artiste.
  const mergedByKey = useMemo(() => {
    const map = new Map<string, CardFaceConfig>();
    if (!bundle) return map;
    const artistByKey = new Map(
      bundle.cards.map((card) => [card.card_key, card])
    );
    for (const config of buildCardFaceConfigs({
      presets: bundle.presets,
      cards: bundle.cards,
    })) {
      const row = artistByKey.get(config.cardKey);
      if (config.artistId && row) {
        map.set(config.cardKey, {
          ...config,
          artistName: row.artistName ?? null,
          artistImageUrl: artistAvatarSrc(row.artistImageUrl),
        });
      } else {
        map.set(config.cardKey, config);
      }
    }
    return map;
  }, [bundle]);

  const selectCard = useCallback(
    (cardKey: string) => {
      setSelectedKey(cardKey);
      setTouched(new Set());
      setSaveMessage(null);
      setArtistQuery("");
      setArtistHits([]);
      const config = mergedByKey.get(cardKey) ?? null;
      setDraft(
        config
          ? {
              ...config,
              artistImageUrl: config.artistId
                ? artistAvatarSrc(config.artistImageUrl)
                : null,
            }
          : null
      );
    },
    [mergedByKey]
  );

  const updateDraftStyle = useCallback(
    (field: keyof CardStyleConfig, value: number) => {
      setDraft((d) => (d ? { ...d, [field]: value } : d));
      setTouched((t) => new Set(t).add(field));
    },
    []
  );

  const updateDraftMaskType = useCallback((maskType: MaskType) => {
    setDraft((d) => (d ? { ...d, maskType } : d));
    setTouched((t) => new Set(t).add("maskType"));
  }, []);

  // Recherche d'artistes (debounce).
  useEffect(() => {
    const query = artistQuery.trim();
    if (query.length < 2) {
      setArtistHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/arene/battles/search?type=artist&q=${encodeURIComponent(query)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setArtistHits((data.artists as ArtistHit[] | undefined) ?? []);
      } catch {
        setArtistHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [artistQuery]);

  const pickArtist = useCallback((artist: ArtistHit) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            artistId: artist.id,
            artistName: artist.name,
            artistImageUrl: artistAvatarSrc(artist.imageUrl),
          }
        : d
    );
    setArtistQuery("");
    setArtistHits([]);
  }, []);

  const removeArtist = useCallback(() => {
    setDraft((d) =>
      d
        ? { ...d, artistId: null, artistName: null, artistImageUrl: null }
        : d
    );
  }, []);

  const saveCard = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload: Record<string, unknown> = { artist_id: draft.artistId };
      for (const field of FIELD_DEFS) {
        if (touched.has(field.key as keyof CardStyleConfig)) {
          payload[STYLE_TO_API_KEY[field.key]] = draft[field.key];
        }
      }
      if (touched.has("maskType")) payload.mask_type = draft.maskType;

      const res = await fetch(
        `/api/admin/arene/solitaire/cards/${draft.cardKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? "Erreur lors de l'enregistrement");
      }
      setSaveMessage("Carte enregistrée.");
      await fetchAll();
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }, [draft, touched, fetchAll]);

  const updatePresetDraft = useCallback(
    (rank: string, patch: Partial<AdminPresetRow>) => {
      setPresetDrafts((prev) => ({
        ...prev,
        [rank]: { ...(prev[rank] ?? emptyRowFor("ace", CARD_MASK_PRESETS.ace)), ...patch },
      }));
    },
    []
  );

  const savePreset = useCallback(
    async (rank: string) => {
      const preset = presetDrafts[rank];
      if (!preset) return;
      setSavingPreset(rank);
      setPresetMessage(null);
      try {
        const res = await fetch(`/api/admin/arene/solitaire/presets/${rank}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mask_type: preset.mask_type,
            mask_scale: preset.mask_scale,
            mask_pos_x: preset.mask_pos_x,
            mask_pos_y: preset.mask_pos_y,
            image_zoom: preset.image_zoom,
            image_pos_x: preset.image_pos_x,
            image_pos_y: preset.image_pos_y,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.error?.message ?? "Erreur lors de l'enregistrement");
        }
        setPresetMessage(`Preset « ${rank} » enregistré.`);
        await fetchAll();
      } catch (e) {
        setPresetMessage(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setSavingPreset(null);
      }
    },
    [presetDrafts, fetchAll]
  );

  const resetPreset = useCallback(
    (rank: RowRank) => {
      const defaults = CARD_MASK_PRESETS[rank as Rank];
      updatePresetDraft(rank, {
        mask_type: defaults.maskType,
        mask_scale: defaults.maskScale,
        mask_pos_x: defaults.maskPositionX,
        mask_pos_y: defaults.maskPositionY,
        image_zoom: defaults.imageZoom,
        image_pos_x: defaults.imagePositionX,
        image_pos_y: defaults.imagePositionY,
      });
    },
    [updatePresetDraft]
  );

  const selected = draft;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.45rem 0.6rem",
    borderRadius: "6px",
    border: "1px solid var(--admin-border, #2c3550)",
    background: "var(--admin-panel-2, #111827)",
    color: "var(--admin-text, #e5e9f5)",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 className="admin__title">Solitaire de l&apos;Arène</h1>
          <p className="admin__subtitle">
            Cartes personnalisées par artiste — 52 cartes, géométrie par rang
            (valeurs relatives 0→1, aucune logique de jeu modifiée).
          </p>
        </div>
      </div>

      {loading && <p style={{ color: "var(--admin-muted)" }}>Chargement...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && bundle && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 360px",
              gap: "1rem",
              alignItems: "start",
            }}
          >
            {/* ---- Grille des 52 cartes ---- */}
            <div className="admin-card" style={{ padding: "0.75rem" }}>
              <h2 className="admin-card__title">
                Les 52 cartes{" "}
                <span style={{ fontWeight: 400, color: "var(--admin-muted)" }}>
                  — cliquez pour personnaliser
                </span>
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
                  gap: "0.5rem",
                }}
              >
                {CARD_KEYS.map((cardKey) => {
                  const config = mergedByKey.get(cardKey);
                  const isSelected = selectedKey === cardKey;
                  return (
                    <button
                      key={cardKey}
                      type="button"
                      onClick={() => selectCard(cardKey)}
                      title={cardKey}
                      style={{
                        width: 78,
                        height: 105,
                        margin: "0 auto",
                        padding: 0,
                        border: isSelected
                          ? "3px solid var(--admin-accent-1, #2de2ff)"
                          : "2px solid rgba(122,162,255,0.25)",
                        borderRadius: "10px",
                        background: "transparent",
                        cursor: "pointer",
                        overflow: "hidden",
                        filter: isSelected ? "drop-shadow(0 0 10px rgba(45,226,255,0.35))" : "none",
                      }}
                    >
                      <SolitaireCardFace
                        rank={rankOfKey(cardKey)}
                        suit={suitOfKey(cardKey)}
                        config={config ?? null}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ---- Panneau d'édition ---- */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="admin-card" style={{ padding: "0.75rem" }}>
                <h2 className="admin-card__title">
                  {selected ? `Carte ${selected.cardKey}` : "Édition d'une carte"}
                </h2>

                {selected ? (
                  <>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
                      <div style={{ width: 104, height: 140, flexShrink: 0, borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(122,162,255,0.35)" }}>
                        <SolitaireCardFace
                          rank={rankOfKey(selected.cardKey)}
                          suit={suitOfKey(selected.cardKey)}
                          config={selected}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="field">
                          <label htmlFor="solitaire-artist-search">Artiste</label>
                          <div style={{ position: "relative" }}>
                            <input
                              id="solitaire-artist-search"
                              type="text"
                              style={inputStyle}
                              placeholder="Rechercher un artiste (2 car. min)"
                              value={artistQuery}
                              onChange={(e) => setArtistQuery(e.target.value)}
                            />
                            {artistQuery.trim().length >= 2 && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  zIndex: 20,
                                  marginTop: "0.25rem",
                                  background: "var(--admin-panel, #0b1120)",
                                  border: "1px solid var(--admin-border, #2c3550)",
                                  borderRadius: "8px",
                                  maxHeight: "220px",
                                  overflow: "auto",
                                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                                }}
                              >
                                {searching && (
                                  <p style={{ margin: "0.5rem", color: "var(--admin-muted)", fontSize: "0.8rem" }}>
                                    Recherche…
                                  </p>
                                )}
                                {!searching && artistHits.length === 0 && (
                                  <p style={{ margin: "0.5rem", color: "var(--admin-muted)", fontSize: "0.8rem" }}>
                                    Aucun artiste trouvé.
                                  </p>
                                )}
                                {artistHits.map((artist) => (
                                  <button
                                    key={artist.id}
                                    type="button"
                                    onClick={() => pickArtist(artist)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                      width: "100%",
                                      padding: "0.45rem 0.6rem",
                                      background: "transparent",
                                      border: "none",
                                      cursor: "pointer",
                                      textAlign: "left",
                                      color: "var(--admin-text)",
                                    }}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={artistAvatarSrc(artist.imageUrl)}
                                      alt=""
                                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                                    />
                                    <span style={{ fontSize: "0.85rem" }}>{artist.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            marginTop: "0.5rem",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "8px",
                            background: "var(--admin-panel-2, #111827)",
                          }}
                        >
                          {selected.artistId ? (
                            <>
                              <span style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                Artiste : <strong>{selected.artistName ?? "Artiste supprimé"}</strong>
                              </span>
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={removeArtist}
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                              >
                                Retirer
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "var(--admin-muted)" }}>
                              Aucun artiste — rendu classique.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="solitaire-mask-type">Forme du masque</label>
                      <select
                        id="solitaire-mask-type"
                        value={selected.maskType}
                        onChange={(e) => updateDraftMaskType(e.target.value as MaskType)}
                        style={inputStyle}
                      >
                        {MASK_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {MASK_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.72rem", color: "var(--admin-muted)" }}>
                        Non touché ? La carte suit le preset du rang (A–5 cercle, 6–10 carré arrondi, J/Q/K carré).
                      </p>
                    </div>

                    {FIELD_DEFS.map((field) => (
                      <div className="field" key={field.key}>
                        <label htmlFor={`solitaire-${field.key}`}>
                          {field.label}{" "}
                          <span style={{ color: "var(--admin-muted)" }}>
                            = {Number(selected[field.key]).toFixed(2)}
                          </span>
                        </label>
                        <input
                          id={`solitaire-${field.key}`}
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={selected[field.key] as number}
                          onChange={(e) => updateDraftStyle(field.key, Number(e.target.value))}
                          style={{ width: "100%" }}
                        />
                      </div>
                    ))}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={saveCard}
                        disabled={saving}
                      >
                        {saving ? "Enregistrement…" : "Enregistrer la carte"}
                      </button>
                    </div>
                    {saveMessage && (
                      <p
                        className={saveMessage.startsWith("Carte") ? undefined : "error-text"}
                        style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}
                      >
                        {saveMessage}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ color: "var(--admin-muted)" }}>
                    Sélectionnez une carte dans la grille.
                  </p>
                )}
              </div>

              {/* ---- Presets par rang ---- */}
              <div className="admin-card" style={{ padding: "0.75rem" }}>
                <h2 className="admin-card__title">Géométrie par rang (presets)</h2>
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "var(--admin-muted)" }}>
                  Base appliquée à toutes les cartes du rang. Modifier ici, c&apos;est
                  appliquer à tout le paquet.
                </p>
                {SOLITAIRE_RANKS.map((rank) => {
                  const preset = presetDrafts[rank] ?? emptyRowFor(rank, CARD_MASK_PRESETS[rank]);
                  return (
                    <details key={rank} style={{ marginBottom: "0.35rem", border: "1px solid var(--admin-border, #2c3550)", borderRadius: "8px", padding: "0.35rem 0.5rem" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                        {RANK_LABELS[rank]} — {MASK_TYPE_LABELS[preset.mask_type]}
                      </summary>
                      <div style={{ marginTop: "0.5rem" }}>
                        <div className="field">
                          <label>Forme du masque</label>
                          <select
                            value={preset.mask_type}
                            onChange={(e) => updatePresetDraft(rank, { mask_type: e.target.value as MaskType })}
                            style={inputStyle}
                          >
                            {MASK_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {MASK_TYPE_LABELS[type]}
                              </option>
                            ))}
                          </select>
                        </div>
                        {FIELD_DEFS.map((field) => (
                          <div className="field" key={field.key}>
                            <label style={{ fontSize: "0.78rem" }}>
                              {field.label} = {Number(preset[field.key as keyof AdminPresetRow]).toFixed(2)}
                            </label>
                            <input
                              type="range"
                              min={field.min}
                              max={field.max}
                              step={field.step}
                              value={preset[field.key as keyof AdminPresetRow] as number}
                              onChange={(e) =>
                                updatePresetDraft(rank, {
                                  [field.key]: Number(e.target.value),
                                } as Partial<AdminPresetRow>)
                              }
                              style={{ width: "100%" }}
                            />
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => savePreset(rank)}
                            disabled={savingPreset === rank}
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                          >
                            {savingPreset === rank ? "Enregistrement…" : "Enregistrer"}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => resetPreset(rank)}
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                          >
                            Réinitialiser
                          </button>
                        </div>
                      </div>
                    </details>
                  );
                })}
                {presetMessage && (
                  <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--admin-muted)" }}>
                    {presetMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function rankOfKey(cardKey: string): Rank {
  const label = cardKey.slice(0, -1);
  return (
    (Object.keys(RANK_LABELS) as Rank[]).find((r) => RANK_LABELS[r] === label) ?? "ace"
  );
}

function suitOfKey(cardKey: string): (typeof SUITS)[number] {
  const suffix = cardKey.slice(-1);
  return (
    SUITS.find((suit) => cardKeyOf(RANKS[0], suit).endsWith(suffix)) ?? "spades"
  );
}

type RowRank = (typeof SOLITAIRE_RANKS)[number];