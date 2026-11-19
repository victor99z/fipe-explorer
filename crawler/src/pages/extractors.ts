import type { Page } from "puppeteer";
import { parseCurrencyToNumber, parseMileageToKm, parseYearPair } from "../utils/number";
import {
  inferBodyType,
  inferFuel,
  inferTransmission,
  normalizeBrand,
  parseCarText,
} from "../utils/car-parser";
import type { ExtractedCarListing } from "./base-scraper";

export interface DomCardSelectors {
  cardSelector: string;
  title?: string;
  href?: string;
  address?: string;
  price?: string;
  details?: string;
  seller?: string;
  image?: string;
}

export interface RawDomCarCard {
  title: string;
  href: string;
  address: string;
  price: string;
  details: string;
  seller: string;
  image: string;
  images?: string[];
}

export function buildQueryPageUrl(paramName: string) {
  return (base: string, page: number): string => {
    const url = new URL(base);
    url.searchParams.set(paramName, String(page));
    return url.toString();
  };
}

export function resolveListingUrl(rawHref: string, baseUrl: string): string {
  const trimmed = rawHref.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return "";
  }
}

export function canonicalizeRefUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function collectImageUrls(source: unknown, acc: Set<string>): void {
  if (!source) return;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (/^https?:\/\//i.test(trimmed)) acc.add(trimmed);
    return;
  }
  if (Array.isArray(source)) {
    for (const item of source) collectImageUrls(item, acc);
    return;
  }
  if (typeof source === "object") {
    const obj = source as Record<string, unknown>;
    collectImageUrls(
      obj.original ?? obj.url ?? obj.contentUrl ?? obj.src ?? obj.imageUrl,
      acc,
    );
  }
}

export function normalizeImages(...sources: unknown[]): string[] {
  const acc = new Set<string>();
  for (const src of sources) collectImageUrls(src, acc);
  return [...acc];
}

function pickPositive(
  primary: number | undefined,
  secondary: number | undefined,
): number | undefined {
  if (typeof primary === "number" && Number.isFinite(primary) && primary > 0) {
    return primary;
  }
  if (
    typeof secondary === "number" &&
    Number.isFinite(secondary) &&
    secondary > 0
  ) {
    return secondary;
  }
  return primary ?? secondary;
}

function pickString(
  primary: string | undefined,
  secondary: string | undefined,
): string | undefined {
  const p = typeof primary === "string" ? primary.trim() : "";
  if (p) return p;
  const s = typeof secondary === "string" ? secondary.trim() : "";
  return s || undefined;
}

function mergeTwoCarListings(
  base: ExtractedCarListing,
  incoming: ExtractedCarListing,
): ExtractedCarListing {
  return {
    ref: base.ref,
    text_description:
      pickString(base.text_description, incoming.text_description) ?? "",
    features: {
      ...incoming.features,
      ...base.features,
      price:
        pickPositive(base.features.price, incoming.features.price) ?? 0,
      year: pickPositive(base.features.year, incoming.features.year),
      manufacture_year: pickPositive(
        base.features.manufacture_year,
        incoming.features.manufacture_year,
      ),
      mileage_km: pickPositive(
        base.features.mileage_km,
        incoming.features.mileage_km,
      ),
      fipe_price: pickPositive(
        base.features.fipe_price,
        incoming.features.fipe_price,
      ),
      brand: pickString(base.features.brand, incoming.features.brand),
      model: pickString(base.features.model, incoming.features.model),
      version: pickString(base.features.version, incoming.features.version),
      transmission: pickString(
        base.features.transmission,
        incoming.features.transmission,
      ),
      fuel: pickString(base.features.fuel, incoming.features.fuel),
      color: pickString(base.features.color, incoming.features.color),
      body_type: pickString(
        base.features.body_type,
        incoming.features.body_type,
      ),
      engine_size: pickString(
        base.features.engine_size,
        incoming.features.engine_size,
      ),
      seller_type: pickString(
        base.features.seller_type,
        incoming.features.seller_type,
      ),
      neighborhood: pickString(
        base.features.neighborhood,
        incoming.features.neighborhood,
      ),
      city: pickString(base.features.city, incoming.features.city),
      state: pickString(base.features.state, incoming.features.state),
      address: pickString(base.features.address, incoming.features.address),
      title: pickString(base.features.title, incoming.features.title),
    },
    images:
      base.images && base.images.length > 0
        ? base.images
        : (incoming.images ?? []),
  };
}

