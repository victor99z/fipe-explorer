import type { AppSection } from '../components/Navbar';
import type { SortMode, VisibilityMode } from '../services/pocketbase';

export const FIPE_DEFAULTS = {
  budgetValue: '80000',
  useSmartRange: true,
  minPrice: '64000',
  maxPrice: '80000',
  minYear: '2018',
  maxYear: '2026',
  motorizacao: 'todos',
  cambio: 'todos',
  litragem: 'todos',
  combustivel: 'todos',
  ordenacao: 'preco_desc',
  page: 1,
} as const;

export interface FipeUrlState {
  budgetValue: string;
  useSmartRange: boolean;
  showAdvancedPricing: boolean;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  motorizacao: string;
  cambio: string;
  litragem: string;
  selectedBrands: string[];
  searchModel: string;
  combustivel: string;
  ordenacao: string;
  page: number;
}

export interface JoinvilleFipeUrlContext {
  term: string;
  year?: number;
  transmission?: string;
  fuel?: string;
  codigoFipe?: string;
  fipeLabel?: string;
}

export interface JoinvilleUrlState {
  search: string;
  cityFilter: string;
  neighborhoodFilter: string;
  brandFilter: string;
  minPrice: string;
  maxPrice: string;
  minYear: string;
  maxYear: string;
  maxKm: string;
  motorizacaoFilter: string;
  cambioFilter: string;
  litragemFilter: string;
  combustivelFilter: string;
  portalFilter: string;
  sellerFilter: string;
  onlyBelowFipe: boolean;
  visibilityMode: VisibilityMode;
  sortBy: SortMode;
  page: number;
  exactYearOnly: boolean;
  exactFipeOnly: boolean;
  fipeContext: JoinvilleFipeUrlContext | null;
}

export type HistorySubTab = 'ads' | 'timeline' | 'breakdown';
export type HistoryStatusFilter = 'all' | 'active' | 'inactive';
export type AdminUrlTab = 'overview' | 'crawler' | 'cars' | 'users' | 'alerts';

export interface ModelHistoryUrlState {
  search: string;
  brand: string;
  minYear: string;
  maxYear: string;
  minPrice: string;
  maxPrice: string;
  maxKm: string;
  cambio: string;
  fuel: string;
  portal: string;
  city: string;
  status: HistoryStatusFilter;
  fipeCode: string;
  activeTab: HistorySubTab;
  kmRangeMin: string;
  kmRangeMax: string;
}

const VALID_VISIBILITY: readonly VisibilityMode[] = [
  'active',
  'favorites',
  'hidden',
  'all',
];

const VALID_JOINVILLE_SORTS: readonly SortMode[] = [
  'newest',
  'price_asc',
  'price_desc',
  'fipe_discount_desc',
  'km_asc',
  'year_desc',
  'relevance',
];

const VALID_HISTORY_STATUS: readonly HistoryStatusFilter[] = [
  'all',
  'active',
  'inactive',
];

const VALID_ADMIN_TABS: readonly AdminUrlTab[] = [
  'overview',
  'crawler',
  'cars',
  'users',
  'alerts',
];

function toSearchParams(input?: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  if (typeof input === 'string') {
    return new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  }
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
}

function sanitizeDigits(raw: string | null): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

function parsePositivePage(raw: string | null): number {
  if (!raw) return 1;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function setIfNonEmpty(
  params: URLSearchParams,
  key: string,
  val: string | undefined | null,
  defaultVal?: string,
): void {
  const trimmed = (val ?? '').trim();
  if (!trimmed) return;
  if (defaultVal !== undefined && trimmed === defaultVal) return;
  params.set(key, trimmed);
}

export function getTabParamForSection(section: AppSection): string | null {
  switch (section) {
    case 'joinville':
      return 'anuncios';
    case 'history':
      return 'historico';
    case 'alerts':
      return 'alertas';
    case 'admin':
      return 'admin';
    default:
      return null;
  }
}

export function parseSectionFromUrl(input?: string | URLSearchParams): AppSection {
  const params = toSearchParams(input);
  const raw = (params.get('tab') ?? '').trim().toLowerCase();
  if (raw === 'anuncios' || raw === 'joinville') return 'joinville';
  if (raw === 'historico' || raw === 'history') return 'history';
  if (raw === 'alertas' || raw === 'alerts') return 'alerts';
  if (raw === 'admin') return 'admin';
  return 'fipe';
}

export function buildRelativeUrl(params: URLSearchParams): string {
  if (typeof window === 'undefined') {
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }
  const qs = params.toString();
  const basePath = window.location.pathname || '/';
  return `${basePath}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
}

export function syncUrlSearchParams(
  params: URLSearchParams,
  mode: 'replace' | 'push' = 'replace',
): void {
  if (typeof window === 'undefined') return;
  const nextUrl = buildRelativeUrl(params);
  const currentUrl = `${window.location.pathname || '/'}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl === currentUrl) return;
  if (mode === 'push') {
    window.history.pushState(null, '', nextUrl);
  } else {
    window.history.replaceState(null, '', nextUrl);
  }
}

