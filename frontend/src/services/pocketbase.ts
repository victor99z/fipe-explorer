import PocketBase, { ClientResponseError } from 'pocketbase';
import type { FipeMatchResult } from '../types/vehicle';

export const PB_CAR_COLLECTIONS = {
  CARROS: 'carros_temp',
  CARROS_HISTORY: 'carros_history',
  LISTINGS: 'car_listings',
  CRAWLER_RUNS: 'car_crawler_runs',
  CRAWLER_LOGS: 'car_crawler_logs',
  USER_CURATION: 'user_car_curation',
  ALERTS: 'car_alerts',
  ALERT_NOTIFICATIONS: 'car_alert_notifications',
} as const;

export const DEFAULT_POCKETBASE_URL =
  import.meta.env.VITE_POCKETBASE_URL?.trim().replace(/\/+$/, '') ||
  'https://pb.victorbernardes.dev';

const CAR_PREFS_STORAGE_KEY = 'fipex_car_prefs';

const LIST_CARD_FIELDS = [
  'id',
  'collectionId',
  'collectionName',
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
  'first_seen_at',
  'last_seen_at',
  'initial_price',
  'lowest_price',
  'highest_price',
  'price_changes_count',
  'last_price_change_at',
  'listing_status',
  'created',
  'updated',
].join(',');

export interface CarImage {
  fullUrl: string;
  thumbUrl: string;
  fallbackUrl?: string;
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
  firstSeenAt: string;
  lastSeenAt: string;
  initialPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  priceChangesCount: number;
  lastPriceChangeAt: string;
  listingStatus: string;
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
  userId?: string | null;
  curationMap?: LocalCarPrefsMap;
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

export const CAMBIO_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'automatico_cvt', label: 'Automático & CVT' },
  { value: 'automatico', label: 'Automático' },
  { value: 'CVT', label: 'CVT' },
  { value: 'manual', label: 'Manual' },
] as const;

export function formatCambioLabel(cambio?: string): string {
  if (!cambio || cambio === 'todos') return 'Todos';
  const match = CAMBIO_FILTER_OPTIONS.find(
    (opt) => opt.value.toLowerCase() === cambio.toLowerCase(),
  );
  return match ? match.label : cambio;
}

const AUTOMATIC_TEXT_TERMS = [
  'transmission ~ "Automát"',
  'transmission ~ "Automatizado"',
  'text_description ~ " aut."',
  'text_description ~ " aut "',
  'text_description ~ "autom"',
  'text_description ~ "tiptr"',
  'text_description ~ "s-tronic"',
  'text_description ~ "s.tr"',
  'text_description ~ "dsg"',
  'text_description ~ "powershift"',
  'text_description ~ "dualogic"',
  'text_description ~ "i-motion"',
];

const CVT_TEXT_TERMS = [
  'transmission ~ "CVT"',
  'text_description ~ " cvt"',
  'text_description ~ "e-cvt"',
];

export function buildCambioFilterClause(
  pb: PocketBase,
  cambio?: string,
  includeFipeModel = true,
): string | null {
  if (!cambio || cambio === 'todos') return null;

  const autoTerms = includeFipeModel
    ? [
        ...AUTOMATIC_TEXT_TERMS,
        'fipe_model ~ " aut"',
        'fipe_model ~ "tiptr"',
        'fipe_model ~ "s-tronic"',
      ]
    : AUTOMATIC_TEXT_TERMS;

  const cvtTerms = includeFipeModel
    ? [...CVT_TEXT_TERMS, 'fipe_model ~ " cvt"', 'fipe_model ~ "e-cvt"']
    : CVT_TEXT_TERMS;

  if (cambio === 'automatico_cvt') {
    return `((${[...autoTerms, ...cvtTerms].join(' || ')}) && transmission !~ "Manual")`;
  }
  if (cambio === 'automatico') {
    return `((${autoTerms.join(' || ')}) && transmission !~ "Manual")`;
  }
  if (cambio === 'CVT') {
    return `((${cvtTerms.join(' || ')}) && transmission !~ "Manual")`;
  }
  if (cambio === 'manual') {
    const manualTerms = [
      'transmission ~ "Manual"',
      'text_description ~ " manual"',
      'text_description ~ " mec"',
    ];
    if (includeFipeModel) {
      manualTerms.push('fipe_model ~ " manual"', 'fipe_model ~ " mec"');
    }
    return `((${manualTerms.join(' || ')}) && transmission !~ "Automát" && transmission !~ "CVT" && transmission !~ "Automatizado")`;
  }
  return pb.filter('transmission ~ {:cambio}', { cambio });
}

