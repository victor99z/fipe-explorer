import PocketBase, { ClientResponseError } from "pocketbase";
import { Logger } from "../config/logger";
import { isNonCarListing } from "../utils/car-parser";
import { DownloadImageAndCreateFile } from "../utils/download-image";
import {
  DEFAULT_OLX_CARS_URL,
  DEFAULT_SEED_LISTINGS,
  LEGACY_OLX_CARS_URL,
  LEGACY_OLX_JOINVILLE_URL,
  type CarAlertNotificationInsert,
  type CarAlertRow,
  type CarroFipePatch,
  type CarroHistoryInsert,
  type CarroHistoryRow,
  type CarroInsert,
  type CarroPatch,
  type CarroRow,
  type CarroUpdate,
  type CrawlerLogInsert,
  type CrawlerLogRow,
  type CrawlerRunFinish,
  type CrawlerRunRow,
  type DbAdapter,
  type ListingRow,
  type ListingUpdate,
} from "./db-adapter";

export const PB_CAR_COLLECTIONS = {
  CARROS: "carros_temp",
  CARROS_HISTORY: "carros_history",
  LISTINGS: "car_listings",
  CRAWLER_RUNS: "car_crawler_runs",
  CRAWLER_LOGS: "car_crawler_logs",
  USER_CURATION: "user_car_curation",
  ALERTS: "car_alerts",
  ALERT_NOTIFICATIONS: "car_alert_notifications",
} as const;

const ADMIN_API_RULE = '@request.auth.role = "admin"';
const AUTH_API_RULE = '@request.auth.id != ""';
const USER_OR_ADMIN_API_RULE = 'user = @request.auth.id || @request.auth.role = "admin"';
const USER_CREATE_API_RULE = '@request.auth.id != "" && @request.body.user = @request.auth.id';

interface CollectionFieldSpec {
  name: string;
  type: "text" | "number" | "date" | "json" | "bool" | "file" | "autodate" | "relation";
  required?: boolean;
  max?: number;
  maxSelect?: number;
  maxSize?: number;
  mimeTypes?: string[];
  collectionId?: string;
  cascadeDelete?: boolean;
  onCreate?: boolean;
  onUpdate?: boolean;
}

const AUTODATE_FIELDS: CollectionFieldSpec[] = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

const CAR_LISTINGS_FIELDS: CollectionFieldSpec[] = [
  { name: "name", type: "text", required: true },
  { name: "active", type: "bool" },
  { name: "last_page", type: "number" },
  { name: "url", type: "text" },
  { name: "max_pages", type: "number" },
  { name: "delay_ms", type: "number" },
  ...AUTODATE_FIELDS,
];

const CARROS_TEMP_FIELDS: CollectionFieldSpec[] = [
  { name: "ref", type: "text", required: true },
  { name: "text_description", type: "text" },
  { name: "features", type: "json" },
  { name: "id_listing", type: "text" },
  {
    name: "images",
    type: "file",
    maxSelect: 10,
    maxSize: 10_485_760,
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/gif",
    ],
  },
  { name: "image_urls", type: "json" },
  { name: "price", type: "number" },
  { name: "year", type: "number" },
  { name: "mileage_km", type: "number" },
  { name: "brand", type: "text" },
  { name: "model", type: "text" },
  { name: "version", type: "text" },
  { name: "transmission", type: "text" },
  { name: "fuel", type: "text" },
  { name: "color", type: "text" },
  { name: "body_type", type: "text" },
  { name: "engine_size", type: "text" },
  { name: "is_turbo", type: "bool" },
  { name: "seller_type", type: "text" },
  { name: "neighborhood", type: "text" },
  { name: "city", type: "text" },
  { name: "state", type: "text" },
  { name: "fipe_price", type: "number" },
  { name: "fipe_code", type: "text" },
  { name: "fipe_brand", type: "text" },
  { name: "fipe_model", type: "text" },
  { name: "fipe_year", type: "number" },
  { name: "fipe_ref_period", type: "text" },
  { name: "fipe_diff_pct", type: "number" },
  { name: "is_favorite", type: "bool" },
  { name: "is_hidden", type: "bool" },
  { name: "notes", type: "text" },
  { name: "first_seen_at", type: "date" },
  { name: "last_seen_at", type: "date" },
  { name: "initial_price", type: "number" },
  { name: "lowest_price", type: "number" },
  { name: "highest_price", type: "number" },
  { name: "price_changes_count", type: "number" },
  { name: "last_price_change_at", type: "date" },
  { name: "listing_status", type: "text" },
  ...AUTODATE_FIELDS,
];

const CARROS_TEMP_INDEXES: string[] = [
  "CREATE INDEX idx_carros_ref ON carros_temp (ref)",
  "CREATE INDEX idx_carros_updated ON carros_temp (updated DESC)",
  "CREATE INDEX idx_carros_city_price ON carros_temp (city, price)",
  "CREATE INDEX idx_carros_brand_year ON carros_temp (brand, year)",
  "CREATE INDEX idx_carros_model_year ON carros_temp (brand, model, year)",
  "CREATE INDEX idx_carros_filters ON carros_temp (city, brand, transmission, fuel, is_turbo, engine_size, year, price)",
  "CREATE INDEX idx_carros_fipe ON carros_temp (fipe_price, fipe_diff_pct)",
  "CREATE INDEX idx_carros_fipe_code ON carros_temp (fipe_code)",
  "CREATE INDEX idx_carros_mileage ON carros_temp (mileage_km)",
  "CREATE INDEX idx_carros_status_seen ON carros_temp (listing_status, last_seen_at DESC)",
];

const CARROS_HISTORY_FIELDS: CollectionFieldSpec[] = [
  { name: "carro_id", type: "text" },
  { name: "ref", type: "text", required: true },
  { name: "id_listing", type: "text" },
  { name: "portal", type: "text" },
  { name: "text_description", type: "text" },
  { name: "brand", type: "text" },
  { name: "model", type: "text" },
  { name: "version", type: "text" },
  { name: "year", type: "number" },
  { name: "manufacture_year", type: "number" },
  { name: "price", type: "number" },
  { name: "previous_price", type: "number" },
  { name: "price_delta", type: "number" },
  { name: "mileage_km", type: "number" },
  { name: "previous_mileage_km", type: "number" },
  { name: "transmission", type: "text" },
  { name: "fuel", type: "text" },
  { name: "engine_size", type: "text" },
  { name: "is_turbo", type: "bool" },
  { name: "seller_type", type: "text" },
  { name: "neighborhood", type: "text" },
  { name: "city", type: "text" },
  { name: "state", type: "text" },
  { name: "fipe_price", type: "number" },
  { name: "fipe_code", type: "text" },
  { name: "fipe_brand", type: "text" },
  { name: "fipe_model", type: "text" },
  { name: "fipe_year", type: "number" },
  { name: "fipe_ref_period", type: "text" },
  { name: "fipe_diff_pct", type: "number" },
  { name: "event_type", type: "text" },
  { name: "recorded_at", type: "date" },
  ...AUTODATE_FIELDS,
];

const CARROS_HISTORY_INDEXES: string[] = [
  "CREATE INDEX idx_history_ref_date ON carros_history (ref, recorded_at DESC)",
  "CREATE INDEX idx_history_carro_date ON carros_history (carro_id, recorded_at DESC)",
  "CREATE INDEX idx_history_brand_model_year ON carros_history (brand, model, year)",
  "CREATE INDEX idx_history_fipe_year ON carros_history (fipe_code, year)",
  "CREATE INDEX idx_history_recorded_at ON carros_history (recorded_at DESC)",
];

