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
import { inferLocationFromUrl } from "../utils/location";
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
  "https://www.webmotors.com.br/carros/sc-joinville=1?tipoveiculo=carros&estadocidade=Santa%20Catarina-joinville%3D1&page=1";

export const WEBMOTORS_CAR_SELECTORS: DomCardSelectors = {
  cardSelector:
    'div[data-testid*="vehicle-card"], div[class*="ContainerCard"], article:has(a[href*="/comprar/"]), div:has(> a[href*="/comprar/"])',
  title: "h2, [data-testid*='vehicle-name'], [class*='Title']",
  href: 'a[href*="/comprar/"]',
  address: "[class*='Location'], [data-testid*='location'], address",
  price:
    "[data-testid*='price'], [class*='Price'], strong:has-text('R$'), h3",
  details: "[class*='Details'], [class*='Spec'], [class*='Info'] span, li",
  seller: "[class*='Seller'], [data-testid*='seller']",
  image: "img[src], img[data-src]",
};

export function isValidWebmotorsCarUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "webmotors.com.br" && !host.endsWith(".webmotors.com.br")) {
    return false;
  }
  return /\/comprar\//i.test(url.pathname);
}

function parseWebmotorsLocation(rawAddress: string): {
  city?: string;
  state?: string;
} {
  const cleaned = rawAddress.trim();
  if (!cleaned) return {};
  const match = cleaned.match(/^(.+?)\s*[-/,]\s*([A-Z]{2})$/i);
  if (match?.[1] && match?.[2]) {
    return {
      city: match[1].trim(),
      state: match[2].toUpperCase(),
    };
  }
  return { city: cleaned };
}

export function mapWebmotorsCarCard(
  raw: RawDomCarCard,
  baseUrl = DEFAULT_URL,
): ExtractedCarListing | null {
  const resolved = resolveListingUrl(raw.href, baseUrl);
  if (!resolved || !isValidWebmotorsCarUrl(resolved)) return null;

  const ref = canonicalizeRefUrl(resolved);
  const price = parseCurrencyToNumber(raw.price);
  const parsed = parseCarText(raw.title, `${raw.details} ${raw.seller}`);
  const loc = parseWebmotorsLocation(raw.address);
  const urlLoc = inferLocationFromUrl(baseUrl);

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
      city: loc.city ?? urlLoc.city ?? "Joinville",
      state: loc.state ?? urlLoc.state ?? "SC",
      address: raw.address || undefined,
      title: raw.title,
    },
    images: raw.image ? [raw.image] : [],
  };
}

function readNestedValue(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  const val = record[key];
  if (typeof val === "string" && val.trim()) return val.trim();
  if (val && typeof val === "object") {
    const inner = (val as Record<string, unknown>).Value ??
      (val as Record<string, unknown>).value ??
      (val as Record<string, unknown>).Name ??
      (val as Record<string, unknown>).name;
    if (typeof inner === "string" && inner.trim()) return inner.trim();
  }
  return undefined;
}

function findWebmotorsSearchResults(
  root: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const props = root.props as Record<string, unknown> | undefined;
  const pageProps = props?.pageProps as Record<string, unknown> | undefined;
  if (!pageProps) return [];

  const candidates = [
    pageProps.vehicles,
    pageProps.ads,
    pageProps.results,
    (pageProps.searchResult as Record<string, unknown> | undefined)
      ?.SearchResults,
    (pageProps.initialState as Record<string, unknown> | undefined)?.vehicles,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      return c.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      );
    }
  }
  return [];
}

function buildWebmotorsUrlFromVehicle(
  v: Record<string, unknown>,
  baseUrl: string,
): string | null {
  const direct =
    typeof v.url === "string"
      ? v.url
      : typeof v.Url === "string"
        ? v.Url
        : typeof v.link === "string"
          ? v.link
          : "";
  if (direct) {
    const resolved = resolveListingUrl(direct, baseUrl);
    if (resolved && isValidWebmotorsCarUrl(resolved)) {
      return canonicalizeRefUrl(resolved);
    }
  }

  const uniqueId = v.UniqueId ?? v.Id ?? v.id;
  const spec =
    v.Specification && typeof v.Specification === "object"
      ? (v.Specification as Record<string, unknown>)
      : undefined;
  const make = readNestedValue(spec, "Make") ?? "";
  const model = readNestedValue(spec, "Model") ?? "";
  const yearModel = spec?.YearModel ? String(spec.YearModel) : "";
  if (uniqueId && make && model) {
    const slug = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const path = `/comprar/${slug(make)}/${slug(model)}/${yearModel || "usado"}/${uniqueId}`;
    return canonicalizeRefUrl(new URL(path, "https://www.webmotors.com.br").toString());
  }

  return null;
}

