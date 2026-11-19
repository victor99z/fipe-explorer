import PocketBase, { ClientResponseError } from "pocketbase";
import { Logger } from "../config/logger";
import { DownloadImageAndCreateFile } from "../utils/download-image";
import {
  DEFAULT_SEED_LISTINGS,
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
  LISTINGS: "car_listings",
  CRAWLER_RUNS: "car_crawler_runs",
  CRAWLER_LOGS: "car_crawler_logs",
} as const;

interface CollectionFieldSpec {
  name: string;
  type: "text" | "number" | "date" | "json" | "bool" | "file" | "autodate";
  required?: boolean;
  maxSelect?: number;
  maxSize?: number;
  mimeTypes?: string[];
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
  { name: "seller_type", type: "text" },
  { name: "neighborhood", type: "text" },
  { name: "city", type: "text" },
  { name: "state", type: "text" },
  { name: "fipe_price", type: "number" },
  { name: "is_favorite", type: "bool" },
  { name: "is_hidden", type: "bool" },
  { name: "notes", type: "text" },
  ...AUTODATE_FIELDS,
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
    sellerType: toStringOrNull(record.seller_type),
    neighborhood: toStringOrNull(record.neighborhood),
    city: toStringOrNull(record.city),
    state: toStringOrNull(record.state),
    fipePrice: toNumberOrNull(record.fipe_price),
    isFavorite: Boolean(record.is_favorite),
    isHidden: Boolean(record.is_hidden),
    notes: toStringOrNull(record.notes),
    created: toDate(record.created),
    updated: toDate(record.updated),
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
        try {
          await this.pb
            .collection("_superusers")
            .authWithPassword(email, password);
        } catch {
          this.pb.authStore.clear?.();
          try {
            await this.pb.admins.authWithPassword(email, password);
          } catch {
            this.pb.authStore.clear?.();
            const res = (await this.pb.send("/api/admins/auth-with-password", {
              method: "POST",
              body: { identity: email, password },
            })) as {
              token?: unknown;
              admin?: Record<string, unknown> | null;
              record?: Record<string, unknown> | null;
            } | null;
            if (!res || typeof res.token !== "string" || !res.token) {
              throw new Error("Failed to authenticate admin with PocketBase.");
            }
            this.pb.authStore.save(
              res.token,
              (res.admin ?? res.record ?? null) as never,
            );
          }
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
  ): Promise<void> {
    if (typeof this.pb.collections?.getOne !== "function") return;
    if (typeof this.pb.collections?.update !== "function") return;
    try {
      const col = (await this.pb.collections.getOne(name)) as {
        id?: string;
        fields?: Array<Record<string, unknown>>;
      };
      if (!col || !Array.isArray(col.fields)) return;
      const existingNames = new Set(
        col.fields.map((f) => String(f.name ?? "")).filter(Boolean),
      );
      const missing = desiredFields.filter((f) => !existingNames.has(f.name));
      if (missing.length === 0) return;
      await this.pb.collections.update(col.id ?? name, {
        fields: [...col.fields, ...missing],
      } as never);
      Logger.info(
        { collection: name, added: missing.map((m) => m.name) },
        `Updated PocketBase collection ${name} with missing fields`,
      );
    } catch {
      // Ignore when collections metadata endpoint is unavailable
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
    } = {},
  ): Promise<boolean> {
    try {
      await this.pb.collection(name).getList(1, 1, { fields: "id" });
      await this.ensureMissingFields(name, fields);
      return true;
    } catch (err) {
      if (!isNotFoundError(err)) {
        return true;
      }
    }

    const basePayload = {
      name,
      type: "base",
      listRule: rules.listRule ?? "",
      viewRule: rules.viewRule ?? "",
      createRule: rules.createRule ?? "@request.auth.id != ''",
      updateRule: rules.updateRule ?? "@request.auth.id != ''",
      deleteRule: rules.deleteRule ?? "@request.auth.id != ''",
    };

    try {
      await this.pb.collections.create({
        ...basePayload,
        fields,
      } as never);
      Logger.info({ collection: name }, `Created PocketBase collection ${name}`);
      return true;
    } catch (err) {
      if (getHttpStatus(err) === 400) {
        try {
          const legacySchema = fields.filter((f) => f.type !== "autodate");
          await this.pb.collections.create({
            ...basePayload,
            schema: legacySchema,
          } as never);
          Logger.info(
            { collection: name },
            `Created PocketBase collection ${name} (legacy schema)`,
          );
          return true;
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
          return false;
        }
      }
      Logger.warn(
        {
          collection: name,
          err: err instanceof Error ? err.message : String(err),
        },
        `Could not auto-create PocketBase collection ${name}`,
      );
      return false;
    }
  }

  async ensureSchema(): Promise<void> {
    await this.ensureAuth();

    await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.LISTINGS,
      CAR_LISTINGS_FIELDS,
    );

    await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.CARROS,
      CARROS_TEMP_FIELDS,
    );

    const runsReady = await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.CRAWLER_RUNS,
      CRAWLER_RUNS_FIELDS,
      { deleteRule: null },
    );
    if (!runsReady) this.useFallbackRuns = true;

    const logsReady = await this.ensureCollectionExists(
      PB_CAR_COLLECTIONS.CRAWLER_LOGS,
      CRAWLER_LOGS_FIELDS,
      { deleteRule: null },
    );
    if (!logsReady) this.useFallbackLogs = true;

    try {
      const existing = await this.pb
        .collection(PB_CAR_COLLECTIONS.LISTINGS)
        .getFullList<{ id: string; name?: string }>({ fields: "id,name" });

      const existingNames = new Set(
        existing.map((r) => r.name).filter((n): n is string => Boolean(n)),
      );

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
      seller_type: data.sellerType ?? "",
      neighborhood: data.neighborhood ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      fipe_price: data.fipePrice ?? 0,
    };

    if ("ref" in data) {
      payload.ref = data.ref;
      payload.is_favorite = false;
      payload.is_hidden = false;
      payload.notes = "";
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
    await this.pb.collection(PB_CAR_COLLECTIONS.CARROS).update(id, body);
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
      .getFullList<{ id: string; ref?: string }>({
        filter: 'ref ~ "olx.com.br"',
        fields: "id,ref",
      });

    const invalid = records.filter((rec) => {
      const ref = typeof rec.ref === "string" ? rec.ref : "";
      const lower = ref.toLowerCase();
      return (
        lower.includes("olx.com.br") &&
        (lower.includes("/vi/") ||
          lower.includes("rec=") ||
          (!lower.includes("/autos-e-pecas/") && !lower.includes("/d/")))
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
