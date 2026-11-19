export interface CarFeatures {
  price: number;
  year?: number;
  manufacture_year?: number;
  mileage_km?: number;
  brand?: string;
  model?: string;
  version?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  body_type?: string;
  doors?: number;
  engine_size?: string;
  is_turbo?: boolean;
  seller_type?: string;
  plate_end?: string;
  fipe_price?: number;
  neighborhood?: string;
  city?: string;
  state?: string;
  address?: string;
  title?: string;
  listing_code?: string;
  highlights?: string[];
  [key: string]: unknown;
}

export interface CarroData {
  ref: string;
  text_description?: string | null;
  features?: CarFeatures | string | null;
  id_listing?: string | string[] | null;
  images?: string[];
}
