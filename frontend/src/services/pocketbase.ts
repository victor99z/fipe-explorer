import PocketBase, { ClientResponseError } from 'pocketbase';
import type { FipeMatchResult } from '../types/vehicle';

export const PB_CAR_COLLECTIONS = {
  CARROS: 'carros_temp',
  LISTINGS: 'car_listings',
} as const;

export const DEFAULT_POCKETBASE_URL =
  import.meta.env.VITE_POCKETBASE_URL?.trim().replace(/\/+$/, '') ||
  'https://pb.victorbernardes.dev';

const CAR_PREFS_STORAGE_KEY = 'fipex_car_prefs';

const LIST_CARD_FIELDS = [
  'id',
  'ref',
  'text_description',
  'id_listing',
  'images',
  'image_urls',
  'price',
  'year',
  'mileage_km',
  'brand',
  'model',
  'version',
  'transmission',
  'fuel',
  'color',
  'body_type',
  'engine_size',
  'is_turbo',
  'seller_type',
  'neighborhood',
  'city',
  'state',
  'fipe_price',
  'fipe_code',
  'fipe_brand',
  'fipe_model',
  'fipe_year',
  'fipe_ref_period',
  'fipe_diff_pct',
  'notes',
  'created',
  'updated',
].join(',');

export interface CarImage {
  fullUrl: string;
  thumbUrl: string;
}

export interface LocalCarPref {
  favorite?: boolean;
  hidden?: boolean;
  notes?: string;
}

export type LocalCarPrefsMap = Record<string, LocalCarPref>;

export interface CarListingItem {
  id: string;
  ref: string;
  title: string;
  textDescription: string;
  portalName: string;
  idListing: string;
  price: number;
  year: number | null;
  manufactureYear: number | null;
  mileageKm: number | null;
  brand: string;
  model: string;
  version: string;
  transmission: string;
  fuel: string;
  color: string;
  bodyType: string;
  engineSize: string;
  isTurbo: boolean;
  sellerType: string;
  neighborhood: string;
  city: string;
  state: string;
  fipePricePortal: number | null;
  fipeMatch: FipeMatchResult | null;
  fipeReferenceValue: number | null;
  fipeDiffPct: number | null;
  fipeDiffValue: number | null;
  images: CarImage[];
  favorite: boolean;
  hidden: boolean;
  notes: string;
  created: string;
  updated: string;
}

export type VisibilityMode = 'active' | 'favorites' | 'hidden' | 'all';
export type SortMode =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'km_asc'
  | 'fipe_discount_desc'
  | 'year_desc';

export interface CarListQueryParams {
  page: number;
  perPage?: number;
  search?: string;
  city?: string;
  neighborhood?: string;
  portal?: string;
  brand?: string;
  motorizacao?: string;
  cambio?: string;
  litragem?: string;
  combustivel?: string;
  sellerType?: string;
  minPrice?: string;
  maxPrice?: string;
  minYear?: string;
  maxYear?: string;
  maxKm?: string;
  onlyBelowFipe?: boolean;
  exactYear?: number;
  exactFipeCode?: string;
  visibilityMode?: VisibilityMode;
  sortBy?: SortMode;
}

export interface CarListPageResult {
  items: CarListingItem[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface CarFacetsAndStats {
  totalActive: number;
  belowFipeCount: number;
  avgPrice: number;
  cities: string[];
  brands: string[];
  fuels: string[];
}

function safeStorageGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors
  }
}

export function createPocketBaseClient(url?: string): PocketBase {
  const client = new PocketBase((url ?? DEFAULT_POCKETBASE_URL).replace(/\/+$/, ''));
  client.autoCancellation(false);
  return client;
}

export function loadLocalCarPrefs(): LocalCarPrefsMap {
  const raw = safeStorageGet(CAR_PREFS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LocalCarPrefsMap) : {};
  } catch {
    return {};
  }
}

export function saveLocalCarPrefs(prefs: LocalCarPrefsMap): void {
  safeStorageSet(CAR_PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof ClientResponseError) return err.status;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      }
    } catch {
      return [raw.trim()];
    }
  }
  return [];
}

