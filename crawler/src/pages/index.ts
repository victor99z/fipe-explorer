import type { ScraperRunner } from "./base-scraper";
import { getOlxCarros } from "./olx-carros";
import { getWebmotorsCarros } from "./webmotors-carros";

export const SCRAPER_REGISTRY: Record<string, ScraperRunner> = {
  "olx-carros": getOlxCarros,
  "webmotors-carros": getWebmotorsCarros,
};