export function parseFipeUrlParams(input?: string | URLSearchParams): FipeUrlState {
  const params = toSearchParams(input);
  const rawOrc = params.get('orc');
  const rawSmart = params.get('smart');
  const hasMin = params.has('min');
  const hasMax = params.has('max');

  let useSmartRange = rawSmart !== '0';
  let budgetValue: string = FIPE_DEFAULTS.budgetValue;
  let minPrice: string = FIPE_DEFAULTS.minPrice;
  let maxPrice: string = FIPE_DEFAULTS.maxPrice;

  if (rawOrc === 'todos') {
    budgetValue = '';
    minPrice = hasMin ? sanitizeDigits(params.get('min')) || '0' : '0';
    maxPrice = hasMax ? sanitizeDigits(params.get('max')) : '';
  } else if (rawOrc !== null) {
    const digits = sanitizeDigits(rawOrc);
    if (digits) {
      budgetValue = digits;
      const num = Number(digits);
      if (useSmartRange && !hasMin && !hasMax && num > 0) {
        minPrice = String(Math.round(num * 0.8));
        maxPrice = digits;
      } else {
        minPrice = hasMin
          ? sanitizeDigits(params.get('min')) || '0'
          : useSmartRange && num > 0
            ? String(Math.round(num * 0.8))
            : '0';
        maxPrice = hasMax ? sanitizeDigits(params.get('max')) : digits;
      }
    }
  } else if (hasMin || hasMax) {
    minPrice = sanitizeDigits(params.get('min')) || '0';
    maxPrice = sanitizeDigits(params.get('max'));
    useSmartRange = false;
  }

  const parsedNumBudget = Number(budgetValue);
  const matchesSmartPreset =
    Boolean(budgetValue) &&
    parsedNumBudget > 0 &&
    minPrice === String(Math.round(parsedNumBudget * 0.8)) &&
    maxPrice === budgetValue;

  const showAdvancedPricing =
    !useSmartRange ||
    (rawOrc !== 'todos' && (hasMin || hasMax) && !matchesSmartPreset);

  const rawBrands = params.get('marcas') ?? '';
  const selectedBrands = rawBrands
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  return {
    budgetValue,
    useSmartRange,
    showAdvancedPricing,
    minPrice,
    maxPrice,
    minYear: params.has('ano_min')
      ? sanitizeDigits(params.get('ano_min'))
      : FIPE_DEFAULTS.minYear,
    maxYear: params.has('ano_max')
      ? sanitizeDigits(params.get('ano_max'))
      : FIPE_DEFAULTS.maxYear,
    motorizacao: params.get('motor')?.trim() || FIPE_DEFAULTS.motorizacao,
    cambio: params.get('cambio')?.trim() || FIPE_DEFAULTS.cambio,
    litragem: params.get('lit')?.trim() || FIPE_DEFAULTS.litragem,
    selectedBrands,
    searchModel: params.get('q') ?? '',
    combustivel: params.get('comb')?.trim() || FIPE_DEFAULTS.combustivel,
    ordenacao: params.get('ordem')?.trim() || FIPE_DEFAULTS.ordenacao,
    page: parsePositivePage(params.get('pg')),
  };
}

export function buildFipeUrlParams(state: FipeUrlState): URLSearchParams {
  const params = new URLSearchParams();

  const budgetDigits = sanitizeDigits(state.budgetValue);
  const parsedBudget = Number(budgetDigits);
  const isDefaultBudget =
    budgetDigits === FIPE_DEFAULTS.budgetValue &&
    state.useSmartRange &&
    state.minPrice === FIPE_DEFAULTS.minPrice &&
    state.maxPrice === FIPE_DEFAULTS.maxPrice;

  if (!isDefaultBudget) {
    if (!budgetDigits && state.minPrice === '0' && state.maxPrice === '') {
      params.set('orc', 'todos');
    } else if (budgetDigits && budgetDigits !== FIPE_DEFAULTS.budgetValue) {
      params.set('orc', budgetDigits);
    }

    if (!state.useSmartRange) {
      params.set('smart', '0');
      params.set('min', state.minPrice || '0');
      if (state.maxPrice) params.set('max', state.maxPrice);
    } else if (
      budgetDigits &&
      parsedBudget > 0 &&
      (state.minPrice !== String(Math.round(parsedBudget * 0.8)) ||
        state.maxPrice !== budgetDigits)
    ) {
      params.set('min', state.minPrice || '0');
      if (state.maxPrice) params.set('max', state.maxPrice);
    }
  }

  if (state.minYear !== FIPE_DEFAULTS.minYear) {
    params.set('ano_min', state.minYear);
  }
  if (state.maxYear !== FIPE_DEFAULTS.maxYear) {
    params.set('ano_max', state.maxYear);
  }

  setIfNonEmpty(params, 'motor', state.motorizacao, FIPE_DEFAULTS.motorizacao);
  setIfNonEmpty(params, 'cambio', state.cambio, FIPE_DEFAULTS.cambio);
  setIfNonEmpty(params, 'lit', state.litragem, FIPE_DEFAULTS.litragem);
  if (state.selectedBrands.length > 0) {
    params.set('marcas', state.selectedBrands.join(','));
  }
  setIfNonEmpty(params, 'q', state.searchModel);
  setIfNonEmpty(params, 'comb', state.combustivel, FIPE_DEFAULTS.combustivel);
  setIfNonEmpty(params, 'ordem', state.ordenacao, FIPE_DEFAULTS.ordenacao);
  if (state.page > 1) {
    params.set('pg', String(state.page));
  }

  return params;
}