export function mergeListingsWithDom(
  primary: ExtractedCarListing[],
  secondary: ExtractedCarListing[],
): ExtractedCarListing[] {
  const byRef = new Map<string, ExtractedCarListing>();
  for (const item of primary) {
    const existing = byRef.get(item.ref);
    byRef.set(item.ref, existing ? mergeTwoCarListings(existing, item) : item);
  }
  for (const item of secondary) {
    const existing = byRef.get(item.ref);
    byRef.set(item.ref, existing ? mergeTwoCarListings(existing, item) : item);
  }
  return [...byRef.values()];
}

export function flattenJsonLdBlocks(
  blocks: unknown[],
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const pushBlock = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return;
    if (Array.isArray(entry)) {
      for (const item of entry) pushBlock(item);
      return;
    }
    const obj = entry as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      for (const graphItem of obj["@graph"]) pushBlock(graphItem);
    }
    result.push(obj);
  };
  for (const b of blocks) pushBlock(b);
  return result;
}

const VEHICLE_TYPES = new Set(["Car", "Vehicle", "Product", "Offer"]);

function extractCarFromJsonLdNode(
  node: Record<string, unknown>,
  fallbackUrl?: string,
): ExtractedCarListing | null {
  const offers =
    node.offers && typeof node.offers === "object"
      ? (node.offers as Record<string, unknown>)
      : undefined;

  const rawRef = String(
    node.url || offers?.url || fallbackUrl || "",
  ).trim();
  if (!rawRef) return null;

  let ref = rawRef;
  try {
    ref = canonicalizeRefUrl(rawRef);
  } catch {
    return null;
  }

  const title = String(node.name || "").trim();
  const desc = typeof node.description === "string" ? node.description : "";
  const parsed = parseCarText(title, desc);

  const brandObj =
    node.brand && typeof node.brand === "object"
      ? (node.brand as Record<string, unknown>)
      : undefined;
  const brand =
    normalizeBrand(
      typeof brandObj?.name === "string"
        ? brandObj.name
        : typeof node.brand === "string"
          ? node.brand
          : undefined,
    ) ?? parsed.brand;

  const model =
    (typeof node.model === "string" ? node.model.trim() : undefined) ??
    parsed.model;

  const yearPair = parseYearPair(
    typeof node.vehicleModelDate === "string" ||
      typeof node.vehicleModelDate === "number"
      ? node.vehicleModelDate
      : typeof node.productionDate === "string"
        ? node.productionDate
        : undefined,
  );

  const odoObj =
    node.mileageFromOdometer && typeof node.mileageFromOdometer === "object"
      ? (node.mileageFromOdometer as Record<string, unknown>)
      : undefined;
  const mileageKm =
    parseMileageToKm(
      (odoObj?.value as string | number | undefined) ??
        (node.mileageFromOdometer as string | number | undefined),
    ) ?? parsed.mileage_km;

  const priceRaw = offers?.price ?? node.price;
  const price = parseCurrencyToNumber(
    typeof priceRaw === "string" || typeof priceRaw === "number"
      ? priceRaw
      : undefined,
  );

  const transmission =
    (typeof node.vehicleTransmission === "string"
      ? inferTransmission(node.vehicleTransmission) ??
        node.vehicleTransmission.trim()
      : undefined) ?? parsed.transmission;

  const fuel =
    (typeof node.fuelType === "string"
      ? inferFuel(node.fuelType) ?? node.fuelType.trim()
      : undefined) ?? parsed.fuel;

  const bodyType =
    (typeof node.bodyType === "string"
      ? inferBodyType(node.bodyType) ?? node.bodyType.trim()
      : undefined) ?? parsed.body_type;

  const color =
    typeof node.color === "string" && node.color.trim()
      ? node.color.trim()
      : undefined;

  return {
    ref,
    text_description: title || desc,
    features: {
      price: Number.isFinite(price) && price > 0 ? price : 0,
      year: yearPair.modelYear ?? parsed.year,
      manufacture_year: yearPair.manufactureYear ?? parsed.manufacture_year,
      mileage_km: mileageKm,
      brand,
      model,
      version: parsed.version,
      transmission,
      fuel,
      color,
      body_type: bodyType,
      engine_size: parsed.engine_size,
      is_turbo: parsed.is_turbo,
      title: title || undefined,
    },
    images: normalizeImages(node.image),
  };
}

