import { randomUUID } from "crypto";
import { getAdapter } from "../clients/db";
import type {
  CarroHistoryEventType,
  CarroRow,
  ListingRow,
} from "../clients/db-adapter";
import { Logger } from "../config/logger";
import type { CarroData } from "../models/carro";
import {
  doesCarMatchAlert,
  inferPortalName,
  type AlertCandidateCar,
} from "../services/alert-matcher";

export type {
  CarroHistoryRow,
  CarroRow,
  ListingRow,
  CrawlerRunRow,
} from "../clients/db-adapter";
export type { CarroData } from "../models/carro";

const PERIODIC_SNAPSHOT_MS = 24 * 60 * 60 * 1000;

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

function minPositive(...vals: Array<number | null | undefined>): number {
  let best = 0;
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      if (best === 0 || v < best) best = v;
    }
  }
  return best;
}

function maxPositive(...vals: Array<number | null | undefined>): number {
  let best = 0;
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      if (v > best) best = v;
    }
  }
  return best;
}

interface StructuredCarroFields {
  price: number;
  year: number;
  manufactureYear?: number;
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
    manufactureYear:
      typeof features.manufacture_year === "number" &&
      Number.isFinite(features.manufacture_year)
        ? features.manufacture_year
        : undefined,
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

async function evaluateAlertsForCar(params: {
  car: AlertCandidateCar;
  isNew: boolean;
  priceDropped: boolean;
  previousPrice?: number;
  now: Date;
}): Promise<void> {
  const { car, isNew, priceDropped, previousPrice, now } = params;
  if (!car.price || car.price <= 0) return;

  const db = getAdapter();
  const alerts = await db.getActiveCarAlerts();
  if (alerts.length === 0) return;

  const portal = inferPortalName(car.ref);

  for (const alert of alerts) {
    if (!doesCarMatchAlert(car, alert)) continue;

    if (isNew && !alert.notifyOnNew) continue;
    if (!isNew && !priceDropped) continue;
    if (!isNew && priceDropped && !alert.notifyOnPriceDrop) continue;

    const triggerType = priceDropped
      ? "price_drop"
      : alert.onlyBelowFipe
        ? "below_fipe"
        : "new_listing";
    const dedupKey = `${alert.id}::${car.ref}::${triggerType}::${Math.round(car.price)}`;

    const inserted = await db.insertAlertNotification({
      userId: alert.userId,
      alertId: alert.id,
      carroId: car.id,
      carRef: car.ref,
      carTitle: car.title,
      brand: car.brand ?? undefined,
      model: car.model ?? undefined,
      year: car.year ?? undefined,
      mileageKm: car.mileageKm ?? undefined,
      price: car.price,
      previousPrice: priceDropped ? previousPrice : undefined,
      fipePrice: car.fipePrice ?? undefined,
      fipeDiffPct: car.fipeDiffPct ?? undefined,
      portal,
      city: car.city ?? undefined,
      triggerType,
      dedupKey,
      triggeredAt: now,
    });

    await db.updateCarAlertStats(alert.id, {
      lastCheckedAt: now,
      ...(inserted ? { lastMatchedAt: now, matchesIncrement: 1 } : {}),
    });
  }
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
    const portal = inferPortalName(ref);

    const basePayload = {
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
      let prev: CarroRow | null = null;
      try {
        prev = await db.getCarroById(existing.id);
      } catch {
        prev = null;
      }

      const prevPrice = prev?.price ?? 0;
      const prevKm = prev?.mileageKm ?? 0;
      const priceChanged =
        prevPrice > 0 && structured.price > 0 && prevPrice !== structured.price;
      const priceDropped =
        prevPrice > 0 && structured.price > 0 && structured.price < prevPrice;
      const mileageChanged =
        prevKm >= 0 &&
        structured.mileageKm > 0 &&
        prevKm !== structured.mileageKm;

      const firstSeenAt = prev?.firstSeenAt ?? prev?.created ?? now;
      const initialPrice =
        prev?.initialPrice && prev.initialPrice > 0
          ? prev.initialPrice
          : prevPrice > 0
            ? prevPrice
            : structured.price;
      const lowestPrice = minPositive(
        prev?.lowestPrice,
        prevPrice,
        structured.price,
      );
      const highestPrice = maxPositive(
        prev?.highestPrice,
        prevPrice,
        structured.price,
      );
      const priceChangesCount =
        (prev?.priceChangesCount ?? 0) + (priceChanged ? 1 : 0);
      const lastPriceChangeAt = priceChanged
        ? now
        : (prev?.lastPriceChangeAt ?? null);

      await db.updateCarro(existing.id, {
        ...basePayload,
        firstSeenAt,
        lastSeenAt: now,
        initialPrice,
        lowestPrice,
        highestPrice,
        priceChangesCount,
        lastPriceChangeAt,
        listingStatus: "active",
      });

      try {
        if (structured.price > 0) {
          const latestSnap = await db.getLatestCarroHistorySnapshot(ref);
          const elapsedSinceSnap = latestSnap
            ? now.getTime() - latestSnap.recordedAt.getTime()
            : Number.POSITIVE_INFINITY;

          let eventType: CarroHistoryEventType | null = null;
          if (!latestSnap) {
            eventType = "first_seen";
          } else if (priceChanged) {
            eventType = "price_change";
          } else if (mileageChanged) {
            eventType = "mileage_change";
          } else if (elapsedSinceSnap >= PERIODIC_SNAPSHOT_MS) {
            eventType = "snapshot";
          }

          if (eventType) {
            await db.insertCarroHistory({
              carroId: existing.id,
              ref,
              idListing: idListingStr,
              portal,
              textDescription: text_description ?? null,
              brand: structured.brand,
              model: structured.model,
              version: structured.version,
              year: structured.year,
              manufactureYear: structured.manufactureYear,
              price: structured.price,
              previousPrice: prevPrice > 0 ? prevPrice : undefined,
              priceDelta:
                priceChanged && prevPrice > 0
                  ? structured.price - prevPrice
                  : 0,
              mileageKm: structured.mileageKm,
              previousMileageKm: prevKm > 0 ? prevKm : undefined,
              transmission: structured.transmission,
              fuel: structured.fuel,
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
              eventType,
              recordedAt: now,
            });
          }
        }
      } catch (err) {
        Logger.warn(
          { err: err instanceof Error ? err.message : String(err), ref },
          "Failed to record carro history snapshot",
        );
      }

      try {
        await evaluateAlertsForCar({
          car: {
            id: existing.id,
            ref,
            title:
              text_description ??
              ([structured.brand, structured.model, structured.version]
                .filter(Boolean)
                .join(" ") ||
                ref),
            brand: structured.brand,
            model: structured.model,
            version: structured.version,
            year: structured.year,
            price: structured.price,
            mileageKm: structured.mileageKm,
            transmission: structured.transmission,
            fuel: structured.fuel,
            isTurbo: structured.isTurbo,
            city: structured.city,
            neighborhood: structured.neighborhood,
            fipeCode: structured.fipeCode,
            fipeBrand: structured.fipeBrand,
            fipeModel: structured.fipeModel,
            fipePrice: structured.fipePrice,
            fipeDiffPct: structured.fipeDiffPct,
          },
          isNew: false,
          priceDropped,
          previousPrice: prevPrice,
          now,
        });
      } catch (err) {
        Logger.warn(
          { err: err instanceof Error ? err.message : String(err), ref },
          "Failed to evaluate car alerts on update",
        );
      }

      return { id: existing.id, ...carroData, ref };
    }

    const id = randomUUID();
    await db.insertCarro({
      id,
      ref,
      created: now,
      firstSeenAt: now,
      lastSeenAt: now,
      initialPrice: structured.price,
      lowestPrice: structured.price,
      highestPrice: structured.price,
      priceChangesCount: 0,
      lastPriceChangeAt: null,
      listingStatus: "active",
      ...basePayload,
    });

    try {
      if (structured.price > 0) {
        await db.insertCarroHistory({
          carroId: id,
          ref,
          idListing: idListingStr,
          portal,
          textDescription: text_description ?? null,
          brand: structured.brand,
          model: structured.model,
          version: structured.version,
          year: structured.year,
          manufactureYear: structured.manufactureYear,
          price: structured.price,
          mileageKm: structured.mileageKm,
          transmission: structured.transmission,
          fuel: structured.fuel,
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
          eventType: "first_seen",
          recordedAt: now,
        });
      }
    } catch (err) {
      Logger.warn(
        { err: err instanceof Error ? err.message : String(err), ref },
        "Failed to insert initial carro history snapshot",
      );
    }

    try {
      await evaluateAlertsForCar({
        car: {
          id,
          ref,
          title:
            text_description ??
            ([structured.brand, structured.model, structured.version]
              .filter(Boolean)
              .join(" ") ||
              ref),
          brand: structured.brand,
          model: structured.model,
          version: structured.version,
          year: structured.year,
          price: structured.price,
          mileageKm: structured.mileageKm,
          transmission: structured.transmission,
          fuel: structured.fuel,
          isTurbo: structured.isTurbo,
          city: structured.city,
          neighborhood: structured.neighborhood,
          fipeCode: structured.fipeCode,
          fipeBrand: structured.fipeBrand,
          fipeModel: structured.fipeModel,
          fipePrice: structured.fipePrice,
          fipeDiffPct: structured.fipeDiffPct,
        },
        isNew: true,
        priceDropped: false,
        now,
      });
    } catch (err) {
      Logger.warn(
        { err: err instanceof Error ? err.message : String(err), ref },
        "Failed to evaluate car alerts on insert",
      );
    }

    return { id, ...carroData, ref };
  }

