import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { isNonCarListing } from "../utils/car-parser";
import {
  DEFAULT_OLX_BLUMENAU_URL,
  DEFAULT_OLX_CARS_URL,
  DEFAULT_SEED_LISTINGS,
  LEGACY_OLX_BLUMENAU_URL,
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

function resolveSqlitePath(rawUrl?: string): string {
  const url = rawUrl ?? process.env.DATABASE_URL ?? "./data/carros.db";
  if (url === ":memory:") return ":memory:";
  if (url.startsWith("sqlite://")) return url.slice("sqlite://".length);
  if (url.startsWith("file://")) return url.slice("file://".length);
  return url;
}

function toDateOrNull(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function mapCarroRow(row: Record<string, unknown>): CarroRow {
  return {
    id: String(row.id),
    ref: String(row.ref),
    textDescription:
      typeof row.text_description === "string" ? row.text_description : null,
    features: typeof row.features === "string" ? row.features : null,
    idListing: typeof row.id_listing === "string" ? row.id_listing : null,
    images: typeof row.images === "string" ? row.images : null,
    imageUrls: typeof row.image_urls === "string" ? row.image_urls : null,
    price: typeof row.price === "number" ? row.price : null,
    year: typeof row.year === "number" ? row.year : null,
    mileageKm: typeof row.mileage_km === "number" ? row.mileage_km : null,
    brand: typeof row.brand === "string" ? row.brand : null,
    model: typeof row.model === "string" ? row.model : null,
    version: typeof row.version === "string" ? row.version : null,
    transmission:
      typeof row.transmission === "string" ? row.transmission : null,
    fuel: typeof row.fuel === "string" ? row.fuel : null,
    color: typeof row.color === "string" ? row.color : null,
    bodyType: typeof row.body_type === "string" ? row.body_type : null,
    engineSize: typeof row.engine_size === "string" ? row.engine_size : null,
    isTurbo: Boolean(row.is_turbo),
    sellerType: typeof row.seller_type === "string" ? row.seller_type : null,
    neighborhood:
      typeof row.neighborhood === "string" ? row.neighborhood : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    fipePrice: typeof row.fipe_price === "number" ? row.fipe_price : null,
    fipeCode: typeof row.fipe_code === "string" ? row.fipe_code : null,
    fipeBrand: typeof row.fipe_brand === "string" ? row.fipe_brand : null,
    fipeModel: typeof row.fipe_model === "string" ? row.fipe_model : null,
    fipeYear: typeof row.fipe_year === "number" ? row.fipe_year : null,
    fipeRefPeriod:
      typeof row.fipe_ref_period === "string" ? row.fipe_ref_period : null,
    fipeDiffPct:
      typeof row.fipe_diff_pct === "number" ? row.fipe_diff_pct : null,
    isFavorite: Boolean(row.is_favorite),
    isHidden: Boolean(row.is_hidden),
    notes: typeof row.notes === "string" ? row.notes : null,
    firstSeenAt: toDateOrNull(row.first_seen_at),
    lastSeenAt: toDateOrNull(row.last_seen_at),
    initialPrice: typeof row.initial_price === "number" ? row.initial_price : null,
    lowestPrice: typeof row.lowest_price === "number" ? row.lowest_price : null,
    highestPrice: typeof row.highest_price === "number" ? row.highest_price : null,
    priceChangesCount:
      typeof row.price_changes_count === "number" ? row.price_changes_count : 0,
    lastPriceChangeAt: toDateOrNull(row.last_price_change_at),
    listingStatus:
      typeof row.listing_status === "string" ? row.listing_status : "active",
    created: toDateOrNull(row.created),
    updated: toDateOrNull(row.updated),
  };
}

function mapCarroHistoryRow(row: Record<string, unknown>): CarroHistoryRow {
  return {
    id: String(row.id),
    carroId: String(row.carro_id ?? ""),
    ref: String(row.ref),
    idListing: typeof row.id_listing === "string" ? row.id_listing : null,
    portal: String(row.portal ?? ""),
    textDescription:
      typeof row.text_description === "string" ? row.text_description : null,
    brand: typeof row.brand === "string" ? row.brand : null,
    model: typeof row.model === "string" ? row.model : null,
    version: typeof row.version === "string" ? row.version : null,
    year: typeof row.year === "number" ? row.year : null,
    manufactureYear:
      typeof row.manufacture_year === "number" ? row.manufacture_year : null,
    price: typeof row.price === "number" ? row.price : null,
    previousPrice:
      typeof row.previous_price === "number" ? row.previous_price : null,
    priceDelta: typeof row.price_delta === "number" ? row.price_delta : null,
    mileageKm: typeof row.mileage_km === "number" ? row.mileage_km : null,
    previousMileageKm:
      typeof row.previous_mileage_km === "number" ? row.previous_mileage_km : null,
    transmission:
      typeof row.transmission === "string" ? row.transmission : null,
    fuel: typeof row.fuel === "string" ? row.fuel : null,
    engineSize: typeof row.engine_size === "string" ? row.engine_size : null,
    isTurbo: Boolean(row.is_turbo),
    sellerType: typeof row.seller_type === "string" ? row.seller_type : null,
    neighborhood:
      typeof row.neighborhood === "string" ? row.neighborhood : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    fipePrice: typeof row.fipe_price === "number" ? row.fipe_price : null,
    fipeCode: typeof row.fipe_code === "string" ? row.fipe_code : null,
    fipeBrand: typeof row.fipe_brand === "string" ? row.fipe_brand : null,
    fipeModel: typeof row.fipe_model === "string" ? row.fipe_model : null,
    fipeYear: typeof row.fipe_year === "number" ? row.fipe_year : null,
    fipeRefPeriod:
      typeof row.fipe_ref_period === "string" ? row.fipe_ref_period : null,
    fipeDiffPct:
      typeof row.fipe_diff_pct === "number" ? row.fipe_diff_pct : null,
    eventType: String(row.event_type ?? "snapshot"),
    recordedAt: toDateOrNull(row.recorded_at) ?? new Date(),
  };
}

function mapCarAlertRow(row: Record<string, unknown>): CarAlertRow {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? ""),
    active: Boolean(row.active),
    searchQuery: String(row.search_query ?? ""),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    version: String(row.version ?? ""),
    fipeCode: String(row.fipe_code ?? ""),
    city: String(row.city ?? ""),
    portal: String(row.portal ?? ""),
    motorizacao: String(row.motorizacao ?? ""),
    transmission: String(row.transmission ?? ""),
    fuel: String(row.fuel ?? ""),
    minYear: typeof row.min_year === "number" ? row.min_year : 0,
    maxYear: typeof row.max_year === "number" ? row.max_year : 0,
    minPrice: typeof row.min_price === "number" ? row.min_price : 0,
    maxPrice: typeof row.max_price === "number" ? row.max_price : 0,
    maxKm: typeof row.max_km === "number" ? row.max_km : 0,
    onlyBelowFipe: Boolean(row.only_below_fipe),
    minFipeDiscountPct:
      typeof row.min_fipe_discount_pct === "number"
        ? row.min_fipe_discount_pct
        : 0,
    notifyOnNew: Boolean(row.notify_on_new),
    notifyOnPriceDrop: Boolean(row.notify_on_price_drop),
    lastCheckedAt: toDateOrNull(row.last_checked_at),
    lastMatchedAt: toDateOrNull(row.last_matched_at),
    matchesCount: typeof row.matches_count === "number" ? row.matches_count : 0,
  };
}

