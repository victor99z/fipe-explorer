import PocketBase, { ClientResponseError } from 'pocketbase';
import type { FipeMatchResult } from '../types/vehicle';

export const PB_CAR_COLLECTIONS = {
  CARROS: 'carros_temp',
  LISTINGS: 'car_listings',
  CRAWLER_RUNS: 'car_crawler_runs',
  CRAWLER_LOGS: 'car_crawler_logs',
} as const;

export const PB_PRESET_URLS = [
  { label: 'Remoto (pb.victorbernardes.dev)', url: 'https://pb.victorbernardes.dev' },
  { label: 'Local (127.0.0.1:8090)', url: 'http://127.0.0.1:8090' },
] as const;

export const DEFAULT_POCKETBASE_URL =
  import.meta.env.VITE_POCKETBASE_URL?.trim().replace(/\/+$/, '') ||
  'https://pb.victorbernardes.dev';

const PB_URL_STORAGE_KEY = 'fipex_pb_url';
const CAR_PREFS_STORAGE_KEY = 'fipex_car_prefs';

export type AuthRole = 'user' | 'superuser';

export interface AuthSessionUser {
  id: string;
  email: string;
  role: AuthRole;
}

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

export interface PortalListingItem {
  id: string;
  name: string;
  active: boolean;
  lastPage: number;
  url: string;
  maxPages: number;
  delayMs: number;
  created: string;
  updated: string;
}

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
  rawFeatures: Record<string, unknown>;
  created: string;
  updated: string;
}

export interface CrawlerRunItem {
  id: string;
  siteName: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  pagesCrawled: number;
  listingsScraped: number;
  errors: number;
  errorMsg: string;
}

export interface CrawlerLogItem {
  id: string;
  level: string;
  message: string;
  context: string;
  createdAt: string;
}

export interface CarDashboardSnapshot {
  listings: PortalListingItem[];
  carros: CarListingItem[];
  runs: CrawlerRunItem[];
  logs: CrawlerLogItem[];
  runsAvailable: boolean;
  logsAvailable: boolean;
  requiresAuth: boolean;
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

export function getConfiguredPocketBaseUrl(): string {
  return DEFAULT_POCKETBASE_URL;
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

export function getAuthSessionUser(pb: PocketBase): AuthSessionUser | null {
  if (!pb.authStore.isValid) {
    pb.authStore.clear();
    return null;
  }
  const store = pb.authStore as unknown as {
    record?: Record<string, unknown> | null;
    model?: Record<string, unknown> | null;
    isSuperuser?: boolean;
    isAdmin?: boolean;
  };
  const model = store.record ?? store.model ?? null;
  if (!model) return null;

  const collectionName = typeof model.collectionName === 'string' ? model.collectionName : '';
  const role: AuthRole =
    collectionName === '_superusers' || store.isSuperuser === true || store.isAdmin === true || collectionName === ''
      ? 'superuser'
      : 'user';

  return {
    id: String(model.id ?? ''),
    email: String(model.email ?? model.username ?? 'Usuário'),
    role,
  };
}

function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof ClientResponseError) return err.status;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

export async function authenticateWithPocketBase(
  pb: PocketBase,
  email: string,
  password: string,
): Promise<AuthSessionUser> {
  const trimmedEmail = email.trim();
  pb.authStore.clear();

  const attempts: Array<{ role: AuthRole; run: () => Promise<unknown> }> = [
    {
      role: 'user',
      run: () => pb.collection('users').authWithPassword(trimmedEmail, password),
    },
    {
      role: 'superuser',
      run: () => pb.collection('_superusers').authWithPassword(trimmedEmail, password),
    },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      pb.authStore.clear();
      await attempt.run();
      const session = getAuthSessionUser(pb);
      if (session) return session;
      return { id: '', email: trimmedEmail, role: attempt.role };
    } catch (err) {
      lastError = err;
    }
  }