const USER_CAR_CURATION_INDEXES: string[] = [
  "CREATE UNIQUE INDEX idx_user_curation_unique ON user_car_curation (user, carro_id)",
  "CREATE INDEX idx_user_curation_user ON user_car_curation (user, is_favorite, is_hidden)",
];

const CAR_ALERTS_INDEXES: string[] = [
  "CREATE INDEX idx_car_alerts_user_active ON car_alerts (user, active)",
];

const CAR_ALERT_NOTIF_INDEXES: string[] = [
  "CREATE INDEX idx_alert_notif_user_read ON car_alert_notifications (user, is_read, triggered_at DESC)",
  "CREATE UNIQUE INDEX idx_alert_notif_dedup ON car_alert_notifications (dedup_key)",
];

const CRAWLER_RUNS_FIELDS: CollectionFieldSpec[] = [
  { name: "site_name", type: "text", required: true },
  { name: "started_at", type: "date" },
  { name: "finished_at", type: "date" },
  { name: "status", type: "text" },
  { name: "pages_crawled", type: "number" },
  { name: "listings_scraped", type: "number" },
  { name: "errors", type: "number" },
  { name: "error_msg", type: "text" },
  ...AUTODATE_FIELDS,
];

const CRAWLER_LOGS_FIELDS: CollectionFieldSpec[] = [
  { name: "level", type: "text", required: true },
  { name: "message", type: "text", required: true },
  { name: "context", type: "json" },
  { name: "created_at", type: "date" },
  ...AUTODATE_FIELDS,
];

const BATCH_CHUNK_SIZE = 40;
const MAX_UPLOAD_IMAGES_PER_CAR = 6;

export interface PocketBaseAdapterOptions {
  url?: string;
  email?: string;
  password?: string;
  token?: string;
  uploadImages?: boolean;
  client?: PocketBase;
  downloadImageFn?: (url: string) => Promise<File | null>;
}

function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof ClientResponseError) return err.status;
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function isNotFoundError(err: unknown): boolean {
  return getHttpStatus(err) === 404;
}

