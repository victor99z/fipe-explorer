import {
  parseCurrencyToNumber,
  parseMileageToKm,
  parseYearPair,
} from "../utils/number";
import {
  inferBodyType,
  inferFuel,
  inferSellerType,
  inferTransmission,
  normalizeBrand,
  parseCarText,
} from "../utils/car-parser";
import {
  runScraper,
  type ExtractedCarListing,
  type ScraperOptions,
} from "./base-scraper";
import {
  buildQueryPageUrl,
  canonicalizeRefUrl,
  extractDomListings,
  extractJsonLdCarListings,
  extractNextDataScript,
  mergeListingsWithDom,
  normalizeImages,
  resolveListingUrl,
  type DomCardSelectors,
  type RawDomCarCard,
} from "./extractors";

const DEFAULT_URL =
  "https://www.olx.com.br/autos-e-pecas/estado-sc/norte-de-santa-catarina/joinville";

export const OLX_CAR_SELECTORS: DomCardSelectors = {
  cardSelector: 'section.olx-adcard, [data-ds-component="DS-AdCard"]',
  title: "h2",
  href: 'a[data-testid="adcard-link"], a.olx-adcard__link, a[href]',
  address: "p.olx-adcard__location, .olx-adcard__location",
  price: "h3.olx-adcard__price, [data-testid='adcard-price'], [class*='price']",
  details:
    ".olx-adcard__detail, [class*='adcard__detail'], [class*='labels'] span, ul li",
  seller: "[class*='pro'], [data-testid*='pro']",
  image: "img[src], img[data-src]",
};

export function parseOlxAddress(address: string): {
  city?: string;
  neighborhood?: string;
  state?: string;
} {
  const cleaned = address
    .replace(/\s*-\s*[A-Z]{2}\s*$/, (m) => `, ${m.replace("-", "").trim()}`)
    .trim();
  const parts = cleaned
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};

  const last = parts[parts.length - 1]!;
  let state: string | undefined;
  if (/^[A-Z]{2}$/.test(last)) {
    state = parts.pop();
  }

  if (parts.length === 0) return { state };
  if (parts.length === 1) return { city: parts[0], state };
  return {
    city: parts[0],
    neighborhood: parts.slice(1).join(", "),
    state,
  };
}

export function isValidOlxCarUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "olx.com.br" && !host.endsWith(".olx.com.br")) {
    return false;
  }

  if (url.pathname.startsWith("/vi/") || url.searchParams.has("rec")) {
    return false;
  }

  return /\/(autos-e-pecas|d)(\/|$)/i.test(url.pathname);
}

function filterOlxCarImages(candidates: string[], baseUrl: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawImg of candidates) {
    const trimmed = rawImg.trim();
    if (!trimmed || trimmed.startsWith("data:")) continue;
    const lower = trimmed.toLowerCase();
    if (
      lower.includes("verified_official_store") ||
      lower.includes("static.olx.com.br/sxp") ||
      lower.includes("/_next/image") ||
      lower.endsWith(".svg")
    ) {
      continue;
    }
    const resolved = resolveListingUrl(trimmed, baseUrl);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }

  return result;
}

export function mapOlxCarCard(
  raw: RawDomCarCard,
  baseUrl = DEFAULT_URL,
): ExtractedCarListing | null {
  const resolved = resolveListingUrl(raw.href, baseUrl);
  if (!resolved || !isValidOlxCarUrl(resolved)) return null;

  const ref = canonicalizeRefUrl(resolved);
  const price = parseCurrencyToNumber(raw.price);
  const parsed = parseCarText(raw.title, `${raw.details} ${raw.seller}`);
  const loc = parseOlxAddress(raw.address);
  const imageCandidates = raw.images?.length ? raw.images : raw.image ? [raw.image] : [];
  const images = filterOlxCarImages(imageCandidates, baseUrl);

  return {
    ref,
    text_description: raw.title,
    features: {
      price: Number.isFinite(price) && price > 0 ? price : 0,
      year: parsed.year,
      manufacture_year: parsed.manufacture_year,
      mileage_km: parsed.mileage_km,
      brand: parsed.brand,
      model: parsed.model,
      version: parsed.version,
      transmission: parsed.transmission,
      fuel: parsed.fuel,
      engine_size: parsed.engine_size,
      is_turbo: parsed.is_turbo,
      body_type: parsed.body_type,
      seller_type: parsed.seller_type ?? inferSellerType(raw.seller),
      neighborhood: loc.neighborhood,
      city: loc.city ?? "Joinville",
      state: loc.state ?? "SC",
      address: raw.address || undefined,
      title: raw.title,
    },
    images,
  };
}

