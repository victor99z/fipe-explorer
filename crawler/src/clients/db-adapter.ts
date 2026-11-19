import type { SeedListing } from "../models/listing";

export type { SeedListing } from "../models/listing";

export const DEFAULT_SEED_LISTINGS: readonly SeedListing[] = [
  {
    id: "listing-olx-carros",
    name: "olx-carros",
    active: true,
    lastPage: 1,
    url: "https://www.olx.com.br/autos-e-pecas/estado-sc/norte-de-santa-catarina/joinville",
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
  sellerType?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  fipePrice?: number;
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
  sellerType?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  fipePrice?: number;
}

export interface CarroPatch {
  textDescription?: string | null;
  features?: string | null;
  isFavorite?: boolean;
  isHidden?: boolean;
  notes?: string;
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
  sellerType: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  fipePrice: number | null;
  isFavorite: boolean;
  isHidden: boolean;
  notes: string | null;
  created: Date | null;
  updated: Date | null;
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
  deleteCarro(id: string): Promise<void>;
  deleteAllCarros(): Promise<number>;
  deleteInvalidOlxCarros(): Promise<number>;
  countCarros(): Promise<number>;
  getCarrosPrices(): Promise<number[]>;

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