function isMissingCollectionError(err: unknown): boolean {
  const status = getHttpStatus(err);
  return status === 404 || status === 400;
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function serializeJsonField(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

function parseJsonField(raw: string | null | undefined): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseImageUrls(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function toNumberOrNull(val: unknown): number | null {
  return typeof val === "number" && Number.isFinite(val) ? val : null;
}

function toStringOrNull(val: unknown): string | null {
  return typeof val === "string" ? val : null;
}

function toCarroRow(record: Record<string, unknown>): CarroRow {
  const idListingRaw = record.id_listing;
  const idListing = Array.isArray(idListingRaw)
    ? typeof idListingRaw[0] === "string"
      ? idListingRaw[0]
      : null
    : typeof idListingRaw === "string"
      ? idListingRaw
      : null;

  return {
    id: String(record.id),
    ref: String(record.ref ?? ""),
    textDescription: toStringOrNull(record.text_description),
    features: serializeJsonField(record.features),
    idListing,
    images: serializeJsonField(record.images),
    imageUrls: serializeJsonField(record.image_urls),
    price: toNumberOrNull(record.price),
    year: toNumberOrNull(record.year),
    mileageKm: toNumberOrNull(record.mileage_km),
    brand: toStringOrNull(record.brand),
    model: toStringOrNull(record.model),
    version: toStringOrNull(record.version),
    transmission: toStringOrNull(record.transmission),
    fuel: toStringOrNull(record.fuel),
    color: toStringOrNull(record.color),
    bodyType: toStringOrNull(record.body_type),
    engineSize: toStringOrNull(record.engine_size),
    isTurbo: Boolean(record.is_turbo),
    sellerType: toStringOrNull(record.seller_type),
    neighborhood: toStringOrNull(record.neighborhood),
    city: toStringOrNull(record.city),
    state: toStringOrNull(record.state),
    fipePrice: toNumberOrNull(record.fipe_price),
    fipeCode: toStringOrNull(record.fipe_code),
    fipeBrand: toStringOrNull(record.fipe_brand),
    fipeModel: toStringOrNull(record.fipe_model),
    fipeYear: toNumberOrNull(record.fipe_year),
    fipeRefPeriod: toStringOrNull(record.fipe_ref_period),
    fipeDiffPct: toNumberOrNull(record.fipe_diff_pct),
    isFavorite: Boolean(record.is_favorite),
    isHidden: Boolean(record.is_hidden),
    notes: toStringOrNull(record.notes),
    firstSeenAt: toDate(record.first_seen_at),
    lastSeenAt: toDate(record.last_seen_at),
    initialPrice: toNumberOrNull(record.initial_price),
    lowestPrice: toNumberOrNull(record.lowest_price),
    highestPrice: toNumberOrNull(record.highest_price),
    priceChangesCount:
      typeof record.price_changes_count === "number" &&
      Number.isFinite(record.price_changes_count)
        ? record.price_changes_count
        : 0,
    lastPriceChangeAt: toDate(record.last_price_change_at),
    listingStatus: toStringOrNull(record.listing_status) ?? "active",
    created: toDate(record.created),
    updated: toDate(record.updated),
  };
}

function toCarroHistoryRow(record: Record<string, unknown>): CarroHistoryRow {
  return {
    id: String(record.id),
    carroId: String(record.carro_id ?? ""),
    ref: String(record.ref ?? ""),
    idListing: toStringOrNull(record.id_listing),
    portal: String(record.portal ?? ""),
    textDescription: toStringOrNull(record.text_description),
    brand: toStringOrNull(record.brand),
    model: toStringOrNull(record.model),
    version: toStringOrNull(record.version),
    year: toNumberOrNull(record.year),
    manufactureYear: toNumberOrNull(record.manufacture_year),
    price: toNumberOrNull(record.price),
    previousPrice: toNumberOrNull(record.previous_price),
    priceDelta: toNumberOrNull(record.price_delta),
    mileageKm: toNumberOrNull(record.mileage_km),
    previousMileageKm: toNumberOrNull(record.previous_mileage_km),
    transmission: toStringOrNull(record.transmission),
    fuel: toStringOrNull(record.fuel),
    engineSize: toStringOrNull(record.engine_size),
    isTurbo: Boolean(record.is_turbo),
    sellerType: toStringOrNull(record.seller_type),
    neighborhood: toStringOrNull(record.neighborhood),
    city: toStringOrNull(record.city),
    state: toStringOrNull(record.state),
    fipePrice: toNumberOrNull(record.fipe_price),
    fipeCode: toStringOrNull(record.fipe_code),
    fipeBrand: toStringOrNull(record.fipe_brand),
    fipeModel: toStringOrNull(record.fipe_model),
    fipeYear: toNumberOrNull(record.fipe_year),
    fipeRefPeriod: toStringOrNull(record.fipe_ref_period),
    fipeDiffPct: toNumberOrNull(record.fipe_diff_pct),
    eventType: String(record.event_type ?? "snapshot"),
    recordedAt: toDate(record.recorded_at) ?? toDate(record.created) ?? new Date(),
  };
}

function toCarAlertRow(record: Record<string, unknown>): CarAlertRow {
  const userRaw = record.user;
  const userId = Array.isArray(userRaw)
    ? String(userRaw[0] ?? "")
    : String(userRaw ?? "");

  return {
    id: String(record.id),
    userId,
    name: String(record.name ?? ""),
    active: Boolean(record.active),
    searchQuery: String(record.search_query ?? ""),
    brand: String(record.brand ?? ""),
    model: String(record.model ?? ""),
    version: String(record.version ?? ""),
    fipeCode: String(record.fipe_code ?? ""),
    city: String(record.city ?? ""),
    portal: String(record.portal ?? ""),
    motorizacao: String(record.motorizacao ?? ""),
    transmission: String(record.transmission ?? ""),
    fuel: String(record.fuel ?? ""),
    minYear: typeof record.min_year === "number" ? record.min_year : 0,
    maxYear: typeof record.max_year === "number" ? record.max_year : 0,
    minPrice: typeof record.min_price === "number" ? record.min_price : 0,
    maxPrice: typeof record.max_price === "number" ? record.max_price : 0,
    maxKm: typeof record.max_km === "number" ? record.max_km : 0,
    onlyBelowFipe: Boolean(record.only_below_fipe),
    minFipeDiscountPct:
      typeof record.min_fipe_discount_pct === "number"
        ? record.min_fipe_discount_pct
        : 0,
    notifyOnNew: record.notify_on_new !== false,
    notifyOnPriceDrop: record.notify_on_price_drop !== false,
    lastCheckedAt: toDate(record.last_checked_at),
    lastMatchedAt: toDate(record.last_matched_at),
    matchesCount: typeof record.matches_count === "number" ? record.matches_count : 0,
  };
}

function toListingRow(record: Record<string, unknown>): ListingRow {
  return {
    id: String(record.id),
    name: String(record.name ?? ""),
    active: Boolean(record.active),
    lastPage: typeof record.last_page === "number" ? record.last_page : 1,
    url: typeof record.url === "string" ? record.url : null,
    maxPages: typeof record.max_pages === "number" ? record.max_pages : 50,
    delayMs: typeof record.delay_ms === "number" ? record.delay_ms : 2500,
    created: toDate(record.created),
    updated: toDate(record.updated),
  };
}

export class PocketBaseAdapter implements DbAdapter {
  private pb: PocketBase;
  private email?: string;
  private password?: string;
  private token?: string;
  private uploadImages: boolean;
  private downloadImageFn: (url: string) => Promise<File | null>;
  private authPromise: Promise<void> | null = null;

  private useFallbackRuns = false;
  private fallbackRuns: CrawlerRunRow[] = [];
  private useFallbackLogs = false;
  private fallbackLogs: CrawlerLogRow[] = [];
  private nextRunId = 1;
  private nextLogId = 1;
  private pbRunIdMap = new Map<number, string>();
  private pbIdToRunId = new Map<string, number>();

  constructor(options: PocketBaseAdapterOptions | string = {}) {
    const opts: PocketBaseAdapterOptions =
      typeof options === "string" ? { url: options } : options;

    const baseUrl =
      opts.url ?? process.env.POCKETBASE_URL ?? "https://pb.victorbernardes.dev";

    this.pb = opts.client ?? new PocketBase(baseUrl);
    this.pb.autoCancellation(false);

    this.email = opts.email ?? process.env.POCKETBASE_EMAIL;
    this.password = opts.password ?? process.env.POCKETBASE_PASSWORD;
    this.token = opts.token ?? process.env.POCKETBASE_TOKEN;
    this.uploadImages =
      opts.uploadImages ?? process.env.POCKETBASE_UPLOAD_IMAGES !== "false";
    this.downloadImageFn = opts.downloadImageFn ?? DownloadImageAndCreateFile;
  }

  private async ensureAuth(): Promise<void> {
    if (this.token) {
      if (!this.pb.authStore.token) {
        this.pb.authStore.save(this.token, null);
      }
      return;
    }

    if (!this.email || !this.password) return;
    if (this.pb.authStore.isValid) return;

    if (!this.authPromise) {
      const email = this.email;
      const password = this.password;
      this.authPromise = (async () => {
        this.pb.authStore.clear?.();
        let superuserErr: unknown;
        try {
          await this.pb
            .collection("_superusers")
            .authWithPassword(email, password);
          return;
        } catch (err) {
          superuserErr = err;
        }

        // Only fall back to legacy <0.23 /api/admins endpoint if _superusers is missing (404)
        if (isNotFoundError(superuserErr)) {
          this.pb.authStore.clear?.();
          try {
            if (typeof this.pb.admins?.authWithPassword === "function") {
              await this.pb.admins.authWithPassword(email, password);
              return;
            }
          } catch {
            // Try direct legacy REST endpoint below
          }
          try {
            const res = (await this.pb.send("/api/admins/auth-with-password", {
              method: "POST",
              body: { identity: email, password },
            })) as {
              token?: unknown;
              admin?: Record<string, unknown> | null;
              record?: Record<string, unknown> | null;
            } | null;
            if (res && typeof res.token === "string" && res.token) {
              this.pb.authStore.save(
                res.token,
                (res.admin ?? res.record ?? null) as never,
              );
              return;
            }
          } catch {
            // Fall through to users or throw
          }
        }

        this.pb.authStore.clear?.();
        try {
          await this.pb
            .collection("users")
            .authWithPassword(email, password);
          return;
        } catch {
          this.pb.authStore.clear?.();
          const detail =
            superuserErr instanceof Error
              ? superuserErr.message
              : "Invalid credentials";
          throw new Error(
            `PocketBase authentication failed for ${email} (${detail}). Verifique POCKETBASE_EMAIL e POCKETBASE_PASSWORD.`,
          );
        }
      })().finally(() => {
        this.authPromise = null;
      });
    }

    await this.authPromise;
  }

  private async ensureMissingFields(
    name: string,
    desiredFields: CollectionFieldSpec[],
    desiredIndexes: string[] = [],
  ): Promise<void> {
    if (typeof this.pb.collections?.getOne !== "function") return;
    if (typeof this.pb.collections?.update !== "function") return;
    try {
      const col = (await this.pb.collections.getOne(name)) as {
        id?: string;
        fields?: Array<Record<string, unknown>>;
        indexes?: string[];
      };
      if (!col || !Array.isArray(col.fields)) return;
      const existingNames = new Set(
        col.fields.map((f) => String(f.name ?? "")).filter(Boolean),
      );
      const missingFields = desiredFields.filter((f) => !existingNames.has(f.name));

      const existingIndexes = Array.isArray(col.indexes) ? col.indexes : [];
      const existingIndexNames = new Set(
        existingIndexes
          .map((idx) => idx.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i)?.[1] ?? "")
          .filter(Boolean),
      );
      const missingIndexes = desiredIndexes.filter((idx) => {
        const idxName = idx.match(/INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i)?.[1] ?? "";
        return idxName && !existingIndexNames.has(idxName);
      });

      if (missingFields.length === 0 && missingIndexes.length === 0) return;

      const patchPayload: Record<string, unknown> = {
        fields: [...col.fields, ...missingFields],
      };
      if (missingIndexes.length > 0) {
        patchPayload.indexes = [...existingIndexes, ...missingIndexes];
      }

      await this.pb.collections.update(col.id ?? name, patchPayload as never);
      Logger.info(
        {
          collection: name,
          addedFields: missingFields.map((m) => m.name),
          addedIndexes: missingIndexes.length,
        },
        `Updated PocketBase collection ${name} schema/indexes`,
      );
    } catch {
      // Ignore when collections metadata endpoint is unavailable
    }
  }

  private async ensureUsersSchema(): Promise<string> {
    if (typeof this.pb.collections?.getOne !== "function") return "users";
    try {
      const col = (await this.pb.collections.getOne("users")) as {
        id?: string;
        fields?: Array<Record<string, unknown>>;
        listRule?: string | null;
        viewRule?: string | null;
        createRule?: string | null;
        updateRule?: string | null;
        deleteRule?: string | null;
      };
      const usersId = col?.id || "users";
      if (!col || !Array.isArray(col.fields) || typeof this.pb.collections?.update !== "function") {
        return usersId;
      }

      const existingNames = new Set(
        col.fields.map((f) => String(f.name ?? "")).filter(Boolean),
      );
      const desiredFields: CollectionFieldSpec[] = [
        { name: "role", type: "text", max: 32 },
        { name: "alerts_enabled", type: "bool" },
      ];
      const missingFields = desiredFields.filter((f) => !existingNames.has(f.name));

      const desiredListRule = 'id = @request.auth.id || @request.auth.role = "admin"';
      const desiredViewRule = 'id = @request.auth.id || @request.auth.role = "admin"';
      const desiredCreateRule = ADMIN_API_RULE;
      const desiredUpdateRule =
        '(id = @request.auth.id && (@request.body.role:isset = false || @request.body.role = role)) || @request.auth.role = "admin"';
      const desiredDeleteRule = ADMIN_API_RULE;

      const rulesChanged =
        col.listRule !== desiredListRule ||
        col.viewRule !== desiredViewRule ||
        col.createRule !== desiredCreateRule ||
        col.updateRule !== desiredUpdateRule ||
        col.deleteRule !== desiredDeleteRule;

      if (missingFields.length > 0 || rulesChanged) {
        await this.pb.collections.update(usersId, {
          ...(missingFields.length > 0 ? { fields: [...col.fields, ...missingFields] } : {}),
          listRule: desiredListRule,
          viewRule: desiredViewRule,
          createRule: desiredCreateRule,
          updateRule: desiredUpdateRule,
          deleteRule: desiredDeleteRule,
        } as never);
      }

      return usersId;
    } catch {
      return "users";
    }
  }

  private async ensureCollectionExists(
    name: string,
    fields: CollectionFieldSpec[],
    rules: {
      listRule?: string | null;
      viewRule?: string | null;
      createRule?: string | null;
      updateRule?: string | null;
      deleteRule?: string | null;
      indexes?: string[];
    } = {},
  ): Promise<string | null> {
    try {
      await this.pb.collection(name).getList(1, 1, { fields: "id" });
      await this.ensureMissingFields(name, fields, rules.indexes ?? []);
      if (typeof this.pb.collections?.getOne === "function") {
        try {
          const col = (await this.pb.collections.getOne(name)) as { id?: string };
          return col?.id ?? name;
        } catch {
          return name;
        }
      }
      return name;
    } catch (err) {
      if (!isNotFoundError(err)) {
        return name;
      }
    }

    const basePayload = {
      name,
      type: "base",
      listRule: rules.listRule !== undefined ? rules.listRule : "",
      viewRule: rules.viewRule !== undefined ? rules.viewRule : "",
      createRule: rules.createRule !== undefined ? rules.createRule : ADMIN_API_RULE,
      updateRule: rules.updateRule !== undefined ? rules.updateRule : ADMIN_API_RULE,
      deleteRule: rules.deleteRule !== undefined ? rules.deleteRule : ADMIN_API_RULE,
      ...(rules.indexes && rules.indexes.length > 0
        ? { indexes: rules.indexes }
        : {}),
    };

    try {
      const created = (await this.pb.collections.create({
        ...basePayload,
        fields,
      } as never)) as { id?: string } | undefined;
      Logger.info({ collection: name }, `Created PocketBase collection ${name}`);
      return created?.id ?? name;
    } catch (err) {
      if (getHttpStatus(err) === 400) {
        try {
          const legacySchema = fields.filter((f) => f.type !== "autodate");
          const created = (await this.pb.collections.create({
            ...basePayload,
            schema: legacySchema,
          } as never)) as { id?: string } | undefined;
          Logger.info(
            { collection: name },
            `Created PocketBase collection ${name} (legacy schema)`,
          );
          return created?.id ?? name;
        } catch (fallbackErr) {
          Logger.warn(
            {
              collection: name,
              err:
                fallbackErr instanceof Error
                  ? fallbackErr.message
                  : String(fallbackErr),
            },
            `Could not auto-create PocketBase collection ${name}`,
          );
          return null;
        }
      }
      Logger.warn(
        {
          collection: name,
          err: err instanceof Error ? err.message : String(err),
        },
        `Could not auto-create PocketBase collection ${name}`,
      );
      return null;
    }
  }

  async ensureSchema(): Promise<void> {
    await this.ensureAuth();

    const usersCollectionId = await this.ensureUsersSchema();

    await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.LISTINGS,
      CAR_LISTINGS_FIELDS,
      {
        listRule: ADMIN_API_RULE,
        viewRule: ADMIN_API_RULE,
        createRule: ADMIN_API_RULE,
        updateRule: ADMIN_API_RULE,
        deleteRule: ADMIN_API_RULE,
      },
    );

    await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.CARROS,
      CARROS_TEMP_FIELDS,
      {
        listRule: "",
        viewRule: "",
        createRule: ADMIN_API_RULE,
        updateRule: ADMIN_API_RULE,
        deleteRule: ADMIN_API_RULE,
        indexes: CARROS_TEMP_INDEXES,
      },
    );

    await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.CARROS_HISTORY,
      CARROS_HISTORY_FIELDS,
      {
        listRule: AUTH_API_RULE,
        viewRule: AUTH_API_RULE,
        createRule: ADMIN_API_RULE,
        updateRule: ADMIN_API_RULE,
        deleteRule: ADMIN_API_RULE,
        indexes: CARROS_HISTORY_INDEXES,
      },
    );

    await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.USER_CURATION,
      [
        {
          name: "user",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        { name: "carro_id", type: "text", required: true },
        { name: "car_ref", type: "text" },
        { name: "is_favorite", type: "bool" },
        { name: "is_hidden", type: "bool" },
        { name: "notes", type: "text" },
        ...AUTODATE_FIELDS,
      ],
      {
        listRule: USER_OR_ADMIN_API_RULE,
        viewRule: USER_OR_ADMIN_API_RULE,
        createRule: USER_CREATE_API_RULE,
        updateRule: USER_OR_ADMIN_API_RULE,
        deleteRule: USER_OR_ADMIN_API_RULE,
        indexes: USER_CAR_CURATION_INDEXES,
      },
    );

    const alertsCollectionId = await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.ALERTS,
      [
        {
          name: "user",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        { name: "name", type: "text", required: true },
        { name: "active", type: "bool" },
        { name: "search_query", type: "text" },
        { name: "brand", type: "text" },
        { name: "model", type: "text" },
        { name: "version", type: "text" },
        { name: "fipe_code", type: "text" },
        { name: "city", type: "text" },
        { name: "portal", type: "text" },
        { name: "motorizacao", type: "text" },
        { name: "transmission", type: "text" },
        { name: "fuel", type: "text" },
        { name: "min_year", type: "number" },
        { name: "max_year", type: "number" },
        { name: "min_price", type: "number" },
        { name: "max_price", type: "number" },
        { name: "max_km", type: "number" },
        { name: "only_below_fipe", type: "bool" },
        { name: "min_fipe_discount_pct", type: "number" },
        { name: "notify_on_new", type: "bool" },
        { name: "notify_on_price_drop", type: "bool" },
        { name: "last_checked_at", type: "date" },
        { name: "last_matched_at", type: "date" },
        { name: "matches_count", type: "number" },
        ...AUTODATE_FIELDS,
      ],
      {
        listRule: USER_OR_ADMIN_API_RULE,
        viewRule: USER_OR_ADMIN_API_RULE,
        createRule: USER_CREATE_API_RULE,
        updateRule: USER_OR_ADMIN_API_RULE,
        deleteRule: USER_OR_ADMIN_API_RULE,
        indexes: CAR_ALERTS_INDEXES,
      },
    );

    if (alertsCollectionId) {
      await this.ensureCollectionExists(
        PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS,
        [
          {
            name: "user",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: usersCollectionId,
            cascadeDelete: true,
          },
          {
            name: "alert",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: alertsCollectionId,
            cascadeDelete: true,
          },
          { name: "carro_id", type: "text" },
          { name: "car_ref", type: "text", required: true },
          { name: "car_title", type: "text" },
          { name: "brand", type: "text" },
          { name: "model", type: "text" },
          { name: "year", type: "number" },
          { name: "mileage_km", type: "number" },
          { name: "price", type: "number" },
          { name: "previous_price", type: "number" },
          { name: "fipe_price", type: "number" },
          { name: "fipe_diff_pct", type: "number" },
          { name: "portal", type: "text" },
          { name: "city", type: "text" },
          { name: "trigger_type", type: "text" },
          { name: "dedup_key", type: "text", required: true },
          { name: "is_read", type: "bool" },
          { name: "read_at", type: "date" },
          { name: "triggered_at", type: "date" },
          ...AUTODATE_FIELDS,
        ],
        {
          listRule: USER_OR_ADMIN_API_RULE,
          viewRule: USER_OR_ADMIN_API_RULE,
          createRule:
            '@request.auth.id != "" && (@request.body.user = @request.auth.id || @request.auth.role = "admin")',
          updateRule: USER_OR_ADMIN_API_RULE,
          deleteRule: USER_OR_ADMIN_API_RULE,
          indexes: CAR_ALERT_NOTIF_INDEXES,
        },
      );
    }

    const runsReady = await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.CRAWLER_RUNS,
      CRAWLER_RUNS_FIELDS,
      {
        listRule: ADMIN_API_RULE,
        viewRule: ADMIN_API_RULE,
        createRule: ADMIN_API_RULE,
        updateRule: ADMIN_API_RULE,
        deleteRule: ADMIN_API_RULE,
      },
    );
    if (!runsReady) this.useFallbackRuns = true;

    const logsReady = await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.CRAWLER_LOGS,
      CRAWLER_LOGS_FIELDS,
      {
        listRule: ADMIN_API_RULE,
        viewRule: ADMIN_API_RULE,
        createRule: ADMIN_API_RULE,
        updateRule: ADMIN_API_RULE,
        deleteRule: ADMIN_API_RULE,
      },
    );
    if (!logsReady) this.useFallbackLogs = true;

    try {
      const existing = await this.pb
        .collection(PB_CAR_COLLECTIONS.LISTINGS)
        .getFullList<{ id: string; name?: string; url?: string }>({
          fields: "id,name,url",
        });

      const existingNames = new Set(
        existing.map((r) => r.name).filter((n): n is string => Boolean(n)),
      );

      for (const rec of existing) {
        if (
          rec.name === "olx-carros" &&
          (rec.url === LEGACY_OLX_CARS_URL || rec.url === LEGACY_OLX_JOINVILLE_URL)
        ) {
          await this.pb.collection(PB_CAR_COLLECTIONS.LISTINGS).update(rec.id, {
            url: DEFAULT_OLX_CARS_URL,
          });
          Logger.info("Migrated olx-carros URL to regional Norte de SC cars target");
        }
      }

      for (const seed of DEFAULT_SEED_LISTINGS) {
        if (existingNames.has(seed.name)) continue;
        await this.pb.collection(PB_CAR_COLLECTIONS.LISTINGS).create({
          name: seed.name,
          active: seed.active,
          last_page: seed.lastPage,
          url: seed.url,
          max_pages: seed.maxPages,
          delay_ms: seed.delayMs,
        });
      }
    } catch (err) {
      Logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "Could not verify or seed PocketBase car_listings collection",
      );
    }
  }

  private async buildCarroPayload(
    data: CarroInsert | CarroUpdate,
  ): Promise<Record<string, unknown>> {
    const urls = parseImageUrls(data.images);
    const payload: Record<string, unknown> = {
      text_description: data.textDescription ?? "",
      features: parseJsonField(data.features),
      id_listing: data.idListing,
      image_urls: urls,
      price: data.price,
      year: data.year,
      mileage_km: data.mileageKm,
      brand: data.brand ?? "",
      model: data.model ?? "",
      version: data.version ?? "",
      transmission: data.transmission ?? "",
      fuel: data.fuel ?? "",
      color: data.color ?? "",
      body_type: data.bodyType ?? "",
      engine_size: data.engineSize ?? "",
      is_turbo: Boolean(data.isTurbo),
      seller_type: data.sellerType ?? "",
      neighborhood: data.neighborhood ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      fipe_price: data.fipePrice ?? 0,
      fipe_code: data.fipeCode ?? "",
      fipe_brand: data.fipeBrand ?? "",
      fipe_model: data.fipeModel ?? "",
      fipe_year: data.fipeYear ?? 0,
      fipe_ref_period: data.fipeRefPeriod ?? "",
      fipe_diff_pct: data.fipeDiffPct ?? 0,
      ...(data.firstSeenAt ? { first_seen_at: data.firstSeenAt.toISOString() } : {}),
      ...(data.lastSeenAt ? { last_seen_at: data.lastSeenAt.toISOString() } : {}),
      ...(data.initialPrice !== undefined ? { initial_price: data.initialPrice } : {}),
      ...(data.lowestPrice !== undefined ? { lowest_price: data.lowestPrice } : {}),
      ...(data.highestPrice !== undefined ? { highest_price: data.highestPrice } : {}),
      ...(data.priceChangesCount !== undefined
        ? { price_changes_count: data.priceChangesCount }
        : {}),
      ...(data.lastPriceChangeAt !== undefined
        ? {
            last_price_change_at: data.lastPriceChangeAt
              ? data.lastPriceChangeAt.toISOString()
              : "",
          }
        : {}),
      listing_status: data.listingStatus ?? "active",
    };

    if ("ref" in data) {
      payload.ref = data.ref;
      payload.is_favorite = false;
      payload.is_hidden = false;
      payload.notes = "";
      if (!data.firstSeenAt) {
        payload.first_seen_at = data.created.toISOString();
      }
      if (!data.lastSeenAt) {
        payload.last_seen_at = data.updated.toISOString();
      }
    }

    if (this.uploadImages && urls.length > 0) {
      const slice = urls.slice(0, MAX_UPLOAD_IMAGES_PER_CAR);
      const downloaded = await Promise.all(
        slice.map((url) => this.downloadImageFn(url)),
      );
      const files = downloaded.filter((file): file is File => file !== null);
      if (files.length > 0) {
        payload.images = files;
      }
    }

    return payload;
  }

  async findCarroByRef(ref: string): Promise<{ id: string } | null> {
    await this.ensureAuth();
    try {
      const record = await this.pb
        .collection(PB_CAR_COLLECTIONS.CARROS)
        .getFirstListItem<{ id: string }>(
          this.pb.filter("ref = {:ref}", { ref }),
          { fields: "id" },
        );
      return { id: record.id };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async getCarroById(id: string): Promise<CarroRow | null> {
    await this.ensureAuth();
    try {
      const record = await this.pb
        .collection(PB_CAR_COLLECTIONS.CARROS)
        .getOne<Record<string, unknown>>(id);
      return toCarroRow(record);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async getCarrosByRef(ref: string): Promise<CarroRow[]> {
    await this.ensureAuth();
    const list = await this.pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(1, 200, {
        filter: this.pb.filter("ref = {:ref}", { ref }),
      });
    return list.items.map(toCarroRow);
  }

  async insertCarro(data: CarroInsert): Promise<void> {
    await this.ensureAuth();
    const payload = await this.buildCarroPayload(data);
    await this.pb.collection(PB_CAR_COLLECTIONS.CARROS).create(payload);
  }

  async updateCarro(id: string, data: CarroUpdate): Promise<void> {
    await this.ensureAuth();
    const payload = await this.buildCarroPayload(data);
    await this.pb.collection(PB_CAR_COLLECTIONS.CARROS).update(id, payload);
  }

  async patchCarro(id: string, data: CarroPatch): Promise<void> {
    await this.ensureAuth();
    const body: Record<string, unknown> = {};
    if (data.textDescription !== undefined) {
      body.text_description = data.textDescription ?? "";
    }
    if (data.features !== undefined) {
      body.features = parseJsonField(data.features);
    }
    if (data.isFavorite !== undefined) body.is_favorite = data.isFavorite;
    if (data.isHidden !== undefined) body.is_hidden = data.isHidden;
    if (data.notes !== undefined) body.notes = data.notes;
    if (data.listingStatus !== undefined) body.listing_status = data.listingStatus;
    if (data.lastSeenAt !== undefined) {
      body.last_seen_at = data.lastSeenAt.toISOString();
    }
    await this.pb.collection(PB_CAR_COLLECTIONS.CARROS).update(id, body);
  }

  async insertCarroHistory(data: CarroHistoryInsert): Promise<void> {
    await this.ensureAuth();
    await this.pb.collection(PB_CAR_COLLECTIONS.CARROS_HISTORY).create({
      carro_id: data.carroId,
      ref: data.ref,
      id_listing: data.idListing ?? "",
      portal: data.portal,
      text_description: data.textDescription ?? "",
      brand: data.brand ?? "",
      model: data.model ?? "",
      version: data.version ?? "",
      year: data.year,
      manufacture_year: data.manufactureYear ?? 0,
      price: data.price,
      previous_price: data.previousPrice ?? 0,
      price_delta: data.priceDelta ?? 0,
      mileage_km: data.mileageKm,
      previous_mileage_km: data.previousMileageKm ?? 0,
      transmission: data.transmission ?? "",
      fuel: data.fuel ?? "",
      engine_size: data.engineSize ?? "",
      is_turbo: Boolean(data.isTurbo),
      seller_type: data.sellerType ?? "",
      neighborhood: data.neighborhood ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      fipe_price: data.fipePrice ?? 0,
      fipe_code: data.fipeCode ?? "",
      fipe_brand: data.fipeBrand ?? "",
      fipe_model: data.fipeModel ?? "",
      fipe_year: data.fipeYear ?? 0,
      fipe_ref_period: data.fipeRefPeriod ?? "",
      fipe_diff_pct: data.fipeDiffPct ?? 0,
      event_type: data.eventType,
      recorded_at: data.recordedAt.toISOString(),
    });
  }

  async getLatestCarroHistorySnapshot(ref: string): Promise<CarroHistoryRow | null> {
    await this.ensureAuth();
    try {
      const res = await this.pb
        .collection(PB_CAR_COLLECTIONS.CARROS_HISTORY)
        .getList<Record<string, unknown>>(1, 1, {
          filter: this.pb.filter("ref = {:ref}", { ref }),
          sort: "-recorded_at,-created",
        });
      const first = res.items[0];
      return first ? toCarroHistoryRow(first) : null;
    } catch (err) {
      if (isMissingCollectionError(err)) return null;
      throw err;
    }
  }

  async getCarroHistoryByRef(ref: string, limit = 100): Promise<CarroHistoryRow[]> {
    await this.ensureAuth();
    try {
      const res = await this.pb
        .collection(PB_CAR_COLLECTIONS.CARROS_HISTORY)
        .getList<Record<string, unknown>>(1, limit, {
          filter: this.pb.filter("ref = {:ref}", { ref }),
          sort: "-recorded_at,-created",
        });
      return res.items.map(toCarroHistoryRow);
    } catch (err) {
      if (isMissingCollectionError(err)) return [];
      throw err;
    }
  }

  async backfillMissingCarroHistory(limit = 300): Promise<number> {
    await this.ensureAuth();
    let createdCount = 0;
    let page = 1;

    while (createdCount < limit) {
      const batch = await this.pb
        .collection(PB_CAR_COLLECTIONS.CARROS)
        .getList<Record<string, unknown>>(page, 100, {
          sort: "-updated",
        });

      if (batch.items.length === 0) break;

      for (const raw of batch.items) {
        if (createdCount >= limit) break;
        const row = toCarroRow(raw);
        if (!row.ref || !row.price || row.price <= 0) continue;

        const latest = await this.getLatestCarroHistorySnapshot(row.ref);
        if (latest) continue;

        const lowerRef = row.ref.toLowerCase();
        const portal = lowerRef.includes("olx.com.br")
          ? "OLX Carros"
          : lowerRef.includes("webmotors.com.br")
            ? "Webmotors"
            : "Outro portal";

        await this.insertCarroHistory({
          carroId: row.id,
          ref: row.ref,
          idListing: row.idListing,
          portal,
          textDescription: row.textDescription,
          brand: row.brand ?? undefined,
          model: row.model ?? undefined,
          version: row.version ?? undefined,
          year: row.year ?? 0,
          price: row.price,
          mileageKm: row.mileageKm ?? 0,
          transmission: row.transmission ?? undefined,
          fuel: row.fuel ?? undefined,
          engineSize: row.engineSize ?? undefined,
          isTurbo: row.isTurbo,
          sellerType: row.sellerType ?? undefined,
          neighborhood: row.neighborhood ?? undefined,
          city: row.city ?? undefined,
          state: row.state ?? undefined,
          fipePrice: row.fipePrice ?? 0,
          fipeCode: row.fipeCode ?? undefined,
          fipeBrand: row.fipeBrand ?? undefined,
          fipeModel: row.fipeModel ?? undefined,
          fipeYear: row.fipeYear ?? 0,
          fipeRefPeriod: row.fipeRefPeriod ?? undefined,
          fipeDiffPct: row.fipeDiffPct ?? 0,
          eventType: "first_seen",
          recordedAt: row.firstSeenAt ?? row.created ?? row.updated ?? new Date(),
        });
        createdCount++;
      }

      if (page >= batch.totalPages) break;
      page++;
    }

    return createdCount;
  }

  async getActiveCarAlerts(): Promise<CarAlertRow[]> {
    await this.ensureAuth();
    try {
      const items = await this.pb
        .collection(PB_CAR_COLLECTIONS.ALERTS)
        .getFullList<Record<string, unknown>>({
          filter: "active = true",
        });
      return items.map(toCarAlertRow);
    } catch (err) {
      if (isMissingCollectionError(err)) return [];
      throw err;
    }
  }

  async insertAlertNotification(data: CarAlertNotificationInsert): Promise<boolean> {
    await this.ensureAuth();
    try {
      await this.pb.collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS).create({
        user: data.userId,
        alert: data.alertId,
        carro_id: data.carroId,
        car_ref: data.carRef,
        car_title: data.carTitle,
        brand: data.brand ?? "",
        model: data.model ?? "",
        year: data.year ?? 0,
        mileage_km: data.mileageKm ?? 0,
        price: data.price,
        previous_price: data.previousPrice ?? 0,
        fipe_price: data.fipePrice ?? 0,
        fipe_diff_pct: data.fipeDiffPct ?? 0,
        portal: data.portal,
        city: data.city ?? "",
        trigger_type: data.triggerType,
        dedup_key: data.dedupKey,
        is_read: false,
        read_at: "",
        triggered_at: data.triggeredAt.toISOString(),
      });
      return true;
    } catch (err) {
      // Unique dedup_key constraint prevents duplicates gracefully
      if (getHttpStatus(err) === 400) return false;
      throw err;
    }
  }

  async updateCarAlertStats(
    alertId: string,
    patch: {
      lastCheckedAt: Date;
      lastMatchedAt?: Date;
      matchesIncrement?: number;
    },
  ): Promise<void> {
    await this.ensureAuth();
    try {
      const current = await this.pb
        .collection(PB_CAR_COLLECTIONS.ALERTS)
        .getOne<{ matches_count?: number }>(alertId, { fields: "id,matches_count" });
      const prevCount =
        typeof current?.matches_count === "number" ? current.matches_count : 0;
      await this.pb.collection(PB_CAR_COLLECTIONS.ALERTS).update(alertId, {
        last_checked_at: patch.lastCheckedAt.toISOString(),
        ...(patch.lastMatchedAt
          ? { last_matched_at: patch.lastMatchedAt.toISOString() }
          : {}),
        ...(patch.matchesIncrement && patch.matchesIncrement > 0
          ? { matches_count: prevCount + patch.matchesIncrement }
          : {}),
      });
    } catch {
      // Non-critical stat update
    }
  }

  async updateCarroFipe(id: string, data: CarroFipePatch): Promise<void> {
    await this.ensureAuth();
    const body: Record<string, unknown> = {
      fipe_price: data.fipePrice,
      fipe_code: data.fipeCode,
      fipe_brand: data.fipeBrand,
      fipe_model: data.fipeModel,
      fipe_year: data.fipeYear,
      fipe_ref_period: data.fipeRefPeriod,
      fipe_diff_pct: data.fipeDiffPct,
    };
    if (data.engineSize) body.engine_size = data.engineSize;
    if (data.isTurbo !== undefined) body.is_turbo = Boolean(data.isTurbo);
    if (data.transmission) body.transmission = data.transmission;
    if (data.fuel) body.fuel = data.fuel;
    await this.pb.collection(PB_CAR_COLLECTIONS.CARROS).update(id, body);
  }

  async getCarrosMissingFipe(limit: number): Promise<CarroRow[]> {
    await this.ensureAuth();
    const res = await this.pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(1, limit, {
        filter: 'fipe_code = "" && year > 0',
        fields:
          "id,ref,text_description,price,year,brand,model,version,transmission,fuel,engine_size,is_turbo,fipe_price",
      });
    return res.items.map(toCarroRow);
  }

  async getActiveCarrosStaleSince(
    seenBefore: Date,
    limit: number,
    idListing?: string,
  ): Promise<CarroRow[]> {
    await this.ensureAuth();
    const baseFilter = idListing
      ? this.pb.filter(
          '(listing_status = "" || listing_status = "active") && id_listing = {:lid}',
          { lid: idListing },
        )
      : '(listing_status = "" || listing_status = "active")';

    const perPage = Math.min(Math.max(limit * 2, 100), 500);
    const res = await this.pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(1, perPage, {
        filter: baseFilter,
        sort: "last_seen_at,updated",
      });

    const cutoffMs = seenBefore.getTime();
    return res.items
      .map(toCarroRow)
      .filter((row) => {
        const seenAt = row.lastSeenAt ?? row.updated ?? row.created;
        return seenAt ? seenAt.getTime() < cutoffMs : true;
      })
      .slice(0, limit);
  }

  async deleteCarro(id: string): Promise<void> {
    await this.ensureAuth();
    await this.pb.collection(PB_CAR_COLLECTIONS.CARROS).delete(id);
  }

  private async deleteCarroRecordsInBatches(
    records: Array<{ id: string }>,
  ): Promise<number> {
    if (records.length === 0) return 0;

    for (let i = 0; i < records.length; i += BATCH_CHUNK_SIZE) {
      const chunk = records.slice(i, i + BATCH_CHUNK_SIZE);
      try {
        const batch = this.pb.createBatch();
        for (const rec of chunk) {
          batch.collection(PB_CAR_COLLECTIONS.CARROS).delete(rec.id);
        }
        await batch.send();
      } catch {
        for (const rec of chunk) {
          await this.pb.collection(PB_CAR_COLLECTIONS.CARROS).delete(rec.id);
        }
      }
    }

    return records.length;
  }

  async deleteAllCarros(): Promise<number> {
    await this.ensureAuth();
    const records = await this.pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getFullList<{ id: string }>({ fields: "id" });

    return this.deleteCarroRecordsInBatches(records);
  }

  async deleteInvalidOlxCarros(): Promise<number> {
    await this.ensureAuth();
    const records = await this.pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getFullList<{
        id: string;
        ref?: string;
        text_description?: string;
        brand?: string;
      }>({
        fields: "id,ref,text_description,brand",
      });

    const invalid = records.filter((rec) => {
      const ref = typeof rec.ref === "string" ? rec.ref : "";
      const title =
        typeof rec.text_description === "string" ? rec.text_description : "";
      const brand = typeof rec.brand === "string" ? rec.brand : "";
      if (isNonCarListing(title, ref, brand)) return true;

      const lower = ref.toLowerCase();
      if (!lower.includes("olx.com.br")) return false;
      return (
        lower.includes("/vi/") ||
        lower.includes("rec=") ||
        (!lower.includes("/carros-vans-e-utilitarios/") &&
          !lower.includes("/d/"))
      );
    });

    return this.deleteCarroRecordsInBatches(invalid);
  }

  async countCarros(): Promise<number> {
    await this.ensureAuth();
    const res = await this.pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList(1, 1, { fields: "id" });
    return res.totalItems;
  }

  async getCarrosPrices(): Promise<number[]> {
    await this.ensureAuth();
    const records = await this.pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getFullList<Record<string, unknown>>({
        fields: "price,features",
      });

    const prices: number[] = [];
    for (const rec of records) {
      if (typeof rec.price === "number" && rec.price > 0) {
        prices.push(rec.price);
        continue;
      }
      const parsed =
        typeof rec.features === "string"
          ? parseJsonField(rec.features)
          : rec.features;
      if (parsed && typeof parsed === "object") {
        const p = (parsed as Record<string, unknown>).price;
        if (typeof p === "number" && p > 0) prices.push(p);
      }
    }
    return prices;
  }

  async getAllListings(): Promise<ListingRow[]> {
    await this.ensureAuth();
    const records = await this.pb
      .collection(PB_CAR_COLLECTIONS.LISTINGS)
      .getFullList<Record<string, unknown>>({ sort: "name" });
    return records.map(toListingRow);
  }

  async getListingById(id: string): Promise<ListingRow | null> {
    await this.ensureAuth();
    try {
      const record = await this.pb
        .collection(PB_CAR_COLLECTIONS.LISTINGS)
        .getOne<Record<string, unknown>>(id);
      return toListingRow(record);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async updateListing(id: string, data: ListingUpdate): Promise<void> {
    await this.ensureAuth();
    await this.pb.collection(PB_CAR_COLLECTIONS.LISTINGS).update(id, {
      name: data.name,
      active: data.active,
      last_page: data.lastPage,
      url: data.url ?? "",
      max_pages: data.maxPages,
      delay_ms: data.delayMs,
    });
  }

  async getActiveListingNames(): Promise<string[]> {
    await this.ensureAuth();
    const records = await this.pb
      .collection(PB_CAR_COLLECTIONS.LISTINGS)
      .getFullList<{ name?: string }>({
        filter: "active = true",
        fields: "name",
      });
    return records
      .map((r) => r.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
  }

  private toCrawlerRunRow(record: Record<string, unknown>): CrawlerRunRow {
    const pbId = String(record.id);
    let numericId = this.pbIdToRunId.get(pbId);
    if (numericId === undefined) {
      numericId = this.nextRunId++;
      this.pbIdToRunId.set(pbId, numericId);
      this.pbRunIdMap.set(numericId, pbId);
    }

    return {
      id: numericId,
      siteName: String(record.site_name ?? ""),
      startedAt: toDate(record.started_at) ?? new Date(),
      finishedAt: toDate(record.finished_at),
      status: String(record.status ?? "running"),
      pagesCrawled: toNumberOrNull(record.pages_crawled),
      listingsScraped: toNumberOrNull(record.listings_scraped),
      errors: toNumberOrNull(record.errors),
      errorMsg: typeof record.error_msg === "string" ? record.error_msg : null,
    };
  }

  async createCrawlerRun(siteName: string): Promise<{ id: number }> {
    await this.ensureAuth();
    const id = this.nextRunId++;
    const startedAt = new Date();

    if (!this.useFallbackRuns) {
      try {
        const rec = await this.pb
          .collection(PB_CAR_COLLECTIONS.CRAWLER_RUNS)
          .create<{ id: string }>({
            site_name: siteName,
            started_at: startedAt.toISOString(),
            status: "running",
            pages_crawled: 0,
            listings_scraped: 0,
            errors: 0,
          });
        this.pbRunIdMap.set(id, rec.id);
        this.pbIdToRunId.set(rec.id, id);
        return { id };
      } catch (err) {
        if (!isMissingCollectionError(err)) throw err;
        this.useFallbackRuns = true;
      }
    }

    this.fallbackRuns.unshift({
      id,
      siteName,
      startedAt,
      finishedAt: null,
      status: "running",
      pagesCrawled: 0,
      listingsScraped: 0,
      errors: 0,
      errorMsg: null,
    });
    return { id };
  }

  async finishCrawlerRun(id: number, data: CrawlerRunFinish): Promise<void> {
    await this.ensureAuth();
    const pbId = this.pbRunIdMap.get(id);

    if (!this.useFallbackRuns && pbId) {
      try {
        const payload: Record<string, unknown> = {
          finished_at: data.finishedAt ?? new Date().toISOString(),
        };
        if (data.status !== undefined) payload.status = data.status;
        if (data.pagesCrawled !== undefined) {
          payload.pages_crawled = data.pagesCrawled;
        }
        if (data.listingsScraped !== undefined) {
          payload.listings_scraped = data.listingsScraped;
        }
        if (data.errors !== undefined) payload.errors = data.errors;
        if (data.errorMsg !== undefined) payload.error_msg = data.errorMsg;

        await this.pb
          .collection(PB_CAR_COLLECTIONS.CRAWLER_RUNS)
          .update(pbId, payload);
        return;
      } catch (err) {
        if (!isMissingCollectionError(err)) throw err;
        this.useFallbackRuns = true;
      }
    }

    const row = this.fallbackRuns.find((r) => r.id === id);
    if (row) {
      row.finishedAt = data.finishedAt ? new Date(data.finishedAt) : new Date();
      if (data.status !== undefined) row.status = data.status;
      if (data.pagesCrawled !== undefined) row.pagesCrawled = data.pagesCrawled;
      if (data.listingsScraped !== undefined) {
        row.listingsScraped = data.listingsScraped;
      }
      if (data.errors !== undefined) row.errors = data.errors;
      if (data.errorMsg !== undefined) row.errorMsg = data.errorMsg;
    }
  }

  async getLatestCrawlerRuns(limit: number): Promise<CrawlerRunRow[]> {
    await this.ensureAuth();

    if (!this.useFallbackRuns) {
      try {
        const res = await this.pb
          .collection(PB_CAR_COLLECTIONS.CRAWLER_RUNS)
          .getList<Record<string, unknown>>(1, limit, { sort: "-started_at" });
        return res.items.map((r) => this.toCrawlerRunRow(r));
      } catch (err) {
        if (!isMissingCollectionError(err)) throw err;
        this.useFallbackRuns = true;
      }
    }

    return this.fallbackRuns.slice(0, limit);
  }

  async getLatestPerSite(): Promise<CrawlerRunRow[]> {
    const all = await this.getLatestCrawlerRuns(200);
    const seen = new Set<string>();
    const result: CrawlerRunRow[] = [];
    for (const run of all) {
      if (!seen.has(run.siteName)) {
        seen.add(run.siteName);
        result.push(run);
      }
    }
    return result;
  }

  async countErrorsSince(days: number): Promise<number> {
    const cutoff = Date.now() - days * 86_400_000;
    const runs = await this.getLatestCrawlerRuns(500);
    return runs
      .filter((r) => r.startedAt.getTime() >= cutoff)
      .reduce((acc, r) => acc + (r.errors ?? 0), 0);
  }

  async countRunsSince(days: number): Promise<number> {
    const cutoff = Date.now() - days * 86_400_000;
    const runs = await this.getLatestCrawlerRuns(500);
    return runs.filter((r) => r.startedAt.getTime() >= cutoff).length;
  }

  async insertCrawlerLog(data: CrawlerLogInsert): Promise<void> {
    await this.ensureAuth();
    const createdAt = data.createdAt ?? new Date();

    if (!this.useFallbackLogs) {
      try {
        await this.pb.collection(PB_CAR_COLLECTIONS.CRAWLER_LOGS).create({
          level: data.level,
          message: data.message,
          context: data.context ?? null,
          created_at: createdAt.toISOString(),
        });
        return;
      } catch (err) {
        if (!isMissingCollectionError(err)) throw err;
        this.useFallbackLogs = true;
      }
    }

    this.fallbackLogs.unshift({
      id: this.nextLogId++,
      level: data.level,
      message: data.message,
      context: data.context ? JSON.stringify(data.context) : null,
      createdAt,
    });
  }

  async getLatestCrawlerLogs(limit: number): Promise<CrawlerLogRow[]> {
    await this.ensureAuth();

    if (!this.useFallbackLogs) {
      try {
        const res = await this.pb
          .collection(PB_CAR_COLLECTIONS.CRAWLER_LOGS)
          .getList<Record<string, unknown>>(1, limit, { sort: "-created_at" });
        return res.items.map((r) => ({
          id: String(r.id),
          level: String(r.level ?? "info"),
          message: String(r.message ?? ""),
          context: serializeJsonField(r.context),
          createdAt: toDate(r.created_at) ?? toDate(r.created) ?? new Date(),
        }));
      } catch (err) {
        if (!isMissingCollectionError(err)) throw err;
        this.useFallbackLogs = true;
      }
    }

    return this.fallbackLogs.slice(0, limit);
  }
}
