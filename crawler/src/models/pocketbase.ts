import type { CarFeatures } from "./carro";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin" | string;
  alerts_enabled: boolean;
  verified: boolean;
  created: string;
  updated: string;
}

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
  engine_size: string;
  is_turbo: boolean;
  fipe_price: number;
  fipe_code: string;
  fipe_brand: string;
  fipe_model: string;
  fipe_year: number;
  fipe_ref_period: string;
  fipe_diff_pct: number;
  is_favorite: boolean;
  is_hidden: boolean;
  notes: string;
  first_seen_at: string;
  last_seen_at: string;
  initial_price: number;
  lowest_price: number;
  highest_price: number;
  price_changes_count: number;
  last_price_change_at: string;
  listing_status: string;
  created: string;
  updated: string;
}

export interface CarroHistoryRecord {
  id: string;
  carro_id: string;
  ref: string;
  id_listing: string;
  portal: string;
  text_description: string;
  brand: string;
  model: string;
  version: string;
  year: number;
  manufacture_year: number;
  price: number;
  previous_price: number;
  price_delta: number;
  mileage_km: number;
  previous_mileage_km: number;
  transmission: string;
  fuel: string;
  engine_size: string;
  is_turbo: boolean;
  seller_type: string;
  neighborhood: string;
  city: string;
  state: string;
  fipe_price: number;
  fipe_code: string;
  fipe_brand: string;
  fipe_model: string;
  fipe_year: number;
  fipe_ref_period: string;
  fipe_diff_pct: number;
  event_type: string;
  recorded_at: string;
  created: string;
  updated: string;
}

export interface CarAlertRecord {
  id: string;
  user: string;
  name: string;
  active: boolean;
  search_query: string;
  brand: string;
  model: string;
  version: string;
  fipe_code: string;
  city: string;
  portal: string;
  motorizacao: string;
  transmission: string;
  fuel: string;
  min_year: number;
  max_year: number;
  min_price: number;
  max_price: number;
  max_km: number;
  only_below_fipe: boolean;
  min_fipe_discount_pct: number;
  notify_on_new: boolean;
  notify_on_price_drop: boolean;
  last_checked_at: string;
  last_matched_at: string;
  matches_count: number;
  created: string;
  updated: string;
}

export interface CarAlertNotificationRecord {
  id: string;
  user: string;
  alert: string;
  carro_id: string;
  car_ref: string;
  car_title: string;
  brand: string;
  model: string;
  year: number;
  mileage_km: number;
  price: number;
  previous_price: number;
  fipe_price: number;
  fipe_diff_pct: number;
  portal: string;
  city: string;
  trigger_type: string;
  dedup_key: string;
  is_read: boolean;
  read_at: string;
  triggered_at: string;
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
