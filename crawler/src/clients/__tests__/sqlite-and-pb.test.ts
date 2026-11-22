import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setAdapter } from "../db";
import { SqliteAdapter } from "../sqlite-adapter";
import { PocketBaseAdapter, PB_CAR_COLLECTIONS } from "../pocketbase-adapter";
import { CarrosRepository } from "../../repository/carros-repository";
import { CrawlerRunsRepository } from "../../repository/crawler-runs-repository";
import { doesCarMatchAlert } from "../../services/alert-matcher";
import type { CarAlertRow } from "../db-adapter";

describe("SqliteAdapter & Repositories integration", () => {
  let adapter: SqliteAdapter;

  beforeEach(async () => {
    adapter = new SqliteAdapter(":memory:");
    setAdapter(adapter);
    await adapter.ensureSchema();
    await CrawlerRunsRepository.init();
  });

  afterEach(() => {
    setAdapter(null);
    adapter.close();
  });

  test("seeds regional olx and webmotors listings including Joinville and Curitiba", async () => {
    const listings = await CarrosRepository.getAllListings();
    expect(listings.map((l) => l.name)).toEqual([
      "olx-blumenau",
      "olx-carros",
      "olx-curitiba",
      "olx-florianopolis",
      "olx-jaragua-do-sul",
      "webmotors-blumenau",
      "webmotors-carros",
      "webmotors-curitiba",
      "webmotors-florianopolis",
      "webmotors-jaragua-do-sul",
    ]);
    expect(listings.every((l) => l.active)).toBe(true);
  });

  test("deactivates unseen active listings and records status_change snapshot", async () => {
    const oldCar = await CarrosRepository.create({
      ref: "https://pr.olx.com.br/regiao-de-curitiba/autos-e-pecas/carros-vans-e-utilitarios/onix-123",
      text_description: "Chevrolet Onix LT 2021",
      id_listing: "listing-olx-curitiba",
      features: {
        price: 68900,
        year: 2021,
        mileage_km: 41000,
        brand: "Chevrolet",
        model: "Onix",
        city: "Curitiba",
        state: "PR",
      },
    });

    const staleCutoff = new Date(Date.now() + 60_000);
    const deactivated = await CarrosRepository.deactivateUnseenForListing(
      "listing-olx-curitiba",
      staleCutoff,
    );
    expect(deactivated).toBe(1);

    const updatedRow = await CarrosRepository.getById(oldCar.id);
    expect(updatedRow?.listingStatus).toBe("inactive");

    const history = await CarrosRepository.getHistoryByRef(oldCar.ref);
    expect(history.some((h) => h.eventType === "status_change")).toBe(true);
  });

  test("upserts car by ref, preserves curation flags, and tracks price/km history", async () => {
    const ref =
      "https://sc.olx.com.br/norte-de-santa-catarina/autos-e-pecas/hb20-diamond-plus-2021";
    const created = await CarrosRepository.create({
      ref,
      text_description: "Hyundai HB20 1.0 TGDI Diamond Plus 2021",
      id_listing: "listing-olx-carros",
      images: ["https://img.olx.com.br/a.jpg"],
      features: {
        price: 86900,
        year: 2021,
        mileage_km: 42000,
        brand: "Hyundai",
        model: "HB20",
        version: "Diamond Plus 1.0 TGDI",
        transmission: "Automático",
        fuel: "Flex",
        city: "Joinville",
        fipe_price: 85000,
        fipe_code: "015187-4",
        fipe_diff_pct: 2.2,
      },
    });

    await CarrosRepository.update(created.id, {
      is_favorite: true,
      notes: "Visitar sábado",
    });

    // Second scrape with price drop & km update
    await CarrosRepository.create({
      ref,
      text_description: "Hyundai HB20 1.0 TGDI Diamond Plus 2021",
      id_listing: "listing-olx-carros",
      images: ["https://img.olx.com.br/a.jpg"],
      features: {
        price: 81900,
        year: 2021,
        mileage_km: 42500,
        brand: "Hyundai",
        model: "HB20",
        version: "Diamond Plus 1.0 TGDI",
        fipe_price: 85000,
        fipe_code: "015187-4",
        fipe_diff_pct: -3.6,
      },
    });

    const row = await CarrosRepository.getById(created.id);
    expect(row?.price).toBe(81900);
    expect(row?.initialPrice).toBe(86900);
    expect(row?.lowestPrice).toBe(81900);
    expect(row?.highestPrice).toBe(86900);
    expect(row?.priceChangesCount).toBe(1);
    expect(row?.isFavorite).toBe(true);
    expect(row?.notes).toBe("Visitar sábado");

    const history = await CarrosRepository.getHistoryByRef(ref, 10);
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.eventType)).toContain("first_seen");
    expect(history.map((h) => h.eventType)).toContain("price_change");
    const dropEntry = history.find((h) => h.eventType === "price_change");
    expect(dropEntry?.previousPrice).toBe(86900);
    expect(dropEntry?.priceDelta).toBe(-5000);
    expect(dropEntry?.mileageKm).toBe(42500);
  });

  test("evaluates car alerts on new listing and price drop with deduplication", async () => {
    adapter
      .getDatabase()
      .prepare(
        `INSERT INTO car_alerts (
          id, user_id, name, active, search_query, min_year, max_year, max_price, max_km,
          only_below_fipe, notify_on_new, notify_on_price_drop
        ) VALUES (?, ?, ?, 1, ?, 2021, 2021, 85000, 60000, 1, 1, 1)`,
      )
      .run("alert-hb20", "user-1", "HB20 2021 Diamond Plus", "hb20 diamond plus");

    const ref = "https://www.webmotors.com.br/comprar/hyundai/hb20/2021/12345";

    // First seen above max_price and above FIPE -> no match
    await CarrosRepository.create({
      ref,
      text_description: "Hyundai HB20 1.0 TGDI Diamond Plus 2021",
      id_listing: "listing-webmotors-carros",
      images: [],
      features: {
        price: 87900,
        year: 2021,
        mileage_km: 48000,
        brand: "Hyundai",
        model: "HB20",
        version: "Diamond Plus",
        fipe_price: 85000,
        fipe_diff_pct: 3.4,
      },
    });

    const countBefore = adapter
      .getDatabase()
      .prepare("SELECT COUNT(*) as cnt FROM car_alert_notifications")
      .get() as { cnt: number };
    expect(countBefore.cnt).toBe(0);

    // Price drops into alert budget and below FIPE -> triggers price_drop notification
    await CarrosRepository.create({
      ref,
      text_description: "Hyundai HB20 1.0 TGDI Diamond Plus 2021",
      id_listing: "listing-webmotors-carros",
      images: [],
      features: {
        price: 82500,
        year: 2021,
        mileage_km: 48000,
        brand: "Hyundai",
        model: "HB20",
        version: "Diamond Plus",
        fipe_price: 85000,
        fipe_diff_pct: -2.9,
      },
    });

    const notifs = adapter
      .getDatabase()
      .prepare("SELECT * FROM car_alert_notifications")
      .all() as Array<{ trigger_type: string; price: number; previous_price: number }>;
    expect(notifs).toHaveLength(1);
    expect(notifs[0]?.trigger_type).toBe("price_drop");
    expect(notifs[0]?.price).toBe(82500);
    expect(notifs[0]?.previous_price).toBe(87900);
  });

  test("records crawler runs and logs", async () => {
    const run = await CrawlerRunsRepository.create("olx-carros");
    await CrawlerRunsRepository.log({
      level: "info",
      message: "Scraped page 1",
      context: { count: 12 },
    });
    await CrawlerRunsRepository.finish(run.id, {
      status: "completed",
      pagesCrawled: 1,
      listingsScraped: 12,
      errors: 0,
    });

    const runs = await CrawlerRunsRepository.getLatest(5);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("completed");
    expect(runs[0]?.listingsScraped).toBe(12);

    const logs = await CrawlerRunsRepository.getLatestLogs(10);
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("alert-matcher unit tests", () => {
  test("matches tokenized model query like hb20 2021 diamond plus", () => {
    const alert: CarAlertRow = {
      id: "a1",
      userId: "u1",
      name: "HB20",
      active: true,
      searchQuery: "hb20 2021 diamond plus",
      brand: "",
      model: "",
      version: "",
      fipeCode: "",
      city: "Joinville",
      portal: "",
      motorizacao: "turbo",
      transmission: "automatico",
      fuel: "Flex",
      minYear: 2021,
      maxYear: 2021,
      minPrice: 0,
      maxPrice: 86000,
      maxKm: 70000,
      onlyBelowFipe: true,
      minFipeDiscountPct: 2,
      notifyOnNew: true,
      notifyOnPriceDrop: true,
      lastCheckedAt: null,
      lastMatchedAt: null,
      matchesCount: 0,
    };

    expect(
      doesCarMatchAlert(
        {
          id: "c1",
          ref: "https://sc.olx.com.br/d/hb20-123",
          title: "Hyundai HB20 Diamond Plus 1.0 Turbo Automático 2021",
          brand: "Hyundai",
          model: "HB20",
          version: "Diamond Plus 1.0 TGDI",
          year: 2021,
          price: 82000,
          mileageKm: 52000,
          transmission: "Automático",
          fuel: "Flex",
          isTurbo: true,
          city: "Joinville",
          fipePrice: 85000,
          fipeDiffPct: -3.5,
        },
        alert,
      ),
    ).toBe(true);

    // Fails when minFipeDiscountPct is not met (-1% < -2%)
    expect(
      doesCarMatchAlert(
        {
          id: "c2",
          ref: "https://sc.olx.com.br/d/hb20-456",
          title: "Hyundai HB20 Diamond Plus 1.0 Turbo Automático 2021",
          brand: "Hyundai",
          model: "HB20",
          year: 2021,
          price: 84150,
          mileageKm: 52000,
          transmission: "Automático",
          fuel: "Flex",
          isTurbo: true,
          city: "Joinville",
          fipePrice: 85000,
          fipeDiffPct: -1.0,
        },
        alert,
      ),
    ).toBe(false);
  });

  test("matches combined automatico_cvt transmission alerts against both Automático and CVT cars", () => {
    const combinedAlert: CarAlertRow = {
      id: "alert-auto-cvt",
      userId: "user-1",
      name: "Automático ou CVT",
      active: true,
      searchQuery: "corolla",
      brand: "Toyota",
      model: "",
      version: "",
      fipeCode: "",
      city: "",
      portal: "",
      motorizacao: "",
      transmission: "automatico_cvt",
      fuel: "",
      minYear: 0,
      maxYear: 0,
      minPrice: 0,
      maxPrice: 0,
      maxKm: 0,
      onlyBelowFipe: false,
      minFipeDiscountPct: 0,
      notifyOnNew: true,
      notifyOnPriceDrop: true,
      lastCheckedAt: null,
      lastMatchedAt: null,
      matchesCount: 0,
    };

    expect(
      doesCarMatchAlert(
        {
          id: "a1",
          ref: "https://sc.olx.com.br/d/corolla-1",
          title: "Toyota Corolla XEi 2.0 Aut. 2020",
          brand: "Toyota",
          model: "Corolla",
          price: 110000,
          transmission: "Automático",
        },
        combinedAlert,
      ),
    ).toBe(true);

    expect(
      doesCarMatchAlert(
        {
          id: "a2",
          ref: "https://sc.olx.com.br/d/corolla-2",
          title: "Toyota Corolla Altis 2.0 CVT 2021",
          brand: "Toyota",
          model: "Corolla",
          price: 120000,
          transmission: "CVT",
        },
        combinedAlert,
      ),
    ).toBe(true);

    expect(
      doesCarMatchAlert(
        {
          id: "a3",
          ref: "https://sc.olx.com.br/d/corolla-3",
          title: "Toyota Corolla GLi 1.8 Manual 2018",
          brand: "Toyota",
          model: "Corolla",
          price: 85000,
          transmission: "Manual",
        },
        combinedAlert,
      ),
    ).toBe(false);
  });
});

describe("PocketBaseAdapter unit tests (mocked client)", () => {
  test("creates missing collections and seeds car_listings", async () => {
    const createdCollections: Array<{ name: string; indexes?: string[] }> = [];
    const createdListings: Array<Record<string, unknown>> = [];

    const mockClient = {
      autoCancellation: () => {},
      authStore: { isValid: true, token: "tok", clear: () => {}, save: () => {} },
      filter: (expr: string) => expr,
      collections: {
        create: async (payload: { name: string; indexes?: string[] }) => {
          createdCollections.push({ name: payload.name, indexes: payload.indexes });
          return { id: `col_${payload.name}`, ...payload };
        },
      },
      collection: (name: string) => ({
        getList: async () => {
          if (createdCollections.some((c) => c.name === name)) {
            return { items: [], totalItems: 0 };
          }
          throw { status: 404 };
        },
        getFullList: async () => [],
        create: async (data: Record<string, unknown>) => {
          if (name === PB_CAR_COLLECTIONS.LISTINGS) {
            createdListings.push(data);
          }
          return { id: "pb-id-1", ...data };
        },
      }),
    };

    const pbAdapter = new PocketBaseAdapter({
      url: "http://127.0.0.1:8090",
      client: mockClient as never,
      uploadImages: false,
    });

    await pbAdapter.ensureSchema();

    expect(createdCollections.map((c) => c.name)).toEqual([
      "car_listings",
      "carros_temp",
      "carros_history",
      "user_car_curation",
      "car_alerts",
      "car_alert_notifications",
      "car_crawler_runs",
      "car_crawler_logs",
    ]);
    const carrosCol = createdCollections.find((c) => c.name === "carros_temp");
    expect(carrosCol?.indexes?.length).toBeGreaterThanOrEqual(5);
    expect(createdListings.map((l) => l.name)).toEqual([
      "olx-carros",
      "webmotors-carros",
      "olx-curitiba",
      "webmotors-curitiba",
      "olx-blumenau",
      "webmotors-blumenau",
      "olx-jaragua-do-sul",
      "webmotors-jaragua-do-sul",
      "olx-florianopolis",
      "webmotors-florianopolis",
    ]);
  });
});