function mapListingRow(row: Record<string, unknown>): ListingRow {
  return {
    id: String(row.id),
    name: String(row.name),
    active: Boolean(row.active),
    lastPage: typeof row.last_page === "number" ? row.last_page : 1,
    url: typeof row.url === "string" ? row.url : null,
    maxPages: typeof row.max_pages === "number" ? row.max_pages : 50,
    delayMs: typeof row.delay_ms === "number" ? row.delay_ms : 2500,
    created: toDateOrNull(row.created),
    updated: toDateOrNull(row.updated),
  };
}

function mapCrawlerRunRow(row: Record<string, unknown>): CrawlerRunRow {
  return {
    id: Number(row.id),
    siteName: String(row.site_name),
    startedAt: toDateOrNull(row.started_at) ?? new Date(),
    finishedAt: toDateOrNull(row.finished_at),
    status: String(row.status ?? "running"),
    pagesCrawled:
      typeof row.pages_crawled === "number" ? row.pages_crawled : null,
    listingsScraped:
      typeof row.listings_scraped === "number" ? row.listings_scraped : null,
    errors: typeof row.errors === "number" ? row.errors : null,
    errorMsg: typeof row.error_msg === "string" ? row.error_msg : null,
  };
}

export class SqliteAdapter implements DbAdapter {
  private db: Database;
  private initialized = false;

  constructor(databaseUrl?: string) {
    const filePath = resolveSqlitePath(databaseUrl);
    if (filePath !== ":memory:") {
      mkdirSync(dirname(filePath), { recursive: true });
    }
    this.db = new Database(filePath);
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA foreign_keys = ON;");
  }