export function parseJoinvilleUrlParams(
  input?: string | URLSearchParams,
): JoinvilleUrlState {
  const params = toSearchParams(input);
  const rawVis = params.get('vis') as VisibilityMode | null;
  const visibilityMode: VisibilityMode =
    rawVis && VALID_VISIBILITY.includes(rawVis) ? rawVis : 'active';

  const rawSort = params.get('ordem') as SortMode | null;
  const sortBy: SortMode =
    rawSort && VALID_JOINVILLE_SORTS.includes(rawSort) ? rawSort : 'newest';

  const fipeCode = params.get('fipe_cod')?.trim() || '';
  const fipeYearStr = sanitizeDigits(params.get('fipe_ano'));
  const fipeYear = fipeYearStr ? Number(fipeYearStr) : undefined;
  const fipeLabel = params.get('fipe_label')?.trim() || '';
  const fipeTr = params.get('fipe_tr')?.trim() || '';
  const fipeFuel = params.get('fipe_comb')?.trim() || '';
  const hasFipeContext = Boolean(fipeCode || fipeLabel || fipeYear);

  return {
    search: params.get('q') ?? '',
    cityFilter: params.get('cidade')?.trim() || 'todas',
    neighborhoodFilter: params.get('bairro') ?? '',
    brandFilter: params.get('marca')?.trim() || '',
    minPrice: sanitizeDigits(params.get('min')),
    maxPrice: sanitizeDigits(params.get('max')),
    minYear: sanitizeDigits(params.get('ano_min')),
    maxYear: sanitizeDigits(params.get('ano_max')),
    maxKm: sanitizeDigits(params.get('km_max')),
    motorizacaoFilter: params.get('motor')?.trim() || 'todos',
    cambioFilter: params.get('cambio')?.trim() || 'todos',
    litragemFilter: params.get('lit')?.trim() || 'todos',
    combustivelFilter: params.get('comb')?.trim() || 'todos',
    portalFilter: params.get('portal')?.trim() || '',
    sellerFilter: params.get('anunciante')?.trim() || '',
    onlyBelowFipe: params.get('abaixo_fipe') === '1',
    visibilityMode,
    sortBy,
    page: parsePositivePage(params.get('pg')),
    exactYearOnly: hasFipeContext && params.get('ano_exato') === '1',
    exactFipeOnly: hasFipeContext && params.get('fipe_exato') === '1',
    fipeContext: hasFipeContext
      ? {
          term: params.get('q') ?? '',
          codigoFipe: fipeCode || undefined,
          year: fipeYear,
          transmission: fipeTr || undefined,
          fuel: fipeFuel || undefined,
          fipeLabel: fipeLabel || undefined,
        }
      : null,
  };
}

