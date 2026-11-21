import type { SeedListing } from "../models/listing";

export type { SeedListing } from "../models/listing";

export const LEGACY_OLX_CARS_URL =
  "https://www.olx.com.br/autos-e-pecas/estado-sc/norte-de-santa-catarina/joinville";

export const LEGACY_OLX_JOINVILLE_URL =
  "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/norte-de-santa-catarina/joinville";

export const LEGACY_OLX_BLUMENAU_URL =
  "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/regiao-de-blumenau";

export const DEFAULT_OLX_BLUMENAU_URL =
  "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/blumenau";

export const DEFAULT_OLX_CARS_URL =
  "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/norte-de-santa-catarina";

export const DEFAULT_SEED_LISTINGS: readonly SeedListing[] = [
  {
    id: "listing-olx-carros",
    name: "olx-carros",
    active: true,
    lastPage: 1,
    url: DEFAULT_OLX_CARS_URL,
    maxPages: 50,
    delayMs: 2500,
  },
  {
    id: "listing-webmotors-carros",
    name: "webmotors-carros",
    active: true,
    lastPage: 1,
    url: "https://www.webmotors.com.br/carros/sc-joinville=1?tipoveiculo=carros&estadocidade=Santa%20Catarina-joinville%3D1&page=1",
    maxPages: 50,
    delayMs: 2500,
  },
  {
    id: "listing-olx-curitiba",
    name: "olx-curitiba",
    active: true,
    lastPage: 1,
    url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-pr/curitiba",
    maxPages: 30,
    delayMs: 2500,
  },
  {
    id: "listing-webmotors-curitiba",
    name: "webmotors-curitiba",
    active: true,
    lastPage: 1,
    url: "https://www.webmotors.com.br/carros/pr-curitiba",
    maxPages: 30,
    delayMs: 2500,
  },
  {
    id: "listing-olx-blumenau",
    name: "olx-blumenau",
    active: true,
    lastPage: 1,
    url: DEFAULT_OLX_BLUMENAU_URL,
    maxPages: 25,
    delayMs: 2500,
  },
  {
    id: "listing-webmotors-blumenau",
    name: "webmotors-blumenau",
    active: true,
    lastPage: 1,
    url: "https://www.webmotors.com.br/carros/sc-blumenau",
    maxPages: 25,
    delayMs: 2500,
  },
  {
    id: "listing-olx-jaragua",
    name: "olx-jaragua-do-sul",
    active: true,
    lastPage: 1,
    url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/jaragua-do-sul",
    maxPages: 20,
    delayMs: 2500,
  },
  {
    id: "listing-webmotors-jaragua",
    name: "webmotors-jaragua-do-sul",
    active: true,
    lastPage: 1,
    url: "https://www.webmotors.com.br/carros/sc-jaragua-do-sul",
    maxPages: 20,
    delayMs: 2500,
  },
  {
    id: "listing-olx-florianopolis",
    name: "olx-florianopolis",
    active: true,
    lastPage: 1,
    url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/estado-sc/florianopolis-e-regiao",
    maxPages: 25,
    delayMs: 2500,
  },
  {
    id: "listing-webmotors-floripa",
    name: "webmotors-florianopolis",
    active: true,
    lastPage: 1,
    url: "https://www.webmotors.com.br/carros/sc-florianopolis",
    maxPages: 25,
    delayMs: 2500,
  },
];

export interface CarroInsert {
  id: string;
  ref: string;
  textDescription: string | null;
  features: string | null;
  idListing: string | null;
  images: string;
  created: Date;
  updated: Date;
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
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  initialPrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  priceChangesCount?: number;
  lastPriceChangeAt?: Date | null;
  listingStatus?: string;
}

export interface CarroUpdate {
  textDescription: string | null;
  features: string | null;
  idListing: string | null;
  images: string;
  updated: Date;
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
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  initialPrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  priceChangesCount?: number;
  lastPriceChangeAt?: Date | null;
  listingStatus?: string;
}