  getDatabase(): Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  async ensureSchema(): Promise<void> {
    if (this.initialized) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS car_listings (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1,
        last_page INTEGER NOT NULL DEFAULT 1,
        url TEXT,
        max_pages INTEGER NOT NULL DEFAULT 50,
        delay_ms INTEGER NOT NULL DEFAULT 2500,
        created TEXT,
        updated TEXT
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS carros_temp (
        id TEXT PRIMARY KEY,
        ref TEXT NOT NULL UNIQUE,
        text_description TEXT,
        features TEXT,
        id_listing TEXT,
        images TEXT,
        image_urls TEXT,
        price REAL DEFAULT 0,
        year INTEGER DEFAULT 0,
        mileage_km INTEGER DEFAULT 0,
        brand TEXT DEFAULT '',
        model TEXT DEFAULT '',
        version TEXT DEFAULT '',
        transmission TEXT DEFAULT '',
        fuel TEXT DEFAULT '',
        color TEXT DEFAULT '',
        body_type TEXT DEFAULT '',
        engine_size TEXT DEFAULT '',
        is_turbo INTEGER NOT NULL DEFAULT 0,
        seller_type TEXT DEFAULT '',
        neighborhood TEXT DEFAULT '',
        city TEXT DEFAULT '',
        state TEXT DEFAULT '',
        fipe_price REAL DEFAULT 0,
        fipe_code TEXT DEFAULT '',
        fipe_brand TEXT DEFAULT '',
        fipe_model TEXT DEFAULT '',
        fipe_year INTEGER DEFAULT 0,
        fipe_ref_period TEXT DEFAULT '',
        fipe_diff_pct REAL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        first_seen_at TEXT,
        last_seen_at TEXT,
        initial_price REAL DEFAULT 0,
        lowest_price REAL DEFAULT 0,
        highest_price REAL DEFAULT 0,
        price_changes_count INTEGER NOT NULL DEFAULT 0,
        last_price_change_at TEXT,
        listing_status TEXT NOT NULL DEFAULT 'active',
        created TEXT,
        updated TEXT
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS carros_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        carro_id TEXT,
        ref TEXT NOT NULL,
        id_listing TEXT,
        portal TEXT,
        text_description TEXT,
        brand TEXT DEFAULT '',
        model TEXT DEFAULT '',
        version TEXT DEFAULT '',
        year INTEGER DEFAULT 0,
        manufacture_year INTEGER DEFAULT 0,
        price REAL DEFAULT 0,
        previous_price REAL DEFAULT 0,
        price_delta REAL DEFAULT 0,
        mileage_km INTEGER DEFAULT 0,
        previous_mileage_km INTEGER DEFAULT 0,
        transmission TEXT DEFAULT '',
        fuel TEXT DEFAULT '',
        engine_size TEXT DEFAULT '',
        is_turbo INTEGER NOT NULL DEFAULT 0,
        seller_type TEXT DEFAULT '',
        neighborhood TEXT DEFAULT '',
        city TEXT DEFAULT '',
        state TEXT DEFAULT '',
        fipe_price REAL DEFAULT 0,
        fipe_code TEXT DEFAULT '',
        fipe_brand TEXT DEFAULT '',
        fipe_model TEXT DEFAULT '',
        fipe_year INTEGER DEFAULT 0,
        fipe_ref_period TEXT DEFAULT '',
        fipe_diff_pct REAL DEFAULT 0,
        event_type TEXT NOT NULL DEFAULT 'snapshot',
        recorded_at TEXT NOT NULL
      );
    `);

    this.db.run("CREATE INDEX IF NOT EXISTS idx_history_ref_date ON carros_history (ref, recorded_at DESC);");

    this.db.run(`
      CREATE TABLE IF NOT EXISTS car_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        search_query TEXT DEFAULT '',
        brand TEXT DEFAULT '',
        model TEXT DEFAULT '',
        version TEXT DEFAULT '',
        fipe_code TEXT DEFAULT '',
        city TEXT DEFAULT '',
        portal TEXT DEFAULT '',
        motorizacao TEXT DEFAULT '',
        transmission TEXT DEFAULT '',
        fuel TEXT DEFAULT '',
        min_year INTEGER DEFAULT 0,
        max_year INTEGER DEFAULT 0,
        min_price REAL DEFAULT 0,
        max_price REAL DEFAULT 0,
        max_km INTEGER DEFAULT 0,
        only_below_fipe INTEGER NOT NULL DEFAULT 0,
        min_fipe_discount_pct REAL DEFAULT 0,
        notify_on_new INTEGER NOT NULL DEFAULT 1,
        notify_on_price_drop INTEGER NOT NULL DEFAULT 1,
        last_checked_at TEXT,
        last_matched_at TEXT,
        matches_count INTEGER NOT NULL DEFAULT 0
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS car_alert_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        alert_id TEXT NOT NULL,
        carro_id TEXT,
        car_ref TEXT NOT NULL,
        car_title TEXT,
        brand TEXT DEFAULT '',
        model TEXT DEFAULT '',
        year INTEGER DEFAULT 0,
        mileage_km INTEGER DEFAULT 0,
        price REAL DEFAULT 0,
        previous_price REAL DEFAULT 0,
        fipe_price REAL DEFAULT 0,
        fipe_diff_pct REAL DEFAULT 0,
        portal TEXT DEFAULT '',
        city TEXT DEFAULT '',
        trigger_type TEXT NOT NULL,
        dedup_key TEXT NOT NULL UNIQUE,
        is_read INTEGER NOT NULL DEFAULT 0,
        read_at TEXT,
        triggered_at TEXT NOT NULL
      );
    `);

    this.db.run("CREATE INDEX IF NOT EXISTS idx_carros_updated ON carros_temp (updated DESC);");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_carros_city_price ON carros_temp (city, price);");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_carros_fipe ON carros_temp (fipe_price, fipe_diff_pct);");

    this.db.run(`
      CREATE TABLE IF NOT EXISTS car_crawler_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        pages_crawled INTEGER DEFAULT 0,
        listings_scraped INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        error_msg TEXT
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS car_crawler_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );
    `);

    const now = new Date().toISOString();
    const insertListing = this.db.prepare(`
      INSERT OR IGNORE INTO car_listings (id, name, active, last_page, url, max_pages, delay_ms, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const seed of DEFAULT_SEED_LISTINGS) {
      insertListing.run(
        seed.id,
        seed.name,
        seed.active ? 1 : 0,
        seed.lastPage,
        seed.url,
        seed.maxPages,
        seed.delayMs,
        now,
        now,
      );
    }

