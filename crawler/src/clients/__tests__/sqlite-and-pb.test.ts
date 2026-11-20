import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { setAdapter } from "../db";
import { SqliteAdapter } from "../sqlite-adapter";
import { PocketBaseAdapter, PB_CAR_COLLECTIONS } from "../pocketbase-adapter";
import { CarrosRepository } from "../../repository/carros-repository";
import { CrawlerRunsRepository } from "../../repository/crawler-runs-repository";

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

  test("seeds olx-carros and webmotors-carros listings", async () => {
    const listings = await CarrosRepository.getAllListings();
    expect(listings.map((l) => l.name)).toEqual([
      "olx-carros",
      "webmotors-carros",
    ]);
    expect(listings.every((l) => l.active)).toBe(true);
  });

  test("upserts car by ref and preserves curation flags", async () => {
    const ref =
      "https://sc.olx.com.br/norte-de-santa-catarina/autos-e-pecas/carro-teste-1";
    const created = await CarrosRepository.create({
      ref,
      text_description: "VW Nivus Highline 2022",
      id_listing: "listing-olx-carros",
      images: ["https://img.olx.com.br/a.jpg"],
      features: {
        price: 109900,
        year: 2022,
        mileage_km: 31000,
        brand: "Volkswagen",
        model: "Nivus",
        transmission: "Automático",
        fuel: "Flex",
        city: "Joinville",
      },
    });

    await CarrosRepository.update(created.id, {
      is_favorite: true,
      notes: "Visitar sábado",
    });

    await CarrosRepository.create({
      ref,
      text_description: "VW Nivus Highline 2022 Atualizado",
      id_listing: "listing-olx-carros",
      images: ["https://img.olx.com.br/a.jpg"],
      features: {
        price: 105900,
        year: 2022,
        mileage_km: 31500,
        brand: "Volkswagen",
        model: "Nivus",
      },
    });

    const row = await CarrosRepository.getById(created.id);
    expect(row?.price).toBe(105900);
    expect(row?.isFavorite).toBe(true);
    expect(row?.notes).toBe("Visitar sábado");
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
          return payload;
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
      "car_crawler_runs",
      "car_crawler_logs",
    ]);
    const carrosCol = createdCollections.find((c) => c.name === "carros_temp");
    expect(carrosCol?.indexes?.length).toBeGreaterThanOrEqual(5);
    expect(createdListings.map((l) => l.name)).toEqual([
      "olx-carros",
      "webmotors-carros",
    ]);
  });
});