export function parseOlxNextData(
  nextData: Record<string, unknown> | null,
  baseUrl = DEFAULT_URL,
): ExtractedCarListing[] {
  if (!nextData) return [];

  const props = nextData.props as Record<string, unknown> | undefined;
  const pageProps = props?.pageProps as Record<string, unknown> | undefined;
  const rawAds = Array.isArray(pageProps?.ads)
    ? (pageProps.ads as Array<Record<string, unknown>>)
    : [];

  const results: ExtractedCarListing[] = [];

  for (const ad of rawAds) {
    const rawUrl = typeof ad.url === "string" ? ad.url : "";
    const resolved = resolveListingUrl(rawUrl, baseUrl);
    if (!resolved || !isValidOlxCarUrl(resolved)) continue;

    const ref = canonicalizeRefUrl(resolved);
    const title = String(ad.subject ?? ad.title ?? "").trim();
    const price = parseCurrencyToNumber(
      typeof ad.price === "string" || typeof ad.price === "number"
        ? ad.price
        : undefined,
    );

    const propMap = new Map<string, string>();
    if (Array.isArray(ad.properties)) {
      for (const prop of ad.properties) {
        if (!prop || typeof prop !== "object") continue;
        const p = prop as Record<string, unknown>;
        const name = String(p.name ?? "").toLowerCase();
        const value = String(p.value ?? "").trim();
        if (name && value) propMap.set(name, value);
      }
    }

    const parsed = parseCarText(
      title,
      [...propMap.values()].join(" "),
    );

    const brand =
      normalizeBrand(propMap.get("vehicle_brand") ?? propMap.get("brand")) ??
      parsed.brand;
    const model =
      propMap.get("vehicle_model") ?? propMap.get("model") ?? parsed.model;
    const version =
      propMap.get("vehicle_version") ??
      propMap.get("version") ??
      parsed.version;
    const yearPair = parseYearPair(
      propMap.get("regdate") ?? propMap.get("year"),
    );
    const mileageKm =
      parseMileageToKm(propMap.get("mileage")) ?? parsed.mileage_km;
    const transmission =
      inferTransmission(propMap.get("gearbox") ?? "") ??
      propMap.get("gearbox") ??
      parsed.transmission;
    const fuel =
      inferFuel(propMap.get("fuel") ?? "") ??
      propMap.get("fuel") ??
      parsed.fuel;
    const color = propMap.get("carcolor") ?? propMap.get("color");
    const bodyType =
      inferBodyType(propMap.get("cartype") ?? "") ??
      propMap.get("cartype") ??
      parsed.body_type;

    const locationStr = typeof ad.location === "string" ? ad.location : "";
    const locObj =
      ad.locationDetails && typeof ad.locationDetails === "object"
        ? (ad.locationDetails as Record<string, unknown>)
        : undefined;
    const locParsed = parseOlxAddress(locationStr);

    const sellerType =
      ad.professionalAd === true
        ? "Loja"
        : ad.professionalAd === false
          ? "Particular"
          : parsed.seller_type;

    results.push({
      ref,
      text_description: title,
      features: {
        price: Number.isFinite(price) && price > 0 ? price : 0,
        year: yearPair.modelYear ?? parsed.year,
        manufacture_year: yearPair.manufactureYear ?? parsed.manufacture_year,
        mileage_km: mileageKm,
        brand,
        model,
        version,
        transmission,
        fuel,
        color,
        body_type: bodyType,
        engine_size: parsed.engine_size,
        is_turbo: parsed.is_turbo,
        seller_type: sellerType,
        neighborhood:
          (typeof locObj?.neighbourhood === "string"
            ? locObj.neighbourhood
            : undefined) ?? locParsed.neighborhood,
        city:
          (typeof locObj?.municipality === "string"
            ? locObj.municipality
            : undefined) ??
          locParsed.city ??
          "Joinville",
        state:
          (typeof locObj?.uf === "string" ? locObj.uf : undefined) ??
          locParsed.state ??
          "SC",
        address: locationStr || undefined,
        title,
        listing_code:
          ad.listId !== undefined ? String(ad.listId) : undefined,
      },
      images: normalizeImages(ad.images, ad.thumbnail),
    });
  }

  return results;
}

export const getOlxCarros = (
  idListing: string,
  runId: number,
  startPage = 1,
  opts?: ScraperOptions,
) => {
  const siteUrl = opts?.siteUrl ?? DEFAULT_URL;
  return runScraper(
    {
      siteName: "OLX Carros",
      siteUrl,
      delayMs: opts?.delayMs,
      buildPageUrl: buildQueryPageUrl("o"),
      extract: async (page) => {
        const nextData = await extractNextDataScript(page);
        const fromNextData = parseOlxNextData(nextData, siteUrl);
        const fromJsonLd = (await extractJsonLdCarListings(page, 600)).filter(
          (item) => isValidOlxCarUrl(item.ref),
        );
        const fromDom = await extractDomListings(
          page,
          OLX_CAR_SELECTORS,
          (raw) => mapOlxCarCard(raw, siteUrl),
        );
        return mergeListingsWithDom(
          mergeListingsWithDom(fromNextData, fromJsonLd),
          fromDom,
        );
      },
    },
    idListing,
    runId,
    startPage,
    opts,
  );
};