  const status = getHttpStatus(lastError);
  if (status === 400 || status === 401 || status === 403) {
    throw new Error('E-mail ou senha inválidos no PocketBase.');
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Não foi possível conectar ao PocketBase.');
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
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

export function formatPortalLabel(nameOrUrl: string): string {
  const lower = nameOrUrl.toLowerCase();
  if (lower.includes('olx')) return 'OLX Carros';
  if (lower.includes('webmotors')) return 'Webmotors';
  return nameOrUrl || 'Portal';
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

function toStringVal(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function mapCarRecord(
  pb: PocketBase,
  record: Record<string, unknown>,
  listingMap: Map<string, string>,
  localPrefs: LocalCarPrefsMap,
): CarListingItem {
  const id = String(record.id ?? '');
  const ref = toStringVal(record.ref);
  const features = parseJsonObject(record.features);
  const idListingRaw = record.id_listing;
  const idListing = Array.isArray(idListingRaw)
    ? toStringVal(idListingRaw[0])
    : toStringVal(idListingRaw);

  const portalKey = listingMap.get(idListing) ?? '';
  const portalName = portalKey ? formatPortalLabel(portalKey) : inferPortalFromUrl(ref);

  const title =
    toStringVal(features.title) ||
    toStringVal(record.text_description) ||
    [toStringVal(record.brand), toStringVal(record.model), toStringVal(record.version)]
      .filter(Boolean)
      .join(' ') ||
    'Veículo sem título';

  const price = toNumber(record.price) ?? toNumber(features.price) ?? 0;
  const year = toNumber(record.year) ?? toNumber(features.year);
  const manufactureYear = toNumber(features.manufacture_year);
  const mileageKm =
    typeof record.mileage_km === 'number' && record.mileage_km >= 0
      ? record.mileage_km
      : typeof features.mileage_km === 'number' && features.mileage_km >= 0
        ? features.mileage_km
        : null;

  const fipePricePortal = toNumber(record.fipe_price) ?? toNumber(features.fipe_price);
  const pref = localPrefs[id];
  const favorite =
    typeof record.is_favorite === 'boolean' ? record.is_favorite || Boolean(pref?.favorite) : Boolean(pref?.favorite);
  const hidden =
    typeof record.is_hidden === 'boolean' ? record.is_hidden || Boolean(pref?.hidden) : Boolean(pref?.hidden);
  const notes = toStringVal(record.notes) || (pref?.notes ?? '');

  const fipeDiffPct =
    fipePricePortal && price > 0 ? ((price - fipePricePortal) / fipePricePortal) * 100 : null;
  const fipeDiffValue = fipePricePortal && price > 0 ? price - fipePricePortal : null;

  return {
    id,
    ref,
    title,
    textDescription: toStringVal(record.text_description),
    portalName,
    idListing,
    price,
    year,
    manufactureYear,
    mileageKm,
    brand: toStringVal(record.brand) || toStringVal(features.brand),
    model: toStringVal(record.model) || toStringVal(features.model),
    version: toStringVal(record.version) || toStringVal(features.version),
    transmission: toStringVal(record.transmission) || toStringVal(features.transmission),
    fuel: toStringVal(record.fuel) || toStringVal(features.fuel),
    color: toStringVal(record.color) || toStringVal(features.color),
    bodyType: toStringVal(record.body_type) || toStringVal(features.body_type),
    engineSize: toStringVal(features.engine_size),
    isTurbo: Boolean(features.is_turbo),
    sellerType: toStringVal(record.seller_type) || toStringVal(features.seller_type),
    neighborhood: toStringVal(record.neighborhood) || toStringVal(features.neighborhood),
    city: toStringVal(record.city) || toStringVal(features.city) || 'Joinville',
    state: toStringVal(record.state) || toStringVal(features.state) || 'SC',
    fipePricePortal,
    fipeMatch: null,
    fipeReferenceValue: fipePricePortal,
    fipeDiffPct,
    fipeDiffValue,
    images: buildCarImages(pb, record),
    favorite,
    hidden,
    notes,
    rawFeatures: features,
    created: toStringVal(record.created),
    updated: toStringVal(record.updated),
  };
}

export async function fetchPublicCarListings(
  pb: PocketBase,
): Promise<CarListingItem[]> {
  const localPrefs = loadLocalCarPrefs();
  const listingMap = new Map<string, string>();

  try {
    const rawListings = await pb
      .collection(PB_CAR_COLLECTIONS.LISTINGS)
      .getFullList<Record<string, unknown>>({ fields: 'id,name' });
    for (const r of rawListings) {
      listingMap.set(String(r.id ?? ''), toStringVal(r.name));
    }
  } catch {
    // Fallback to URL-based portal detection if car_listings is restricted
  }

  let rawCarros: Record<string, unknown>[];
  try {
    rawCarros = await pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getFullList<Record<string, unknown>>({ sort: '-updated' });
  } catch (sortErr) {
    const status = getHttpStatus(sortErr);
    if (status === 404) {
      return [];
    }
    if (status === 400) {
      rawCarros = await pb
        .collection(PB_CAR_COLLECTIONS.CARROS)
        .getFullList<Record<string, unknown>>();
    } else {
      throw sortErr;
    }
  }

  return rawCarros.map((r) => mapCarRecord(pb, r, listingMap, localPrefs));
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

export async function updatePortalListing(
  pb: PocketBase,
  id: string,
  patch: {
    active?: boolean;
    lastPage?: number;
    url?: string;
    maxPages?: number;
    delayMs?: number;
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.active !== undefined) body.active = patch.active;
  if (patch.lastPage !== undefined) body.last_page = patch.lastPage;
  if (patch.url !== undefined) body.url = patch.url;
  if (patch.maxPages !== undefined) body.max_pages = patch.maxPages;
  if (patch.delayMs !== undefined) body.delay_ms = patch.delayMs;

  await pb.collection(PB_CAR_COLLECTIONS.LISTINGS).update(id, body);
}
