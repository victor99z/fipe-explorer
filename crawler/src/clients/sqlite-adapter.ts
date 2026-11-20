import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { isNonCarListing } from "../utils/car-parser";
import {
  DEFAULT_OLX_CARS_URL,
  DEFAULT_SEED_LISTINGS,
  LEGACY_OLX_CARS_URL,
  type CarroFipePatch,
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
    created: toDateOrNull(row.created),
    updated: toDateOrNull(row.updated),
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
        created TEXT,
        updated TEXT
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
      .prepare("UPDATE car_listings SET url = ?, updated = ? WHERE name = 'olx-carros' AND url = ?")
      .run(DEFAULT_OLX_CARS_URL, now, LEGACY_OLX_CARS_URL);

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
          is_favorite, is_hidden, notes, created, updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '', ?, ?)`,
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
          fipe_ref_period = ?, fipe_diff_pct = ?, updated = ?
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
    params.push(id);
    this.db
      .prepare(`UPDATE carros_temp SET ${sets.join(", ")} WHERE id = ?`)
      .run(...params);
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