export interface CarroFipePatch {
  engineSize?: string;
  isTurbo?: boolean;
  transmission?: string;
  fuel?: string;
  fipePrice: number;
  fipeCode: string;
  fipeBrand: string;
  fipeModel: string;
  fipeYear: number;
  fipeRefPeriod: string;
  fipeDiffPct: number;
}

export interface CarroPatch {
  textDescription?: string | null;
  features?: string | null;
  isFavorite?: boolean;
  isHidden?: boolean;
  notes?: string;
  listingStatus?: string;
  lastSeenAt?: Date;
  updated: Date;
}

export interface CarroRow {
  id: string;
  ref: string;
  textDescription: string | null;
  features: string | null;
  idListing: string | null;
  images: string | null;
  imageUrls: string | null;
  price: number | null;
  year: number | null;
  mileageKm: number | null;
  brand: string | null;
  model: string | null;
  version: string | null;
  transmission: string | null;
  fuel: string | null;
  color: string | null;
  bodyType: string | null;
  engineSize: string | null;
  isTurbo: boolean;
  sellerType: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  fipePrice: number | null;
  fipeCode: string | null;
  fipeBrand: string | null;
  fipeModel: string | null;
  fipeYear: number | null;
  fipeRefPeriod: string | null;
  fipeDiffPct: number | null;
  isFavorite: boolean;
  isHidden: boolean;
  notes: string | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  initialPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  priceChangesCount: number;
  lastPriceChangeAt: Date | null;
  listingStatus: string | null;
  created: Date | null;
  updated: Date | null;
}

export type CarroHistoryEventType =
  | "first_seen"
  | "price_change"
  | "mileage_change"
  | "snapshot"
  | "status_change";

export interface CarroHistoryInsert {
  carroId: string;
  ref: string;
  idListing: string | null;
  portal: string;
  textDescription: string | null;
  brand?: string;
  model?: string;
  version?: string;
  year: number;
  manufactureYear?: number;
  price: number;
  previousPrice?: number;
  priceDelta?: number;
  mileageKm: number;
  previousMileageKm?: number;
  transmission?: string;
  fuel?: string;
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
  eventType: CarroHistoryEventType;
  recordedAt: Date;
}

export interface CarroHistoryRow {
  id: string;
  carroId: string;
  ref: string;
  idListing: string | null;
  portal: string;
  textDescription: string | null;
  brand: string | null;
  model: string | null;
  version: string | null;
  year: number | null;
  manufactureYear: number | null;
  price: number | null;
  previousPrice: number | null;
  priceDelta: number | null;
  mileageKm: number | null;
  previousMileageKm: number | null;
  transmission: string | null;
  fuel: string | null;
  engineSize: string | null;
  isTurbo: boolean;
  sellerType: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  fipePrice: number | null;
  fipeCode: string | null;
  fipeBrand: string | null;
  fipeModel: string | null;
  fipeYear: number | null;
  fipeRefPeriod: string | null;
  fipeDiffPct: number | null;
  eventType: string;
  recordedAt: Date;
}

export interface CarAlertRow {
  id: string;
  userId: string;
  name: string;
  active: boolean;
  searchQuery: string;
  brand: string;
  model: string;
  version: string;
  fipeCode: string;
  city: string;
  portal: string;
  motorizacao: string;
  transmission: string;
  fuel: string;
  minYear: number;
  maxYear: number;
  minPrice: number;
  maxPrice: number;
  maxKm: number;
  onlyBelowFipe: boolean;
  minFipeDiscountPct: number;
  notifyOnNew: boolean;
  notifyOnPriceDrop: boolean;
  lastCheckedAt: Date | null;
  lastMatchedAt: Date | null;
  matchesCount: number;
}

export interface CarAlertNotificationInsert {
  userId: string;
  alertId: string;
  carroId: string;
  carRef: string;
  carTitle: string;
  brand?: string;
  model?: string;
  year?: number;
  mileageKm?: number;
  price: number;
  previousPrice?: number;
  fipePrice?: number;
  fipeDiffPct?: number;
  portal: string;
  city?: string;
  triggerType: "new_listing" | "price_drop" | "below_fipe" | "manual_scan";
  dedupKey: string;
  triggeredAt: Date;
}