function inferPortalFromUrl(ref: string): string {
  const lower = ref.toLowerCase();
  if (lower.includes('olx.com.br')) return 'OLX Carros';
  if (lower.includes('webmotors.com.br')) return 'Webmotors';
  return 'Outro portal';
}

function buildCarImages(pb: PocketBase, record: Record<string, unknown>): CarImage[] {
  const uploaded = parseStringArray(record.images);
  const remoteUrls = parseStringArray(record.image_urls);

  if (uploaded.length > 0) {
    return uploaded.map((filename) => {
      if (/^https?:\/\//i.test(filename)) {
        return { fullUrl: filename, thumbUrl: filename };
      }
      const fullUrl = pb.files.getURL(record as never, filename);
      const thumbUrl = pb.files.getURL(record as never, filename, { thumb: '480x360' });
      return { fullUrl, thumbUrl };
    });
  }

  return remoteUrls.map((url) => ({ fullUrl: url, thumbUrl: url }));
}

function toNumber(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : null;
}

function toSignedNumber(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

function toStringVal(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function mapCarRecord(
  pb: PocketBase,
  record: Record<string, unknown>,
  localPrefs: LocalCarPrefsMap,
): CarListingItem {
  const id = String(record.id ?? '');
  const ref = toStringVal(record.ref);
  const idListingRaw = record.id_listing;
  const idListing = Array.isArray(idListingRaw)
    ? toStringVal(idListingRaw[0])
    : toStringVal(idListingRaw);

  const portalName = inferPortalFromUrl(ref);
  const title =
    toStringVal(record.text_description) ||
    [toStringVal(record.brand), toStringVal(record.model), toStringVal(record.version)]
      .filter(Boolean)
      .join(' ') ||
    'Veículo sem título';

  const price = toNumber(record.price) ?? 0;
  const year = toNumber(record.year);
  const mileageKm =
    typeof record.mileage_km === 'number' && record.mileage_km >= 0
      ? record.mileage_km
      : null;

  const fipePrice = toNumber(record.fipe_price);
  const fipeCode = toStringVal(record.fipe_code);
  const hasFipeMatch = Boolean(fipePrice && fipeCode && fipeCode !== 'N/A');

  const fipeMatch: FipeMatchResult | null = hasFipeMatch
    ? {
        codigo_fipe: fipeCode,
        nome_marca: toStringVal(record.fipe_brand) || toStringVal(record.brand),
        nome_modelo: toStringVal(record.fipe_model) || toStringVal(record.model),
        ano_modelo: toNumber(record.fipe_year) ?? year ?? 0,
        nome_combustivel: toStringVal(record.fuel) || null,
        valor: fipePrice!,
        valor_formatado: fipePrice!.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          maximumFractionDigits: 0,
        }),
        periodo_referencia: toStringVal(record.fipe_ref_period),
        confidence: 1,
      }
    : null;

  const storedDiffPct = toSignedNumber(record.fipe_diff_pct);
  const fipeDiffPct =
    fipePrice && price > 0
      ? storedDiffPct !== null && (storedDiffPct !== 0 || price === fipePrice)
        ? storedDiffPct
        : Math.round(((price - fipePrice) / fipePrice) * 1000) / 10
      : null;
  const fipeDiffValue = fipePrice && price > 0 ? price - fipePrice : null;

  const pref = localPrefs[id];
  const favorite = Boolean(pref?.favorite);
  const hidden = Boolean(pref?.hidden);
  const notes = pref?.notes ?? toStringVal(record.notes);

  return {
    id,
    ref,
    title,
    textDescription: toStringVal(record.text_description),
    portalName,
    idListing,
    price,
    year,
    manufactureYear: null,
    mileageKm,
    brand: toStringVal(record.brand),
    model: toStringVal(record.model),
    version: toStringVal(record.version),
    transmission: toStringVal(record.transmission),
    fuel: toStringVal(record.fuel),
    color: toStringVal(record.color),
    bodyType: toStringVal(record.body_type),
    engineSize: toStringVal(record.engine_size),
    isTurbo: Boolean(record.is_turbo),
    sellerType: toStringVal(record.seller_type),
    neighborhood: toStringVal(record.neighborhood),
    city: toStringVal(record.city),
    state: toStringVal(record.state) || 'SC',
    fipePricePortal: fipePrice,
    fipeMatch,
    fipeReferenceValue: fipePrice,
    fipeDiffPct,
    fipeDiffValue,
    images: buildCarImages(pb, record),
    favorite,
    hidden,
    notes,
    created: toStringVal(record.created),
    updated: toStringVal(record.updated),
  };
}