    this.db
      .prepare(
        "UPDATE car_listings SET url = ?, updated = ? WHERE name = 'olx-carros' AND (url = ? OR url = ?)",
      )
      .run(
        DEFAULT_OLX_CARS_URL,
        now,
        LEGACY_OLX_CARS_URL,
        LEGACY_OLX_JOINVILLE_URL,
      );

    this.db
      .prepare(
        "UPDATE car_listings SET url = ?, updated = ? WHERE name = 'olx-blumenau' AND url = ?",
      )
      .run(DEFAULT_OLX_BLUMENAU_URL, now, LEGACY_OLX_BLUMENAU_URL);

    this.initialized = true;
  }

  async findCarroByRef(ref: string): Promise<{ id: string } | null> {
    const row = this.db
      .prepare("SELECT id FROM carros_temp WHERE ref = ? LIMIT 1")
      .get(ref) as { id: string } | null;
    return row ? { id: row.id } : null;
  }

  async getCarroById(id: string): Promise<CarroRow | null> {
    const row = this.db
      .prepare("SELECT * FROM carros_temp WHERE id = ? LIMIT 1")
      .get(id) as Record<string, unknown> | null;
    return row ? mapCarroRow(row) : null;
  }

  async getCarrosByRef(ref: string): Promise<CarroRow[]> {
    const rows = this.db
      .prepare("SELECT * FROM carros_temp WHERE ref = ?")
      .all(ref) as Record<string, unknown>[];
    return rows.map(mapCarroRow);
  }

  async insertCarro(data: CarroInsert): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO carros_temp (
          id, ref, text_description, features, id_listing, images, image_urls,
          price, year, mileage_km, brand, model, version, transmission, fuel,
          color, body_type, engine_size, is_turbo, seller_type, neighborhood, city, state,
          fipe_price, fipe_code, fipe_brand, fipe_model, fipe_year, fipe_ref_period, fipe_diff_pct,
          is_favorite, is_hidden, notes,
          first_seen_at, last_seen_at, initial_price, lowest_price, highest_price,
          price_changes_count, last_price_change_at, listing_status,
          created, updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.id,
        data.ref,
        data.textDescription ?? null,
        data.features ?? null,
        data.idListing ?? null,
        data.images,
        data.images,
        data.price,
        data.year,
        data.mileageKm,
        data.brand ?? "",
        data.model ?? "",
        data.version ?? "",
        data.transmission ?? "",
        data.fuel ?? "",
        data.color ?? "",
        data.bodyType ?? "",
        data.engineSize ?? "",
        data.isTurbo ? 1 : 0,
        data.sellerType ?? "",
        data.neighborhood ?? "",
        data.city ?? "",
        data.state ?? "",
        data.fipePrice ?? 0,
        data.fipeCode ?? "",
        data.fipeBrand ?? "",
        data.fipeModel ?? "",
        data.fipeYear ?? 0,
        data.fipeRefPeriod ?? "",
        data.fipeDiffPct ?? 0,
        (data.firstSeenAt ?? data.created).toISOString(),
        (data.lastSeenAt ?? data.updated).toISOString(),
        data.initialPrice ?? data.price,
        data.lowestPrice ?? data.price,
        data.highestPrice ?? data.price,
        data.priceChangesCount ?? 0,
        data.lastPriceChangeAt ? data.lastPriceChangeAt.toISOString() : null,
        data.listingStatus ?? "active",
        data.created.toISOString(),
        data.updated.toISOString(),
      );
  }

  async updateCarro(id: string, data: CarroUpdate): Promise<void> {
    this.db
      .prepare(
        `UPDATE carros_temp SET
          text_description = ?, features = ?, id_listing = ?, images = ?, image_urls = ?,
          price = ?, year = ?, mileage_km = ?, brand = ?, model = ?, version = ?,
          transmission = ?, fuel = ?, color = ?, body_type = ?, engine_size = ?, is_turbo = ?,
          seller_type = ?, neighborhood = ?, city = ?, state = ?,
          fipe_price = ?, fipe_code = ?, fipe_brand = ?, fipe_model = ?, fipe_year = ?,
          fipe_ref_period = ?, fipe_diff_pct = ?,
          first_seen_at = COALESCE(?, first_seen_at),
          last_seen_at = COALESCE(?, last_seen_at),
          initial_price = COALESCE(?, initial_price),
          lowest_price = COALESCE(?, lowest_price),
          highest_price = COALESCE(?, highest_price),
          price_changes_count = COALESCE(?, price_changes_count),
          last_price_change_at = COALESCE(?, last_price_change_at),
          listing_status = COALESCE(?, listing_status),
          updated = ?
        WHERE id = ?`,
      )
      .run(
        data.textDescription ?? null,
        data.features ?? null,
        data.idListing ?? null,
        data.images,
        data.images,
        data.price,
        data.year,
        data.mileageKm,
        data.brand ?? "",
        data.model ?? "",
        data.version ?? "",
        data.transmission ?? "",
        data.fuel ?? "",
        data.color ?? "",
        data.bodyType ?? "",
        data.engineSize ?? "",
        data.isTurbo ? 1 : 0,
        data.sellerType ?? "",
        data.neighborhood ?? "",
        data.city ?? "",
        data.state ?? "",
        data.fipePrice ?? 0,
        data.fipeCode ?? "",
        data.fipeBrand ?? "",
        data.fipeModel ?? "",
        data.fipeYear ?? 0,
        data.fipeRefPeriod ?? "",
        data.fipeDiffPct ?? 0,
        data.firstSeenAt ? data.firstSeenAt.toISOString() : null,
        data.lastSeenAt ? data.lastSeenAt.toISOString() : null,
        data.initialPrice ?? null,
        data.lowestPrice ?? null,
        data.highestPrice ?? null,
        data.priceChangesCount ?? null,
        data.lastPriceChangeAt ? data.lastPriceChangeAt.toISOString() : null,
        data.listingStatus ?? "active",
        data.updated.toISOString(),
        id,
      );
  }

  async updateCarroFipe(id: string, data: CarroFipePatch): Promise<void> {
    this.db
      .prepare(
        `UPDATE carros_temp SET
          engine_size = COALESCE(NULLIF(?, ''), engine_size),
          is_turbo = CASE WHEN ? = 1 THEN 1 ELSE is_turbo END,
          transmission = COALESCE(NULLIF(?, ''), transmission),
          fuel = COALESCE(NULLIF(?, ''), fuel),
          fipe_price = ?,
          fipe_code = ?,
          fipe_brand = ?,
          fipe_model = ?,
          fipe_year = ?,
          fipe_ref_period = ?,
          fipe_diff_pct = ?,
          updated = ?
        WHERE id = ?`,
      )
      .run(
        data.engineSize ?? "",
        data.isTurbo ? 1 : 0,
        data.transmission ?? "",
        data.fuel ?? "",
        data.fipePrice,
        data.fipeCode,
        data.fipeBrand,
        data.fipeModel,
        data.fipeYear,
        data.fipeRefPeriod,
        data.fipeDiffPct,
        new Date().toISOString(),
        id,
      );
  }

  async getCarrosMissingFipe(limit: number): Promise<CarroRow[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM carros_temp WHERE (fipe_code IS NULL OR fipe_code = '') AND year > 0 LIMIT ?",
      )
      .all(limit) as Record<string, unknown>[];
    return rows.map(mapCarroRow);
  }

  async getActiveCarrosStaleSince(
    seenBefore: Date,
    limit: number,
    idListing?: string,
  ): Promise<CarroRow[]> {
    const cutoff = seenBefore.toISOString();
    const sql = idListing
      ? `SELECT * FROM carros_temp
         WHERE (listing_status = '' OR listing_status = 'active')
           AND id_listing = ?
           AND COALESCE(last_seen_at, updated, created) < ?
         ORDER BY COALESCE(last_seen_at, updated, created) ASC
         LIMIT ?`
      : `SELECT * FROM carros_temp
         WHERE (listing_status = '' OR listing_status = 'active')
           AND COALESCE(last_seen_at, updated, created) < ?
         ORDER BY COALESCE(last_seen_at, updated, created) ASC
         LIMIT ?`;
    const rows = (
      idListing
        ? this.db.prepare(sql).all(idListing, cutoff, limit)
        : this.db.prepare(sql).all(cutoff, limit)
    ) as Record<string, unknown>[];
    return rows.map(mapCarroRow);
  }

  async patchCarro(id: string, data: CarroPatch): Promise<void> {
    const sets: string[] = ["updated = ?"];
    const params: SQLQueryBindings[] = [data.updated.toISOString()];

    if (data.textDescription !== undefined) {
      sets.push("text_description = ?");
      params.push(data.textDescription);
    }
    if (data.features !== undefined) {
      sets.push("features = ?");
      params.push(data.features);
    }
    if (data.isFavorite !== undefined) {
      sets.push("is_favorite = ?");
      params.push(data.isFavorite ? 1 : 0);
    }
    if (data.isHidden !== undefined) {
      sets.push("is_hidden = ?");
      params.push(data.isHidden ? 1 : 0);
    }
    if (data.notes !== undefined) {
      sets.push("notes = ?");
      params.push(data.notes);
    }
    if (data.listingStatus !== undefined) {
      sets.push("listing_status = ?");
      params.push(data.listingStatus);
    }
    if (data.lastSeenAt !== undefined) {
      sets.push("last_seen_at = ?");
      params.push(data.lastSeenAt.toISOString());
    }
    params.push(id);
    this.db
      .prepare(`UPDATE carros_temp SET ${sets.join(", ")} WHERE id = ?`)
      .run(...params);
  }

  async insertCarroHistory(data: CarroHistoryInsert): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO carros_history (
          carro_id, ref, id_listing, portal, text_description,
          brand, model, version, year, manufacture_year,
          price, previous_price, price_delta, mileage_km, previous_mileage_km,
          transmission, fuel, engine_size, is_turbo, seller_type,
          neighborhood, city, state, fipe_price, fipe_code, fipe_brand,
          fipe_model, fipe_year, fipe_ref_period, fipe_diff_pct,
          event_type, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.carroId,
        data.ref,
        data.idListing ?? "",
        data.portal,
        data.textDescription ?? "",
        data.brand ?? "",
        data.model ?? "",
        data.version ?? "",
        data.year,
        data.manufactureYear ?? 0,
        data.price,
        data.previousPrice ?? 0,
        data.priceDelta ?? 0,
        data.mileageKm,
        data.previousMileageKm ?? 0,
        data.transmission ?? "",
        data.fuel ?? "",
        data.engineSize ?? "",
        data.isTurbo ? 1 : 0,
        data.sellerType ?? "",
        data.neighborhood ?? "",
        data.city ?? "",
        data.state ?? "",
        data.fipePrice ?? 0,
        data.fipeCode ?? "",
        data.fipeBrand ?? "",
        data.fipeModel ?? "",
        data.fipeYear ?? 0,
        data.fipeRefPeriod ?? "",
        data.fipeDiffPct ?? 0,
        data.eventType,
        data.recordedAt.toISOString(),
      );
  }

  async getLatestCarroHistorySnapshot(ref: string): Promise<CarroHistoryRow | null> {
    const row = this.db
      .prepare("SELECT * FROM carros_history WHERE ref = ? ORDER BY recorded_at DESC, id DESC LIMIT 1")
      .get(ref) as Record<string, unknown> | null;
    return row ? mapCarroHistoryRow(row) : null;
  }

  async getCarroHistoryByRef(ref: string, limit = 100): Promise<CarroHistoryRow[]> {
    const rows = this.db
      .prepare("SELECT * FROM carros_history WHERE ref = ? ORDER BY recorded_at DESC, id DESC LIMIT ?")
      .all(ref, limit) as Record<string, unknown>[];
    return rows.map(mapCarroHistoryRow);
  }

  async backfillMissingCarroHistory(limit = 300): Promise<number> {
    const rows = this.db
      .prepare(
        `SELECT c.* FROM carros_temp c
         LEFT JOIN carros_history h ON h.ref = c.ref
         WHERE h.id IS NULL AND c.price > 0
         LIMIT ?`,
      )
      .all(limit) as Record<string, unknown>[];

    let count = 0;
    for (const raw of rows) {
      const car = mapCarroRow(raw);
      const lowerRef = car.ref.toLowerCase();
      const portal = lowerRef.includes("olx.com.br")
        ? "OLX Carros"
        : lowerRef.includes("webmotors.com.br")
          ? "Webmotors"
          : "Outro portal";
      await this.insertCarroHistory({
        carroId: car.id,
        ref: car.ref,
        idListing: car.idListing,
        portal,
        textDescription: car.textDescription,
        brand: car.brand ?? undefined,
        model: car.model ?? undefined,
        version: car.version ?? undefined,
        year: car.year ?? 0,
        price: car.price ?? 0,
        mileageKm: car.mileageKm ?? 0,
        transmission: car.transmission ?? undefined,
        fuel: car.fuel ?? undefined,
        engineSize: car.engineSize ?? undefined,
        isTurbo: car.isTurbo,
        sellerType: car.sellerType ?? undefined,
        neighborhood: car.neighborhood ?? undefined,
        city: car.city ?? undefined,
        state: car.state ?? undefined,
        fipePrice: car.fipePrice ?? 0,
        fipeCode: car.fipeCode ?? undefined,
        fipeBrand: car.fipeBrand ?? undefined,
        fipeModel: car.fipeModel ?? undefined,
        fipeYear: car.fipeYear ?? 0,
        fipeRefPeriod: car.fipeRefPeriod ?? undefined,
        fipeDiffPct: car.fipeDiffPct ?? 0,
        eventType: "first_seen",
        recordedAt: car.firstSeenAt ?? car.created ?? car.updated ?? new Date(),
      });
      count++;
    }
    return count;
  }

  async getActiveCarAlerts(): Promise<CarAlertRow[]> {
    const rows = this.db
      .prepare("SELECT * FROM car_alerts WHERE active = 1")
      .all() as Record<string, unknown>[];
    return rows.map(mapCarAlertRow);
  }

  async insertAlertNotification(data: CarAlertNotificationInsert): Promise<boolean> {
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO car_alert_notifications (
          user_id, alert_id, carro_id, car_ref, car_title,
          brand, model, year, mileage_km, price, previous_price,
          fipe_price, fipe_diff_pct, portal, city, trigger_type,
          dedup_key, is_read, read_at, triggered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
      )
      .run(
        data.userId,
        data.alertId,
        data.carroId,
        data.carRef,
        data.carTitle,
        data.brand ?? "",
        data.model ?? "",
        data.year ?? 0,
        data.mileageKm ?? 0,
        data.price,
        data.previousPrice ?? 0,
        data.fipePrice ?? 0,
        data.fipeDiffPct ?? 0,
        data.portal,
        data.city ?? "",
        data.triggerType,
        data.dedupKey,
        data.triggeredAt.toISOString(),
      );
    return res.changes > 0;
  }

  async updateCarAlertStats(
    alertId: string,
    patch: {
      lastCheckedAt: Date;
      lastMatchedAt?: Date;
      matchesIncrement?: number;
    },
  ): Promise<void> {
    this.db
      .prepare(
        `UPDATE car_alerts
         SET last_checked_at = ?,
             last_matched_at = COALESCE(?, last_matched_at),
             matches_count = matches_count + ?
         WHERE id = ?`,
      )
      .run(
        patch.lastCheckedAt.toISOString(),
        patch.lastMatchedAt ? patch.lastMatchedAt.toISOString() : null,
        patch.matchesIncrement ?? 0,
        alertId,
      );
  }

  async deleteCarro(id: string): Promise<void> {
    this.db.prepare("DELETE FROM carros_temp WHERE id = ?").run(id);
  }

  async deleteAllCarros(): Promise<number> {
    const res = this.db.prepare("DELETE FROM carros_temp").run();
    return res.changes;
  }

  async deleteInvalidOlxCarros(): Promise<number> {
    const rows = this.db
      .prepare("SELECT id, ref, text_description, brand FROM carros_temp")
      .all() as Array<{
      id: string;
      ref: string;
      text_description: string | null;
      brand: string | null;
    }>;

    const invalidIds = rows
      .filter((r) => {
        if (isNonCarListing(r.text_description, r.ref, r.brand)) return true;
        const lower = r.ref.toLowerCase();
        if (!lower.includes("olx.com.br")) return false;
        return (
          lower.includes("/vi/") ||
          lower.includes("rec=") ||
          (!lower.includes("/carros-vans-e-utilitarios/") &&
            !lower.includes("/d/"))
        );
      })
      .map((r) => r.id);

    if (invalidIds.length === 0) return 0;
    const placeholders = invalidIds.map(() => "?").join(", ");
    const res = this.db
      .prepare(`DELETE FROM carros_temp WHERE id IN (${placeholders})`)
      .run(...invalidIds);
    return res.changes;
  }

  async countCarros(): Promise<number> {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM carros_temp")
      .get() as { cnt: number };
    return row.cnt;
  }

  async getCarrosPrices(): Promise<number[]> {
    const rows = this.db
      .prepare("SELECT price FROM carros_temp WHERE price > 0")
      .all() as Array<{ price: number }>;
    return rows.map((r) => r.price);
  }

  async getAllListings(): Promise<ListingRow[]> {
    const rows = this.db
      .prepare("SELECT * FROM car_listings ORDER BY name ASC")
      .all() as Record<string, unknown>[];
    return rows.map(mapListingRow);
  }

  async getListingById(id: string): Promise<ListingRow | null> {
    const row = this.db
      .prepare("SELECT * FROM car_listings WHERE id = ? LIMIT 1")
      .get(id) as Record<string, unknown> | null;
    return row ? mapListingRow(row) : null;
  }

  async updateListing(id: string, data: ListingUpdate): Promise<void> {
    this.db
      .prepare(
        `UPDATE car_listings
        SET name = ?, active = ?, last_page = ?, url = ?, max_pages = ?, delay_ms = ?, updated = ?
        WHERE id = ?`,
      )
      .run(
        data.name,
        data.active ? 1 : 0,
        data.lastPage,
        data.url ?? null,
        data.maxPages,
        data.delayMs,
        new Date().toISOString(),
        id,
      );
  }

  async getActiveListingNames(): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT name FROM car_listings WHERE active = 1")
      .all() as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }

  async createCrawlerRun(siteName: string): Promise<{ id: number }> {
    const res = this.db
      .prepare(
        `INSERT INTO car_crawler_runs (site_name, started_at, status, pages_crawled, listings_scraped, errors)
         VALUES (?, ?, 'running', 0, 0, 0)`,
      )
      .run(siteName, new Date().toISOString());
    return { id: Number(res.lastInsertRowid) };
  }

  async finishCrawlerRun(id: number, data: CrawlerRunFinish): Promise<void> {
    this.db
      .prepare(
        `UPDATE car_crawler_runs
        SET finished_at = ?, status = COALESCE(?, status),
            pages_crawled = COALESCE(?, pages_crawled),
            listings_scraped = COALESCE(?, listings_scraped),
            errors = COALESCE(?, errors),
            error_msg = COALESCE(?, error_msg)
        WHERE id = ?`,
      )
      .run(
        data.finishedAt ?? new Date().toISOString(),
        data.status ?? null,
        data.pagesCrawled ?? null,
        data.listingsScraped ?? null,
        data.errors ?? null,
        data.errorMsg ?? null,
        id,
      );
  }

  async getLatestCrawlerRuns(limit: number): Promise<CrawlerRunRow[]> {
    const rows = this.db
      .prepare("SELECT * FROM car_crawler_runs ORDER BY id DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map(mapCrawlerRunRow);
  }

  async getLatestPerSite(): Promise<CrawlerRunRow[]> {
    const rows = this.db
      .prepare(
        `SELECT r.* FROM car_crawler_runs r
         INNER JOIN (
           SELECT site_name, MAX(id) as max_id FROM car_crawler_runs GROUP BY site_name
         ) latest ON r.id = latest.max_id
         ORDER BY r.id DESC`,
      )
      .all() as Record<string, unknown>[];
    return rows.map(mapCrawlerRunRow);
  }

  async countErrorsSince(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(errors), 0) as total FROM car_crawler_runs WHERE started_at >= ?`,
      )
      .get(cutoff) as { total: number };
    return row.total;
  }

  async countRunsSince(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as total FROM car_crawler_runs WHERE started_at >= ?`,
      )
      .get(cutoff) as { total: number };
    return row.total;
  }

  async insertCrawlerLog(data: CrawlerLogInsert): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO car_crawler_logs (level, message, context, created_at) VALUES (?, ?, ?, ?)`,
      )
      .run(
        data.level,
        data.message,
        data.context ? JSON.stringify(data.context) : null,
        (data.createdAt ?? new Date()).toISOString(),
      );
  }

  async getLatestCrawlerLogs(limit: number): Promise<CrawlerLogRow[]> {
    const rows = this.db
      .prepare("SELECT * FROM car_crawler_logs ORDER BY id DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id),
      level: String(r.level),
      message: String(r.message),
      context: typeof r.context === "string" ? r.context : null,
      createdAt: toDateOrNull(r.created_at) ?? new Date(),
    }));
  }
}
