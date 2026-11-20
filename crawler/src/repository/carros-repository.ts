import { randomUUID } from "crypto";
import { getAdapter } from "../clients/db";
import type { ListingRow } from "../clients/db-adapter";
import type { CarroData } from "../models/carro";

export type { CarroRow, ListingRow, CrawlerRunRow } from "../clients/db-adapter";
export type { CarroData } from "../models/carro";

function serializeFeatures(features: CarroData["features"]): string | null {
  if (features == null) return null;
  return typeof features === "string" ? features : JSON.stringify(features);
}

function serializeImages(images: string[] | undefined): string {
  return JSON.stringify(
    Array.isArray(images) ? images : images ? [images] : [],
  );
}

function finiteOrZero(val: unknown): number {
  return typeof val === "number" && Number.isFinite(val) ? val : 0;
}

function nonEmptyString(val: unknown): string | undefined {
  return typeof val === "string" && val.trim().length > 0
    ? val.trim()
    : undefined;
}

interface StructuredCarroFields {
  price: number;
  year: number;
  mileageKm: number;
  brand?: string;
  model?: string;
  version?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  bodyType?: string;
  engineSize?: string;
  isTurbo?: boolean;
  sellerType?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  fipePrice?: number;
  fipeCode?: string;
  fipeBrand?: string;
  fipeModel?: string;
  fipeYear?: number;
  fipeRefPeriod?: string;
  fipeDiffPct?: number;
}

function extractStructuredFields(
  featuresJson: string | null,
): StructuredCarroFields {
  const empty: StructuredCarroFields = {
    price: 0,
    year: 0,
    mileageKm: 0,
  };
  if (!featuresJson) return empty;

  let features: Record<string, unknown>;
  try {
    const parsed = JSON.parse(featuresJson);
    if (!parsed || typeof parsed !== "object") return empty;
    features = parsed as Record<string, unknown>;
  } catch {
    return empty;
  }

  return {
    price: finiteOrZero(features.price),
    year: finiteOrZero(features.year),
    mileageKm: finiteOrZero(features.mileage_km),
    brand: nonEmptyString(features.brand),
    model: nonEmptyString(features.model),
    version: nonEmptyString(features.version),
    transmission: nonEmptyString(features.transmission),
    fuel: nonEmptyString(features.fuel),
    color: nonEmptyString(features.color),
    bodyType: nonEmptyString(features.body_type),
    engineSize: nonEmptyString(features.engine_size),
    isTurbo: typeof features.is_turbo === "boolean" ? features.is_turbo : false,
    sellerType: nonEmptyString(features.seller_type),
    neighborhood: nonEmptyString(features.neighborhood),
    city: nonEmptyString(features.city),
    state: nonEmptyString(features.state),
    fipePrice:
      typeof features.fipe_price === "number" &&
      Number.isFinite(features.fipe_price)
        ? features.fipe_price
        : undefined,
    fipeCode: nonEmptyString(features.fipe_code),
    fipeBrand: nonEmptyString(features.fipe_brand),
    fipeModel: nonEmptyString(features.fipe_model),
    fipeYear:
      typeof features.fipe_year === "number" &&
      Number.isFinite(features.fipe_year)
        ? features.fipe_year
        : undefined,
    fipeRefPeriod: nonEmptyString(features.fipe_ref_period),
    fipeDiffPct:
      typeof features.fipe_diff_pct === "number" &&
      Number.isFinite(features.fipe_diff_pct)
        ? features.fipe_diff_pct
        : undefined,
  };
}

export class CarrosRepository {
  static async create(carroData: CarroData) {
    const ref = carroData.ref?.trim();
    if (!ref) {
      throw new Error("Carro ref is required");
    }

    const { text_description, features, id_listing, images } = carroData;
    const now = new Date();
    const featuresJson = serializeFeatures(features);
    const imagesJson = serializeImages(images);
    const idListingStr = Array.isArray(id_listing)
      ? (id_listing[0] ?? null)
      : (id_listing ?? null);
    const structured = extractStructuredFields(featuresJson);
    const db = getAdapter();

    const payload = {
      textDescription: text_description ?? null,
      features: featuresJson,
      idListing: idListingStr,
      images: imagesJson,
      updated: now,
      price: structured.price,
      year: structured.year,
      mileageKm: structured.mileageKm,
      brand: structured.brand,
      model: structured.model,
      version: structured.version,
      transmission: structured.transmission,
      fuel: structured.fuel,
      color: structured.color,
      bodyType: structured.bodyType,
      engineSize: structured.engineSize,
      isTurbo: structured.isTurbo,
      sellerType: structured.sellerType,
      neighborhood: structured.neighborhood,
      city: structured.city,
      state: structured.state,
      fipePrice: structured.fipePrice,
      fipeCode: structured.fipeCode,
      fipeBrand: structured.fipeBrand,
      fipeModel: structured.fipeModel,
      fipeYear: structured.fipeYear,
      fipeRefPeriod: structured.fipeRefPeriod,
      fipeDiffPct: structured.fipeDiffPct,
    };

    const existing = await db.findCarroByRef(ref);
    if (existing) {
      await db.updateCarro(existing.id, payload);
      return { id: existing.id, ...carroData, ref };
    }

    const id = randomUUID();
    await db.insertCarro({
      id,
      ref,
      created: now,
      ...payload,
    });
    return { id, ...carroData, ref };
  }

  static async getListingById(id: string): Promise<ListingRow> {
    const row = await getAdapter().getListingById(id);
    if (!row) throw new Error(`Listing not found: ${id}`);
    return row;
  }

  static async getAllListings(): Promise<ListingRow[]> {
    return getAdapter().getAllListings();
  }

  static async updateListing(id: string, updateData: Record<string, unknown>) {
    await getAdapter().updateListing(id, {
      name: updateData.name as string,
      active:
        typeof updateData.active === "boolean"
          ? updateData.active
          : updateData.active === 1,
      lastPage:
        (updateData.lastPage as number) ??
        (updateData.last_page as number) ??
        1,
      url: (updateData.url as string) ?? null,
      maxPages:
        (updateData.maxPages as number) ??
        (updateData.max_pages as number) ??
        50,
      delayMs:
        (updateData.delayMs as number) ??
        (updateData.delay_ms as number) ??
        2500,
    });
    return { id, ...updateData };
  }

  static async getById(id: string) {
    return getAdapter().getCarroById(id);
  }

  static async getByRef(ref: string) {
    return getAdapter().getCarrosByRef(ref);
  }

  static async update(id: string, updateData: Record<string, unknown>) {
    await getAdapter().patchCarro(id, {
      textDescription:
        updateData.text_description !== undefined
          ? (updateData.text_description as string | null)
          : undefined,
      features:
        updateData.features !== undefined
          ? serializeFeatures(updateData.features as CarroData["features"])
          : undefined,
      isFavorite:
        typeof updateData.is_favorite === "boolean"
          ? updateData.is_favorite
          : undefined,
      isHidden:
        typeof updateData.is_hidden === "boolean"
          ? updateData.is_hidden
          : undefined,
      notes:
        typeof updateData.notes === "string" ? updateData.notes : undefined,
      updated: new Date(),
    });
    return { id, ...updateData };
  }

  static async delete(id: string) {
    return getAdapter().deleteCarro(id);
  }

  static async deleteAllInBatch() {
    const deleted = await getAdapter().deleteAllCarros();
    return { deleted };
  }

  static async deleteInvalidOlxInBatch() {
    const deleted = await getAdapter().deleteInvalidOlxCarros();
    return { deleted };
  }
}
