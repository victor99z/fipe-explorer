const SLUG_LOCATION_MAP: Record<string, { city?: string; state?: string }> = {
  // Santa Catarina
  joinville: { city: "Joinville", state: "SC" },
  "norte-de-santa-catarina": { city: "Joinville", state: "SC" },
  "jaragua-do-sul": { city: "Jaraguá do Sul", state: "SC" },
  "sao-bento-do-sul": { city: "São Bento do Sul", state: "SC" },
  araquari: { city: "Araquari", state: "SC" },
  "barra-velha": { city: "Barra Velha", state: "SC" },
  "sao-francisco-do-sul": { city: "São Francisco do Sul", state: "SC" },
  guaramirim: { city: "Guaramirim", state: "SC" },
  blumenau: { city: "Blumenau", state: "SC" },
  "regiao-de-blumenau": { city: "Blumenau", state: "SC" },
  "vale-do-itajai": { city: "Blumenau", state: "SC" },
  itajai: { city: "Itajaí", state: "SC" },
  "balneario-camboriu": { city: "Balneário Camboriú", state: "SC" },
  brusque: { city: "Brusque", state: "SC" },
  florianopolis: { city: "Florianópolis", state: "SC" },
  "florianopolis-e-regiao": { city: "Florianópolis", state: "SC" },
  "grande-florianopolis": { city: "Florianópolis", state: "SC" },
  "sao-jose": { city: "São José", state: "SC" },
  palhoca: { city: "Palhoça", state: "SC" },
  // Paraná
  curitiba: { city: "Curitiba", state: "PR" },
  "grande-curitiba": { city: "Curitiba", state: "PR" },
  "regiao-de-curitiba-e-paranagua": { city: "Curitiba", state: "PR" },
  "sao-jose-dos-pinhais": { city: "São José dos Pinhais", state: "PR" },
  pinhais: { city: "Pinhais", state: "PR" },
  colombo: { city: "Colombo", state: "PR" },
  araucaria: { city: "Araucária", state: "PR" },
  "ponta-grossa": { city: "Ponta Grossa", state: "PR" },
};

function titleCaseSlug(slug: string): string {
  const minorWords = new Set(["do", "da", "dos", "das", "de", "e"]);
  return slug
    .split("-")
    .filter(Boolean)
    .map((part, idx) =>
      idx > 0 && minorWords.has(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

/**
 * Infers fallback city/state from a regional OLX or Webmotors target URL so
 * multi-city crawls (e.g., Curitiba/PR, Blumenau/SC) never fall back to "Joinville/SC"
 * when an individual card omits location fields.
 */
export function inferLocationFromUrl(siteUrl?: string | null): {
  city?: string;
  state?: string;
} {
  if (!siteUrl) return {};
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return {};
  }

  const pathname = parsed.pathname.toLowerCase();
  const segments = pathname.split("/").filter(Boolean);

  let inferredState: string | undefined;
  let inferredCity: string | undefined;

  // OLX pattern: .../estado-{uf}/[region]/[city]
  const estadoSeg = segments.find((seg) => /^estado-[a-z]{2}$/.test(seg));
  if (estadoSeg) {
    inferredState = estadoSeg.slice("estado-".length).toUpperCase();
  }

  // Webmotors pattern: /carros/{uf}-{city-slug}[=1]
  const wmMatch = pathname.match(/\/carros\/([a-z]{2})-([a-z0-9-]+?)(?:=\d+)?(?:\/|$)/);
  if (wmMatch?.[1] && wmMatch?.[2]) {
    inferredState = wmMatch[1].toUpperCase();
    const slug = wmMatch[2];
    const mapped = SLUG_LOCATION_MAP[slug];
    inferredCity = mapped?.city ?? titleCaseSlug(slug);
  }

  if (!inferredCity) {
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i]!;
      const mapped = SLUG_LOCATION_MAP[seg];
      if (mapped) {
        inferredCity = mapped.city;
        inferredState ??= mapped.state;
        break;
      }
    }
  }

  return {
    ...(inferredCity ? { city: inferredCity } : {}),
    ...(inferredState ? { state: inferredState } : {}),
  };
}