export const DEFAULT_REGIONAL_CITIES = [
  'Joinville',
  'Curitiba',
  'Blumenau',
  'Jaraguá do Sul',
  'Florianópolis',
] as const;

export function mergeAndSortRegionalCities(
  observedCities: Iterable<string>,
): string[] {
  const cities = new Set<string>(DEFAULT_REGIONAL_CITIES);
  for (const city of observedCities) {
    const trimmed = city.trim();
    if (trimmed) cities.add(trimmed);
  }
  return [...cities].sort((a, b) => {
    const ia = (DEFAULT_REGIONAL_CITIES as readonly string[]).indexOf(a);
    const ib = (DEFAULT_REGIONAL_CITIES as readonly string[]).indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'pt-BR');
  });
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

let sharedPocketBaseClient: PocketBase | null = null;

export function getPocketBaseClient(): PocketBase {
  if (!sharedPocketBaseClient) {
    const client = new PocketBase(DEFAULT_POCKETBASE_URL);
    client.autoCancellation(false);
    sharedPocketBaseClient = client;
  }
  return sharedPocketBaseClient;
}

export function createPocketBaseClient(url?: string): PocketBase {
  if (!url) {
    return getPocketBaseClient();
  }
  const client = new PocketBase(url.replace(/\/+$/, ''));
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
  const remoteUrls = parseStringArray(record.image_urls).filter((u) => /^https?:\/\//i.test(u));

  if (uploaded.length > 0) {
    const fileRecord = {
      ...record,
      collectionName: toStringVal(record.collectionName) || PB_CAR_COLLECTIONS.CARROS,
    };

    const resolved = uploaded
      .map((filename, idx): CarImage | null => {
        const remoteFallback = remoteUrls[idx];
        if (/^https?:\/\//i.test(filename)) {
          return { fullUrl: filename, thumbUrl: filename, fallbackUrl: remoteFallback };
        }
        const fullUrl = pb.files.getURL(fileRecord as never, filename);
        const thumbUrl = pb.files.getURL(fileRecord as never, filename, { thumb: '480x360' });
        if (!fullUrl && !thumbUrl) return null;
        return {
          fullUrl: fullUrl || thumbUrl,
          thumbUrl: thumbUrl || fullUrl,
          ...(remoteFallback ? { fallbackUrl: remoteFallback } : {}),
        };
      })
      .filter((img): img is CarImage => img !== null && Boolean(img.fullUrl && img.thumbUrl));

    if (resolved.length > 0) {
      return resolved;
    }
  }

  return remoteUrls.map((url) => ({ fullUrl: url, thumbUrl: url }));
}

export function applyCarImageFallback(
  imgEl: HTMLImageElement,
  fallbackUrl?: string,
): void {
  if (fallbackUrl && imgEl.dataset.fallbackApplied !== '1' && imgEl.src !== fallbackUrl) {
    imgEl.dataset.fallbackApplied = '1';
    imgEl.src = fallbackUrl;
    return;
  }
  imgEl.style.display = 'none';
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

const TURBO_TOKEN_REGEX =
  /\b(?:tb|(?:\d+)?tsi|(?:\d+)?tce|tgdi|t-?gdi|thp|tfsie?|t270|t200|ecoboost|turbo|biturbo|bi-tb|twinpower|tdi|cgi|kompressor)\b/i;

function inferCarSpecsFromText(text: string): {
  isTurbo: boolean;
  engineSize: string;
  transmission: string;
  fuel: string;
} {
  const lower = text.toLowerCase();
  const isTurbo = !/\bt\.flex\b/i.test(lower) && TURBO_TOKEN_REGEX.test(lower);
  const engineSize = text.match(/\b([1-6]\.[0-9])\b/)?.[1] ?? '';

  let transmission = '';
  if (/\b(?:e-?cvt|ecvt|cvt)\b/.test(lower)) {
    transmission = 'CVT';
  } else if (
    /\b(?:autom[aá]tic[oac]?s?|aut|autoshift|tiptronic|tiptr|dsg|s-?tronic|s\.tr|g-?tronic|steptronic|powershift|pdk|multitronic|geartronic|at\d?)\b/.test(
      lower,
    )
  ) {
    transmission = 'Automático';
  } else if (/\b(?:automatizado|imotion|i-motion|dualogic|easytronic)\b/.test(lower)) {
    transmission = 'Automatizado';
  } else if (/\b(?:manual|mec[aâ]nico|mec|mt\d?)\b/.test(lower)) {
    transmission = 'Manual';
  }

  let fuel = '';
  if (/\b(?:el[eé]trico|ev|bev)\b/.test(lower)) {
    fuel = 'Elétrico';
  } else if (/\b(?:h[ií]br[ií]do|hybrid|hib|phev|hev|mhev)\b/.test(lower)) {
    fuel = 'Híbrido';
  } else if (/\bflex\b/.test(lower)) {
    fuel = 'Flex';
  } else if (/\bdiesel\b/.test(lower)) {
    fuel = 'Diesel';
  } else if (/\b(?:gasolina|gas)\b/.test(lower)) {
    fuel = 'Gasolina';
  } else if (/\b(?:[aá]lcool|etanol)\b/.test(lower)) {
    fuel = 'Etanol';
  }

  return { isTurbo, engineSize, transmission, fuel };
}

export function mapCarRecord(
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

  const combinedText = `${title} ${toStringVal(record.version)} ${toStringVal(record.fipe_model)}`;
  const inferred = inferCarSpecsFromText(combinedText);
  const transmission = toStringVal(record.transmission) || inferred.transmission;
  const fuel = toStringVal(record.fuel) || inferred.fuel;
  const engineSize = toStringVal(record.engine_size) || inferred.engineSize;
  const isTurbo =
    (Boolean(record.is_turbo) && !/\bt\.flex\b/i.test(combinedText)) ||
    inferred.isTurbo;

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
    transmission,
    fuel,
    color: toStringVal(record.color),
    bodyType: toStringVal(record.body_type),
    engineSize,
    isTurbo,
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
    firstSeenAt: toStringVal(record.first_seen_at) || toStringVal(record.created),
    lastSeenAt: toStringVal(record.last_seen_at) || toStringVal(record.updated),
    initialPrice: toNumber(record.initial_price),
    lowestPrice: toNumber(record.lowest_price),
    highestPrice: toNumber(record.highest_price),
    priceChangesCount:
      typeof record.price_changes_count === 'number' && Number.isFinite(record.price_changes_count)
        ? record.price_changes_count
        : 0,
    lastPriceChangeAt: toStringVal(record.last_price_change_at),
    listingStatus: toStringVal(record.listing_status) || 'active',
    created: toStringVal(record.created),
    updated: toStringVal(record.updated),
  };
}

const TURBO_DESC_TERMS = [
  'turbo',
  ' tb ',
  ' tsi',
  '200tsi',
  '250tsi',
  '350tsi',
  'tfsi',
  'tgdi',
  't-gdi',
  ' thp',
  't200',
  't270',
  ' tce',
  'ecoboost',
  'biturbo',
  'bi-tb',
  'twinpower',
  'kompressor',
  ' tdi',
  ' cgi',
];

const TURBO_FIPE_TERMS = ['turbo', ' tb ', ' tsi', 'tfsi'];

function buildTurboFilterClause(positive: boolean): string {
  if (positive) {
    const matches = [
      'is_turbo = true',
      ...TURBO_DESC_TERMS.map((t) => `text_description ~ "${t}"`),
      ...TURBO_FIPE_TERMS.map((t) => `fipe_model ~ "${t}"`),
    ];
    return `(text_description !~ "t.flex" && (${matches.join(' || ')}))`;
  }
  const exclusions = [
    '(is_turbo = false || text_description ~ "t.flex")',
    ...TURBO_DESC_TERMS.map((t) => `text_description !~ "${t}"`),
    ...TURBO_FIPE_TERMS.map((t) => `fipe_model !~ "${t}"`),
  ];
  return `(${exclusions.join(' && ')})`;
}

export function buildTokenizedSearchClauses(
  pb: PocketBase,
  search: string | undefined,
  fields: string[] = [
    'text_description',
    'brand',
    'model',
    'version',
    'neighborhood',
    'city',
    'fipe_code',
    'fipe_model',
    'transmission',
    'fuel',
  ],
  prefix = 'tk',
): string[] {
  const clauses: string[] = [];
  const tokens = (search ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  tokens.forEach((tok, idx) => {
    const num = Number(tok);
    if (/^\d{4}$/.test(tok) && num >= 1960 && num <= 2030) {
      clauses.push(
        pb.filter(`(year = {:${prefix}yr${idx}} || text_description ~ {:${prefix}${idx}})`, {
          [`${prefix}yr${idx}`]: num,
          [`${prefix}${idx}`]: tok,
        }),
      );
    } else {
      const ors = fields.map((f) => `${f} ~ {:${prefix}${idx}}`).join(' || ');
      clauses.push(pb.filter(`(${ors})`, { [`${prefix}${idx}`]: tok }));
    }
  });

  return clauses;
}

const ACTIVE_LISTING_FILTER = '(listing_status = "" || listing_status = "active")';

function buildFilterExpression(
  pb: PocketBase,
  params: CarListQueryParams,
  localPrefs: LocalCarPrefsMap,
): { filter: string; shortCircuitEmpty: boolean } {
  const clauses: string[] = [];

  // Visibility filter + hide unavailable/expired listings in public 'active' tab
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
  } else if (params.visibilityMode === 'active') {
    clauses.push(ACTIVE_LISTING_FILTER);
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
    clauses.push(
      pb.filter('(brand = {:brand} || fipe_brand ~ {:brand})', {
        brand: params.brand.trim(),
      }),
    );
  }

  // Motorizacao (Turbo / Aspirado)
  if (params.motorizacao === 'turbo') {
    clauses.push(buildTurboFilterClause(true));
  } else if (params.motorizacao === 'aspirado') {
    clauses.push(buildTurboFilterClause(false));
  }

  // Cambio
  const cambioClause = buildCambioFilterClause(pb, params.cambio, true);
  if (cambioClause) {
    clauses.push(cambioClause);
  }

  // Litragem
  if (params.litragem && params.litragem !== 'todos') {
    if (params.litragem === '2.0+') {
      clauses.push('(engine_size >= "2.0" && engine_size != "")');
    } else {
      clauses.push(
        pb.filter(
          '(engine_size = {:lit} || text_description ~ {:litSpaced} || fipe_model ~ {:litSpaced})',
          { lit: params.litragem, litSpaced: ` ${params.litragem} ` },
        ),
      );
    }
  }

  // Combustivel
  if (params.combustivel && params.combustivel !== 'todos') {
    const fuelVal = params.combustivel.trim();
    const lowFuel = fuelVal.toLowerCase();
    if (lowFuel === 'híbrido' || lowFuel === 'hibrido') {
      clauses.push(
        '(fuel ~ "Híbrido" || fuel ~ "Hibrido" || text_description ~ "híbrido" || text_description ~ "hibrido" || text_description ~ "hibrído" || text_description ~ "hybrid" || text_description ~ "(hib" || fipe_model ~ "híbrido" || fipe_model ~ "hibrído" || fipe_model ~ "hybrid" || fipe_model ~ "(hib")',
      );
    } else if (lowFuel === 'elétrico' || lowFuel === 'eletrico') {
      clauses.push(
        '(fuel ~ "Elétrico" || fuel ~ "Eletrico" || text_description ~ "elétrico" || text_description ~ "eletrico" || fipe_model ~ "elétrico" || fipe_model ~ "eletrico")',
      );
    } else if (lowFuel === 'etanol' || lowFuel === 'álcool' || lowFuel === 'alcool') {
      clauses.push(
        '(fuel ~ "Etanol" || fuel ~ "Álcool" || text_description ~ "etanol" || text_description ~ "álcool" || fipe_model ~ "álcool")',
      );
    } else {
      clauses.push(
        pb.filter('(fuel ~ {:fuel} || text_description ~ {:fuel} || fipe_model ~ {:fuel})', {
          fuel: fuelVal,
        }),
      );
    }
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
  clauses.push(...buildTokenizedSearchClauses(pb, params.search));

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

export async function fetchUserCurationMap(
  pb: PocketBase,
  userId: string,
): Promise<LocalCarPrefsMap> {
  if (!userId) return {};
  try {
    const records = await pb
      .collection(PB_CAR_COLLECTIONS.USER_CURATION)
      .getFullList<{
        carro_id?: string;
        is_favorite?: boolean;
        is_hidden?: boolean;
        notes?: string;
      }>({
        filter: pb.filter('user = {:uid}', { uid: userId }),
        fields: 'carro_id,is_favorite,is_hidden,notes',
      });
    const map: LocalCarPrefsMap = {};
    for (const r of records) {
      if (!r.carro_id) continue;
      map[r.carro_id] = {
        favorite: Boolean(r.is_favorite),
        hidden: Boolean(r.is_hidden),
        notes: typeof r.notes === 'string' ? r.notes : '',
      };
    }
    return map;
  } catch {
    return {};
  }
}

export async function fetchPagedCarListings(
  pb: PocketBase,
  params: CarListQueryParams,
): Promise<CarListPageResult> {
  const localPrefs = params.curationMap ?? loadLocalCarPrefs();
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
          ...(filter ? { filter } : {}),
          fields:
            'id,collectionId,collectionName,ref,text_description,id_listing,images,image_urls,price,year,mileage_km,brand,model,version,transmission,fuel,color,body_type,seller_type,neighborhood,city,state,fipe_price,fipe_code,fipe_brand,fipe_model,fipe_year,fipe_ref_period,fipe_diff_pct,notes,created,updated',
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
  const baseClauses = [ACTIVE_LISTING_FILTER];
  if (cityFilter && cityFilter !== 'todas') {
    baseClauses.push(pb.filter('city ~ {:city}', { city: cityFilter }));
  }
  const baseFilter = baseClauses.join(' && ');
  const belowFilter = `${baseFilter} && fipe_price > 0 && fipe_diff_pct <= 0`;

  const [totalRes, belowRes, sampleRes, citiesRes] = await Promise.all([
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList(1, 1, {
        filter: baseFilter,
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
        filter: baseFilter,
        fields: 'brand,fuel,price',
      })
      .catch(() => ({ items: [] as Record<string, unknown>[] })),
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getFullList<Record<string, unknown>>({
        filter: `${ACTIVE_LISTING_FILTER} && city != ""`,
        sort: '-updated',
        fields: 'city',
        batch: 1000,
      })
      .catch(() => [] as Record<string, unknown>[]),
  ]);

  const observedCities: string[] = [];
  const brands = new Set<string>();
  const fuels = new Set<string>();
  let priceSum = 0;
  let priceCount = 0;

  for (const r of citiesRes) {
    const c = toStringVal(r.city);
    if (c) observedCities.push(c);
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
    cities: mergeAndSortRegionalCities(observedCities),
    brands: [...brands].sort(),
    fuels: [...fuels].sort(),
  };
}

export async function updateCarCuration(
  pb: PocketBase,
  car: CarListingItem,
  patch: { favorite?: boolean; hidden?: boolean; notes?: string },
  userId?: string | null,
): Promise<LocalCarPref> {
  const nextPref: LocalCarPref = {
    favorite: patch.favorite ?? car.favorite,
    hidden: patch.hidden ?? car.hidden,
    notes: patch.notes ?? car.notes,
  };

  if (!userId) {
    const prefs = loadLocalCarPrefs();
    prefs[car.id] = nextPref;
    saveLocalCarPrefs(prefs);
    return nextPref;
  }

  try {
    const existing = await pb
      .collection(PB_CAR_COLLECTIONS.USER_CURATION)
      .getFirstListItem<{ id: string }>(
        pb.filter('user = {:uid} && carro_id = {:cid}', { uid: userId, cid: car.id }),
        { fields: 'id' },
      )
      .catch(() => null);

    const payload = {
      user: userId,
      carro_id: car.id,
      car_ref: car.ref,
      is_favorite: Boolean(nextPref.favorite),
      is_hidden: Boolean(nextPref.hidden),
      notes: nextPref.notes ?? '',
    };

    if (existing) {
      await pb.collection(PB_CAR_COLLECTIONS.USER_CURATION).update(existing.id, payload);
    } else {
      await pb.collection(PB_CAR_COLLECTIONS.USER_CURATION).create(payload);
    }
  } catch {
    // Fallback to localStorage if user_car_curation is not yet created on a remote PB
    const prefs = loadLocalCarPrefs();
    prefs[car.id] = nextPref;
    saveLocalCarPrefs(prefs);
  }

  return nextPref;
}