function buildFilterExpression(
  pb: PocketBase,
  params: CarListQueryParams,
  localPrefs: LocalCarPrefsMap,
): { filter: string; shortCircuitEmpty: boolean } {
  const clauses: string[] = [];

  // Visibility filter from local preferences
  const favIds = Object.entries(localPrefs)
    .filter(([, p]) => p.favorite && !p.hidden)
    .map(([id]) => id);
  const hiddenIds = Object.entries(localPrefs)
    .filter(([, p]) => p.hidden)
    .map(([id]) => id);

  if (params.visibilityMode === 'favorites') {
    if (favIds.length === 0) return { filter: '', shortCircuitEmpty: true };
    const ors = favIds.slice(0, 60).map((id, idx) => pb.filter(`id = {:fav${idx}}`, { [`fav${idx}`]: id }));
    clauses.push(`(${ors.join(' || ')})`);
  } else if (params.visibilityMode === 'hidden') {
    if (hiddenIds.length === 0) return { filter: '', shortCircuitEmpty: true };
    const ors = hiddenIds.slice(0, 60).map((id, idx) => pb.filter(`id = {:hid${idx}}`, { [`hid${idx}`]: id }));
    clauses.push(`(${ors.join(' || ')})`);
  } else if (params.visibilityMode === 'active' && hiddenIds.length > 0) {
    for (const [idx, id] of hiddenIds.slice(0, 40).entries()) {
      clauses.push(pb.filter(`id != {:ex${idx}}`, { [`ex${idx}`]: id }));
    }
  }

  // City
  if (params.city && params.city !== 'todas') {
    clauses.push(pb.filter('city ~ {:city}', { city: params.city }));
  }

  // Neighborhood
  if (params.neighborhood?.trim()) {
    clauses.push(pb.filter('neighborhood ~ {:neighborhood}', { neighborhood: params.neighborhood.trim() }));
  }

  // Portal
  if (params.portal === 'OLX Carros') {
    clauses.push('ref ~ "olx.com.br"');
  } else if (params.portal === 'Webmotors') {
    clauses.push('ref ~ "webmotors.com.br"');
  }

  // Brand
  if (params.brand?.trim()) {
    clauses.push(pb.filter('brand = {:brand}', { brand: params.brand.trim() }));
  }

  // Motorizacao (Turbo / Aspirado)
  if (params.motorizacao === 'turbo') {
    clauses.push('is_turbo = true');
  } else if (params.motorizacao === 'aspirado') {
    clauses.push('is_turbo = false');
  }

  // Cambio
  if (params.cambio === 'automatico') {
    clauses.push('(transmission ~ "Automát" || transmission ~ "CVT" || transmission ~ "Automatizado")');
  } else if (params.cambio === 'manual') {
    clauses.push('transmission ~ "Manual"');
  } else if (params.cambio && params.cambio !== 'todos') {
    clauses.push(pb.filter('transmission ~ {:cambio}', { cambio: params.cambio }));
  }

  // Litragem
  if (params.litragem && params.litragem !== 'todos') {
    if (params.litragem === '2.0+') {
      clauses.push('(engine_size >= "2.0" && engine_size != "")');
    } else {
      clauses.push(pb.filter('engine_size = {:lit}', { lit: params.litragem }));
    }
  }

  // Combustivel
  if (params.combustivel && params.combustivel !== 'todos') {
    clauses.push(pb.filter('fuel ~ {:fuel}', { fuel: params.combustivel }));
  }

  // Seller
  if (params.sellerType?.trim()) {
    clauses.push(pb.filter('seller_type = {:seller}', { seller: params.sellerType.trim() }));
  }

  // Price bounds
  const minP = Number((params.minPrice ?? '').replace(/[^\d]/g, '')) || 0;
  const maxP = Number((params.maxPrice ?? '').replace(/[^\d]/g, '')) || 0;
  if (minP > 0) clauses.push(pb.filter('price >= {:minP}', { minP }));
  if (maxP > 0) clauses.push(pb.filter('price > 0 && price <= {:maxP}', { maxP }));

  // Year bounds
  const minY = Number(params.minYear) || 0;
  const maxY = Number(params.maxYear) || 0;
  if (minY > 0) clauses.push(pb.filter('year >= {:minY}', { minY }));
  if (maxY > 0) clauses.push(pb.filter('year > 0 && year <= {:maxY}', { maxY }));

  // Exact FIPE context chips
  if (params.exactYear && params.exactYear > 0) {
    clauses.push(pb.filter('year = {:exYr}', { exYr: params.exactYear }));
  }
  if (params.exactFipeCode) {
    clauses.push(pb.filter('fipe_code = {:exFipe}', { exFipe: params.exactFipeCode }));
  }

  // Max km
  const maxK = Number((params.maxKm ?? '').replace(/[^\d]/g, '')) || 0;
  if (maxK > 0) clauses.push(pb.filter('mileage_km <= {:maxK}', { maxK }));

  // Below FIPE / FIPE discount sort
  if (params.onlyBelowFipe) {
    clauses.push('fipe_price > 0 && fipe_diff_pct <= 0');
  } else if (params.sortBy === 'fipe_discount_desc') {
    clauses.push('fipe_price > 0');
  }

  // Tokenized multi-word search
  const tokens = (params.search ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  tokens.forEach((tok, idx) => {
    const num = Number(tok);
    if (/^\d{4}$/.test(tok) && num >= 1960 && num <= 2030) {
      clauses.push(
        pb.filter(`(year = {:yr${idx}} || text_description ~ {:tk${idx}})`, {
          [`yr${idx}`]: num,
          [`tk${idx}`]: tok,
        }),
      );
    } else {
      clauses.push(
        pb.filter(
          `(text_description ~ {:tk${idx}} || brand ~ {:tk${idx}} || model ~ {:tk${idx}} || version ~ {:tk${idx}} || neighborhood ~ {:tk${idx}} || city ~ {:tk${idx}} || fipe_code ~ {:tk${idx}} || fipe_model ~ {:tk${idx}} || transmission ~ {:tk${idx}} || fuel ~ {:tk${idx}})`,
          { [`tk${idx}`]: tok },
        ),
      );
    }
  });

  return { filter: clauses.join(' && '), shortCircuitEmpty: false };
}

function resolveSortExpr(sortBy?: SortMode): string {
  switch (sortBy) {
    case 'price_asc':
      return 'price,-updated';
    case 'price_desc':
      return '-price,-updated';
    case 'km_asc':
      return 'mileage_km,-updated';
    case 'year_desc':
      return '-year,-price';
    case 'fipe_discount_desc':
      return 'fipe_diff_pct,-updated';
    case 'relevance':
      return '-fipe_price,fipe_diff_pct,-updated';
    case 'newest':
    default:
      return '-updated';
  }
}

export async function fetchPagedCarListings(
  pb: PocketBase,
  params: CarListQueryParams,
): Promise<CarListPageResult> {
  const localPrefs = loadLocalCarPrefs();
  const perPage = params.perPage ?? 24;
  const { filter, shortCircuitEmpty } = buildFilterExpression(pb, params, localPrefs);

  if (shortCircuitEmpty) {
    return { items: [], page: 1, perPage, totalItems: 0, totalPages: 1 };
  }

  const sort = resolveSortExpr(params.sortBy);

  try {
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(params.page, perPage, {
        ...(filter ? { filter } : {}),
        sort,
        fields: LIST_CARD_FIELDS,
      });

    return {
      items: res.items.map((r) => mapCarRecord(pb, r, localPrefs)),
      page: res.page,
      perPage: res.perPage,
      totalItems: res.totalItems,
      totalPages: Math.max(1, res.totalPages),
    };
  } catch (err) {
    const status = getHttpStatus(err);
    if (status === 404) {
      return { items: [], page: 1, perPage, totalItems: 0, totalPages: 1 };
    }
    if (status === 400) {
      // Fallback if remote collection is still missing one of the new indexed fields
      const res = await pb
        .collection(PB_CAR_COLLECTIONS.CARROS)
        .getList<Record<string, unknown>>(params.page, perPage, {
          fields: 'id,ref,text_description,id_listing,images,image_urls,price,year,mileage_km,brand,model,version,transmission,fuel,color,body_type,seller_type,neighborhood,city,state,fipe_price,notes',
        });
      return {
        items: res.items.map((r) => mapCarRecord(pb, r, localPrefs)),
        page: res.page,
        perPage: res.perPage,
        totalItems: res.totalItems,
        totalPages: Math.max(1, res.totalPages),
      };
    }
    throw err;
  }
}

export async function fetchCarFacetsAndStats(
  pb: PocketBase,
  cityFilter?: string,
): Promise<CarFacetsAndStats> {
  const cityClause =
    cityFilter && cityFilter !== 'todas'
      ? pb.filter('city ~ {:city}', { city: cityFilter })
      : '';

  const belowFilter = cityClause
    ? `${cityClause} && fipe_price > 0 && fipe_diff_pct <= 0`
    : 'fipe_price > 0 && fipe_diff_pct <= 0';

  const [totalRes, belowRes, sampleRes, citiesRes] = await Promise.all([
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList(1, 1, {
        ...(cityClause ? { filter: cityClause } : {}),
        fields: 'id',
      })
      .catch(() => ({ totalItems: 0 })),
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList(1, 1, { filter: belowFilter, fields: 'id' })
      .catch(() => ({ totalItems: 0 })),
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(1, 400, {
        ...(cityClause ? { filter: cityClause } : {}),
        fields: 'brand,fuel,price',
      })
      .catch(() => ({ items: [] as Record<string, unknown>[] })),
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(1, 500, {
        filter: 'city != ""',
        fields: 'city',
      })
      .catch(() => ({ items: [] as Record<string, unknown>[] })),
  ]);

  const cities = new Set<string>(['Joinville']);
  const brands = new Set<string>();
  const fuels = new Set<string>();
  let priceSum = 0;
  let priceCount = 0;

  for (const r of citiesRes.items) {
    const c = toStringVal(r.city);
    if (c) cities.add(c);
  }

  for (const r of sampleRes.items) {
    const b = toStringVal(r.brand);
    if (b) brands.add(b);
    const f = toStringVal(r.fuel);
    if (f) fuels.add(f);
    const p = toNumber(r.price);
    if (p) {
      priceSum += p;
      priceCount++;
    }
  }

  return {
    totalActive: totalRes.totalItems,
    belowFipeCount: belowRes.totalItems,
    avgPrice: priceCount > 0 ? priceSum / priceCount : 0,
    cities: [...cities].sort((a, b) =>
      a === 'Joinville' ? -1 : b === 'Joinville' ? 1 : a.localeCompare(b),
    ),
    brands: [...brands].sort(),
    fuels: [...fuels].sort(),
  };
}

export async function updateCarCuration(
  pb: PocketBase,
  car: CarListingItem,
  patch: { favorite?: boolean; hidden?: boolean; notes?: string },
): Promise<void> {
  const prefs = loadLocalCarPrefs();
  prefs[car.id] = {
    favorite: patch.favorite ?? car.favorite,
    hidden: patch.hidden ?? car.hidden,
    notes: patch.notes ?? car.notes,
  };
  saveLocalCarPrefs(prefs);

  if (pb.authStore.isValid) {
    const body: Record<string, unknown> = {};
    if (patch.favorite !== undefined) body.is_favorite = patch.favorite;
    if (patch.hidden !== undefined) body.is_hidden = patch.hidden;
    if (patch.notes !== undefined) body.notes = patch.notes;
    await pb.collection(PB_CAR_COLLECTIONS.CARROS).update(car.id, body);
  }
}
