import type { CarFeatures } from "./carro";

export interface CarroRecord {
  id: string;
  ref: string;
  text_description: string;
  features: CarFeatures | null;
  id_listing: string;
  images: string[];
  image_urls: string[];
  price: number;
  year: number;
  mileage_km: number;
  brand: string;
  model: string;
  version: string;
  transmission: string;
  fuel: string;
  color: string;
  body_type: string;
  seller_type: string;
  neighborhood: string;
  city: string;
  state: string;
  fipe_price: number;
  is_favorite: boolean;
  is_hidden: boolean;
  notes: string;
  created: string;
  updated: string;
}

export interface CarListingRecord {
  id: string;
  name: string;
  active: boolean;
  last_page: number;
  url: string;
  max_pages: number;
  delay_ms: number;
  created: string;
  updated: string;
}

export interface CarCrawlerRunRecord {
  id: string;
  site_name: string;
  started_at: string;
  finished_at: string;
  status: string;
  pages_crawled: number;
  listings_scraped: number;
  errors: number;
  error_msg: string;
}

export interface CarCrawlerLogRecord {
  id: string;
  level: string;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
}