export function parseCarJsonLdBlocks(blocks: unknown[]): ExtractedCarListing[] {
  const listings: ExtractedCarListing[] = [];

  for (const block of flattenJsonLdBlocks(blocks)) {
    const rawType = block["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];

    if (types.includes("ItemList") && Array.isArray(block.itemListElement)) {
      for (const el of block.itemListElement) {
        if (!el || typeof el !== "object") continue;
        const listObj = el as Record<string, unknown>;
        const item =
          listObj.item && typeof listObj.item === "object"
            ? (listObj.item as Record<string, unknown>)
            : listObj;
        const mapped = extractCarFromJsonLdNode(
          item,
          typeof listObj.url === "string" ? listObj.url : undefined,
        );
        if (mapped) listings.push(mapped);
      }
      continue;
    }

    if (types.some((t) => typeof t === "string" && VEHICLE_TYPES.has(t))) {
      const mapped = extractCarFromJsonLdNode(block);
      if (mapped) listings.push(mapped);
    }
  }

  return mergeListingsWithDom(listings, []);
}

export async function extractJsonLdCarListings(
  page: Page,
  waitMs = 1000,
): Promise<ExtractedCarListing[]> {
  if (waitMs > 0) {
    await page.evaluate(
      (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      waitMs,
    );
  }

  const blocks = await page.evaluate(() => {
    const scripts = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
    );
    return scripts
      .map((el) => {
        try {
          return JSON.parse(el.textContent ?? "{}");
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  });

  return parseCarJsonLdBlocks(blocks);
}

export async function extractNextDataScript(
  page: Page,
): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const el = document.querySelector("#__NEXT_DATA__");
    if (!el?.textContent) return null;
    try {
      return JSON.parse(el.textContent) as Record<string, unknown>;
    } catch {
      return null;
    }
  });
}

export async function extractDomCarCards(
  page: Page,
  selectors: DomCardSelectors,
): Promise<RawDomCarCard[]> {
  return page.$$eval(
    selectors.cardSelector,
    (elements, sel) => {
      const readText = (el: Element, query?: string): string => {
        if (!query) return "";
        return el.querySelector(query)?.textContent?.trim() ?? "";
      };

      const readAllText = (el: Element, query?: string): string => {
        if (!query) return "";
        return Array.from(el.querySelectorAll(query))
          .flatMap((n) => [
            n.getAttribute("aria-label")?.trim() ?? "",
            n.textContent?.trim() ?? "",
          ])
          .filter(Boolean)
          .join(" ");
      };

      return elements.map((el) => {
        const hrefEl = sel.href ? el.querySelector(sel.href) : null;
        const href =
          hrefEl?.getAttribute("href") ??
          (el.tagName === "A" ? el.getAttribute("href") : null) ??
          "";

        const imgEls = sel.image ? Array.from(el.querySelectorAll(sel.image)) : [];
        const imgs = imgEls
          .map((imgEl) =>
            (
              imgEl.getAttribute("src") ??
              imgEl.getAttribute("data-src") ??
              imgEl.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0] ??
              ""
            ).trim(),
          )
          .filter(Boolean);

        return {
          title: readText(el, sel.title),
          href: href.trim(),
          address: readText(el, sel.address),
          price: readText(el, sel.price),
          details: readAllText(el, sel.details),
          seller: readText(el, sel.seller),
          image: imgs[0] ?? "",
          images: imgs,
        };
      });
    },
    selectors,
  );
}

export async function extractDomListings(
  page: Page,
  selectors: DomCardSelectors,
  mapper: (raw: RawDomCarCard) => ExtractedCarListing | null,
): Promise<ExtractedCarListing[]> {
  const raws = await extractDomCarCards(page, selectors);
  return raws
    .map((raw) => mapper(raw))
    .filter(
      (item): item is ExtractedCarListing =>
        item !== null && item.ref.length > 0,
    );
}

export async function detectAntiBotChallenge(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const title = (document.title || "").toLowerCase();
    const bodyText = (document.body?.innerText || "").slice(0, 1200).toLowerCase();

    if (
      title.includes("attention required") ||
      bodyText.includes("sorry, you have been blocked") ||
      bodyText.includes("enable_cookies") ||
      document.querySelector("#cf-wrapper, #challenge-form")
    ) {
      return "Cloudflare block or challenge";
    }
    if (
      bodyText.includes("px-captcha") ||
      title.includes("access to this page has been denied") ||
      document.querySelector("#px-captcha")
    ) {
      return "PerimeterX captcha/challenge";
    }
    return null;
  });
}