export function parseWebmotorsNextData(
  nextData: Record<string, unknown> | null,
  baseUrl = DEFAULT_URL,
): ExtractedCarListing[] {
  if (!nextData) return [];

  const vehicles = findWebmotorsSearchResults(nextData);
  const urlLoc = inferLocationFromUrl(baseUrl);
  const results: ExtractedCarListing[] = [];

  for (const v of vehicles) {
    const ref = buildWebmotorsUrlFromVehicle(v, baseUrl);
    if (!ref) continue;

    const spec =
      v.Specification && typeof v.Specification === "object"
        ? (v.Specification as Record<string, unknown>)
        : v;
    const prices =
      v.Prices && typeof v.Prices === "object"
        ? (v.Prices as Record<string, unknown>)
        : v;
    const seller =
      v.Seller && typeof v.Seller === "object"
        ? (v.Seller as Record<string, unknown>)
        : undefined;
    const media =
      v.Media && typeof v.Media === "object"
        ? (v.Media as Record<string, unknown>)
        : undefined;

    const brand = normalizeBrand(
      readNestedValue(spec, "Make") ?? readNestedValue(spec, "brand"),
    );
    const model =
      readNestedValue(spec, "Model") ?? readNestedValue(spec, "model");
    const version =
      readNestedValue(spec, "Version") ?? readNestedValue(spec, "version");
    const title =
      (typeof spec.Title === "string" && spec.Title.trim()) ||
      [brand, model, version].filter(Boolean).join(" ") ||
      String(v.title ?? "").trim();

    const parsed = parseCarText(title);

    const price = parseCurrencyToNumber(
      (prices.Price as string | number | undefined) ??
        (prices.price as string | number | undefined),
    );
    const fipePrice = parseCurrencyToNumber(
      (prices.FipePrice as string | number | undefined) ??
        (prices.Fipe as string | number | undefined),
    );

    const yearPair = parseYearPair(
      spec.YearModel && spec.YearFabrication
        ? `${spec.YearFabrication}/${spec.YearModel}`
        : ((spec.YearModel ?? spec.year) as string | number | undefined),
    );

    const mileageKm =
      parseMileageToKm(
        (spec.Odometer ?? spec.Mileage ?? spec.km) as
          | string
          | number
          | undefined,
      ) ?? parsed.mileage_km;

    const transmissionRaw =
      readNestedValue(spec, "Transmission") ??
      readNestedValue(spec, "transmission");
    const transmission =
      (transmissionRaw ? inferTransmission(transmissionRaw) ?? transmissionRaw : undefined) ??
      parsed.transmission;

    const fuelRaw =
      readNestedValue(spec, "Fuel") ?? readNestedValue(spec, "fuel");
    const fuel =
      (fuelRaw ? inferFuel(fuelRaw) ?? fuelRaw : undefined) ?? parsed.fuel;

    const color =
      readNestedValue(spec, "Color") ?? readNestedValue(spec, "color");
    const bodyRaw =
      readNestedValue(spec, "BodyType") ?? readNestedValue(spec, "bodyType");
    const bodyType =
      (bodyRaw ? inferBodyType(bodyRaw) ?? bodyRaw : undefined) ??
      parsed.body_type;

    const sellerTypeRaw =
      (typeof seller?.SellerType === "string" ? seller.SellerType : undefined) ??
      (typeof seller?.AdType === "string" ? seller.AdType : undefined);
    const sellerType = sellerTypeRaw
      ? inferSellerType(sellerTypeRaw) ?? sellerTypeRaw
      : undefined;

    const city =
      (typeof seller?.City === "string" && seller.City.trim()
        ? seller.City.trim()
        : undefined) ??
      urlLoc.city ??
      "Joinville";
    const state =
      (typeof seller?.State === "string" && seller.State.trim()
        ? seller.State.trim()
        : undefined) ??
      urlLoc.state ??
      "SC";
    const neighborhood =
      typeof seller?.Neighborhood === "string"
        ? seller.Neighborhood.trim()
        : undefined;

    const photos = Array.isArray(media?.Photos)
      ? (media.Photos as Array<Record<string, unknown>>).map((p) => {
          const path = typeof p.PhotoPath === "string" ? p.PhotoPath : "";
          if (path && !/^https?:\/\//i.test(path)) {
            return `https://image.webmotors.com.br/_fotos/anunciousados/gigante/${path}`;
          }
          return path || p.url || p.src;
        })
      : [];

    results.push({
      ref,
      text_description: title,
      features: {
        price: Number.isFinite(price) && price > 0 ? price : 0,
        year: yearPair.modelYear ?? parsed.year,
        manufacture_year: yearPair.manufactureYear ?? parsed.manufacture_year,
        mileage_km: mileageKm,
        brand: brand ?? parsed.brand,
        model: model ?? parsed.model,
        version: version ?? parsed.version,
        transmission,
        fuel,
        color,
        body_type: bodyType,
        engine_size: parsed.engine_size,
        is_turbo: parsed.is_turbo,
        seller_type: sellerType,
        fipe_price:
          Number.isFinite(fipePrice) && fipePrice > 0 ? fipePrice : undefined,
        neighborhood,
        city,
        state,
        title,
        listing_code:
          v.UniqueId !== undefined
            ? String(v.UniqueId)
            : v.Id !== undefined
              ? String(v.Id)
              : undefined,
      },
      images: normalizeImages(photos, v.images, v.thumbnail),
    });
  }

  return results;
}

export const getWebmotorsCarros = (
  idListing: string,
  runId: number,
  startPage = 1,
  opts?: ScraperOptions,
) => {
  const siteUrl = opts?.siteUrl ?? DEFAULT_URL;
  return runScraper(
    {
      siteName: opts?.siteLabel ?? "Webmotors Carros",
      siteUrl,
      delayMs: opts?.delayMs,
      buildPageUrl: buildQueryPageUrl("page"),
      extract: async (page) => {
        const nextData = await extractNextDataScript(page);
        const fromNextData = parseWebmotorsNextData(nextData, siteUrl);
        const fromJsonLd = (await extractJsonLdCarListings(page, 600)).filter(
          (item) => isValidWebmotorsCarUrl(item.ref),
        );
        const fromDom = await extractDomListings(
          page,
          WEBMOTORS_CAR_SELECTORS,
          (raw) => mapWebmotorsCarCard(raw, siteUrl),
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