  static async getHistoryByRef(ref: string, limit = 100) {
    return getAdapter().getCarroHistoryByRef(ref, limit);
  }

  static async backfillHistory(limit = 300) {
    return getAdapter().backfillMissingCarroHistory(limit);
  }

  static async getActiveStaleSince(
    seenBefore: Date,
    limit = 100,
    idListing?: string,
  ): Promise<CarroRow[]> {
    return getAdapter().getActiveCarrosStaleSince(seenBefore, limit, idListing);
  }

  static async touchLastSeen(id: string, now = new Date()): Promise<void> {
    await getAdapter().patchCarro(id, {
      lastSeenAt: now,
      updated: now,
    });
  }

  static async markListingInactive(
    carro: CarroRow,
    reason: string,
    now = new Date(),
  ): Promise<void> {
    const db = getAdapter();
    await db.patchCarro(carro.id, {
      listingStatus: "inactive",
      updated: now,
    });

    try {
      const price = carro.price ?? 0;
      if (price > 0) {
        await db.insertCarroHistory({
          carroId: carro.id,
          ref: carro.ref,
          idListing: carro.idListing,
          portal: inferPortalName(carro.ref),
          textDescription: carro.textDescription,
          brand: carro.brand ?? undefined,
          model: carro.model ?? undefined,
          version: carro.version ?? undefined,
          year: carro.year ?? 0,
          price,
          mileageKm: carro.mileageKm ?? 0,
          transmission: carro.transmission ?? undefined,
          fuel: carro.fuel ?? undefined,
          engineSize: carro.engineSize ?? undefined,
          isTurbo: carro.isTurbo,
          sellerType: carro.sellerType ?? undefined,
          neighborhood: carro.neighborhood ?? undefined,
          city: carro.city ?? undefined,
          state: carro.state ?? undefined,
          fipePrice: carro.fipePrice ?? undefined,
          fipeCode: carro.fipeCode ?? undefined,
          fipeBrand: carro.fipeBrand ?? undefined,
          fipeModel: carro.fipeModel ?? undefined,
          fipeYear: carro.fipeYear ?? undefined,
          fipeRefPeriod: carro.fipeRefPeriod ?? undefined,
          fipeDiffPct: carro.fipeDiffPct ?? undefined,
          eventType: "status_change",
          recordedAt: now,
        });
      }
    } catch (err) {
      Logger.warn(
        { err: err instanceof Error ? err.message : String(err), ref: carro.ref, reason },
        "Failed to record status_change history snapshot",
      );
    }
  }

  static async deactivateUnseenForListing(
    idListing: string,
    seenBefore: Date,
    limit = 500,
    now = new Date(),
  ): Promise<number> {
    const staleRows = await getAdapter().getActiveCarrosStaleSince(
      seenBefore,
      limit,
      idListing,
    );
    let count = 0;
    for (const row of staleRows) {
      await CarrosRepository.markListingInactive(
        row,
        "missing_from_complete_crawl",
        now,
      );
      count++;
    }
    return count;
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
      listingStatus:
        typeof updateData.listing_status === "string"
          ? updateData.listing_status
          : undefined,
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
