import type { ScraperRunner } from "./base-scraper";
import { getOlxCarros } from "./olx-carros";
import { getWebmotorsCarros } from "./webmotors-carros";

export const SCRAPER_REGISTRY: Record<string, ScraperRunner> = {
  "olx-carros": getOlxCarros,
  "webmotors-carros": getWebmotorsCarros,
};

/**
 * Resolves the scraper runner for any target row in `car_listings`, supporting
 * multi-city source names (`olx-curitiba`, `webmotors-blumenau`, etc.) or host matching.
 */
export function resolveScraperForListing(
  name: string,
  url?: string | null,
): ScraperRunner | null {
  if (SCRAPER_REGISTRY[name]) {
    return SCRAPER_REGISTRY[name];
  }

  const lowerName = name.trim().toLowerCase();
  const lowerUrl = (url ?? "").trim().toLowerCase();

  if (lowerName.startsWith("olx") || lowerUrl.includes("olx.com.br")) {
    return getOlxCarros;
  }
  if (lowerName.startsWith("webmotors") || lowerUrl.includes("webmotors.com.br")) {
    return getWebmotorsCarros;
  }

  return null;
}