export function buildJoinvilleUrlParams(
  state: JoinvilleUrlState,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('tab', 'anuncios');

  setIfNonEmpty(params, 'q', state.search);
  setIfNonEmpty(params, 'cidade', state.cityFilter, 'todas');
  setIfNonEmpty(params, 'bairro', state.neighborhoodFilter);
  setIfNonEmpty(params, 'marca', state.brandFilter);
  setIfNonEmpty(params, 'min', state.minPrice);
  setIfNonEmpty(params, 'max', state.maxPrice);
  setIfNonEmpty(params, 'ano_min', state.minYear);
  setIfNonEmpty(params, 'ano_max', state.maxYear);
  setIfNonEmpty(params, 'km_max', state.maxKm);
  setIfNonEmpty(params, 'motor', state.motorizacaoFilter, 'todos');
  setIfNonEmpty(params, 'cambio', state.cambioFilter, 'todos');
  setIfNonEmpty(params, 'lit', state.litragemFilter, 'todos');
  setIfNonEmpty(params, 'comb', state.combustivelFilter, 'todos');
  setIfNonEmpty(params, 'portal', state.portalFilter);
  setIfNonEmpty(params, 'anunciante', state.sellerFilter);
  if (state.onlyBelowFipe) params.set('abaixo_fipe', '1');
  if (state.visibilityMode !== 'active') {
    params.set('vis', state.visibilityMode);
  }
  if (state.sortBy !== 'newest') {
    params.set('ordem', state.sortBy);
  }
  if (state.page > 1) {
    params.set('pg', String(state.page));
  }

  if (state.fipeContext) {
    setIfNonEmpty(params, 'fipe_cod', state.fipeContext.codigoFipe);
    if (state.fipeContext.year) {
      params.set('fipe_ano', String(state.fipeContext.year));
    }
    setIfNonEmpty(params, 'fipe_tr', state.fipeContext.transmission);
    setIfNonEmpty(params, 'fipe_comb', state.fipeContext.fuel);
    setIfNonEmpty(params, 'fipe_label', state.fipeContext.fipeLabel);
    if (state.exactYearOnly) params.set('ano_exato', '1');
    if (state.exactFipeOnly) params.set('fipe_exato', '1');
  }

  return params;
}

export function parseModelHistoryUrlParams(
  input?: string | URLSearchParams,
): ModelHistoryUrlState {
  const params = toSearchParams(input);
  const rawStatus = params.get('status') as HistoryStatusFilter | null;
  const status: HistoryStatusFilter =
    rawStatus && VALID_HISTORY_STATUS.includes(rawStatus) ? rawStatus : 'all';

  const rawSub = params.get('sub');
  const activeTab: HistorySubTab =
    rawSub === 'timeline' || rawSub === 'breakdown' ? rawSub : 'ads';

  return {
    search: params.get('q') ?? '',
    brand: params.get('marca')?.trim() || '',
    minYear: sanitizeDigits(params.get('ano_min')),
    maxYear: sanitizeDigits(params.get('ano_max')),
    minPrice: sanitizeDigits(params.get('min')),
    maxPrice: sanitizeDigits(params.get('max')),
    maxKm: sanitizeDigits(params.get('km_max')),
    cambio: params.get('cambio')?.trim() || 'todos',
    fuel: params.get('comb')?.trim() || 'todos',
    portal: params.get('portal')?.trim() || '',
    city: params.get('cidade')?.trim() || 'todas',
    status,
    fipeCode: params.get('fipe')?.trim() || '',
    activeTab,
    kmRangeMin: sanitizeDigits(params.get('km_de')),
    kmRangeMax: sanitizeDigits(params.get('km_ate')),
  };
}

export function buildModelHistoryUrlParams(
  state: ModelHistoryUrlState,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('tab', 'historico');

  setIfNonEmpty(params, 'q', state.search);
  setIfNonEmpty(params, 'marca', state.brand);
  setIfNonEmpty(params, 'ano_min', state.minYear);
  setIfNonEmpty(params, 'ano_max', state.maxYear);
  setIfNonEmpty(params, 'min', state.minPrice);
  setIfNonEmpty(params, 'max', state.maxPrice);
  setIfNonEmpty(params, 'km_max', state.maxKm);
  setIfNonEmpty(params, 'cambio', state.cambio, 'todos');
  setIfNonEmpty(params, 'comb', state.fuel, 'todos');
  setIfNonEmpty(params, 'portal', state.portal);
  setIfNonEmpty(params, 'cidade', state.city, 'todas');
  if (state.status !== 'all') {
    params.set('status', state.status);
  }
  setIfNonEmpty(params, 'fipe', state.fipeCode);
  if (state.activeTab !== 'ads') {
    params.set('sub', state.activeTab);
  }
  setIfNonEmpty(params, 'km_de', state.kmRangeMin);
  setIfNonEmpty(params, 'km_ate', state.kmRangeMax);

  return params;
}

export function parseAlertsUnreadFromUrl(
  input?: string | URLSearchParams,
): boolean {
  return toSearchParams(input).get('unread') === '1';
}

export function buildAlertsUrlParams(unreadOnly: boolean): URLSearchParams {
  const params = new URLSearchParams();
  params.set('tab', 'alertas');
  if (unreadOnly) params.set('unread', '1');
  return params;
}

export function parseAdminTabFromUrl(
  input?: string | URLSearchParams,
): AdminUrlTab {
  const raw = toSearchParams(input).get('sec') as AdminUrlTab | null;
  return raw && VALID_ADMIN_TABS.includes(raw) ? raw : 'overview';
}

export function buildAdminUrlParams(sec: AdminUrlTab): URLSearchParams {
  const params = new URLSearchParams();
  params.set('tab', 'admin');
  if (sec !== 'overview') params.set('sec', sec);
  return params;
}