export interface ListingRow {
  id: string;
  name: string;
  active: boolean;
  lastPage: number;
  url: string | null;
  maxPages: number;
  delayMs: number;
  created: Date | null;
  updated: Date | null;
}

export interface ListingUpdate {
  name: string;
  active: boolean;
  lastPage: number;
  url: string | null;
  maxPages: number;
  delayMs: number;
}

export interface CrawlerRunRow {
  id: number;
  siteName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  pagesCrawled: number | null;
  listingsScraped: number | null;
  errors: number | null;
  errorMsg: string | null;
}

export interface CrawlerRunFinish {
  finishedAt?: string;
  status?: string;
  pagesCrawled?: number;
  listingsScraped?: number;
  errors?: number;
  errorMsg?: string;
}

export interface CrawlerLogInsert {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown> | null;
  createdAt?: Date;
}

export interface CrawlerLogRow {
  id: string | number;
  level: string;
  message: string;
  context: string | null;
  createdAt: Date;
}

export interface DbAdapter {
  ensureSchema(): Promise<void>;

  // carros_temp
  findCarroByRef(ref: string): Promise<{ id: string } | null>;
  getCarroById(id: string): Promise<CarroRow | null>;
  getCarrosByRef(ref: string): Promise<CarroRow[]>;
  insertCarro(data: CarroInsert): Promise<void>;
  updateCarro(id: string, data: CarroUpdate): Promise<void>;
  patchCarro(id: string, data: CarroPatch): Promise<void>;
  updateCarroFipe(id: string, data: CarroFipePatch): Promise<void>;
  getCarrosMissingFipe(limit: number): Promise<CarroRow[]>;
  getActiveCarrosStaleSince(
    seenBefore: Date,
    limit: number,
    idListing?: string,
  ): Promise<CarroRow[]>;
  deleteCarro(id: string): Promise<void>;
  deleteAllCarros(): Promise<number>;
  deleteInvalidOlxCarros(): Promise<number>;
  countCarros(): Promise<number>;
  getCarrosPrices(): Promise<number[]>;

  // carros_history
  insertCarroHistory(data: CarroHistoryInsert): Promise<void>;
  getLatestCarroHistorySnapshot(ref: string): Promise<CarroHistoryRow | null>;
  getCarroHistoryByRef(ref: string, limit?: number): Promise<CarroHistoryRow[]>;
  backfillMissingCarroHistory(limit?: number): Promise<number>;

  // car_alerts & notifications
  getActiveCarAlerts(): Promise<CarAlertRow[]>;
  insertAlertNotification(data: CarAlertNotificationInsert): Promise<boolean>;
  updateCarAlertStats(
    alertId: string,
    patch: {
      lastCheckedAt: Date;
      lastMatchedAt?: Date;
      matchesIncrement?: number;
    },
  ): Promise<void>;

  // car_listings
  getAllListings(): Promise<ListingRow[]>;
  getListingById(id: string): Promise<ListingRow | null>;
  updateListing(id: string, data: ListingUpdate): Promise<void>;
  getActiveListingNames(): Promise<string[]>;

  // car_crawler_runs
  createCrawlerRun(siteName: string): Promise<{ id: number }>;
  finishCrawlerRun(id: number, data: CrawlerRunFinish): Promise<void>;
  getLatestCrawlerRuns(limit: number): Promise<CrawlerRunRow[]>;
  getLatestPerSite(): Promise<CrawlerRunRow[]>;
  countErrorsSince(days: number): Promise<number>;
  countRunsSince(days: number): Promise<number>;

  // car_crawler_logs
  insertCrawlerLog(data: CrawlerLogInsert): Promise<void>;
  getLatestCrawlerLogs(limit: number): Promise<CrawlerLogRow[]>;
}
