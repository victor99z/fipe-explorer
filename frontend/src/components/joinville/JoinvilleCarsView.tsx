import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Car,
  ExternalLink,
  EyeOff,
  Fuel,
  Gauge,
  Heart,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { matchListingsFipe } from '../../services/api';
import {
  createPocketBaseClient,
  fetchPublicCarListings,
  updateCarCuration,
  type CarListingItem,
} from '../../services/pocketbase';
import CustomDropdown from '../ui/custom-dropdown';
import { CarListingModal } from './CarListingModal';

type VisibilityMode = 'active' | 'favorites' | 'hidden' | 'all';
type SortMode =
  | 'relevance'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'km_asc'
  | 'fipe_discount_desc'
  | 'year_desc';

export interface FipeListingSearchIntent {
  term: string;
  brand?: string;
  model?: string;
  year?: number;
  transmission?: string;
  fuel?: string;
  codigoFipe?: string;
  fipeLabel?: string;
  nonce: number;
}

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function computeFipeCompatibilityScore(
  car: CarListingItem,
  ctx: FipeListingSearchIntent | null,
): number {
  if (!ctx) return 0;
  let score = 0;
  if (ctx.codigoFipe && car.fipeMatch?.codigo_fipe === ctx.codigoFipe) score += 100;
  if (ctx.year && car.year === ctx.year) score += 40;
  else if (ctx.year && car.year && Math.abs(car.year - ctx.year) === 1) score += 15;
  if (ctx.transmission && car.transmission === ctx.transmission) score += 20;
  if (ctx.fuel && car.fuel === ctx.fuel) score += 20;
  if (ctx.brand && normalizeSearchText(car.brand) === normalizeSearchText(ctx.brand)) score += 10;
  return score;
}

function formatBRL(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'Sob consulta';
  }
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export interface JoinvilleCarsViewProps {
  initialSearch?: FipeListingSearchIntent | null;
}

export default function JoinvilleCarsView({ initialSearch }: JoinvilleCarsViewProps) {
  const searchInputId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const minYearId = useId();
  const maxKmId = useId();

  const pb = useMemo(() => createPocketBaseClient(), []);

  const [carros, setCarros] = useState<CarListingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<CarListingItem | null>(null);

  // Filters
  const [search, setSearch] = useState(() => initialSearch?.term ?? '');
  const [portalFilter, setPortalFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [transmissionFilter, setTransmissionFilter] = useState('');
  const [fuelFilter, setFuelFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [onlyBelowFipe, setOnlyBelowFipe] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('active');
  const [sortBy, setSortBy] = useState<SortMode>(() => (initialSearch ? 'relevance' : 'newest'));
  const [showFilters, setShowFilters] = useState(true);
  const [fipeContext, setFipeContext] = useState<FipeListingSearchIntent | null>(() => initialSearch ?? null);
  const [exactYearOnly, setExactYearOnly] = useState(false);
  const [exactFipeOnly, setExactFipeOnly] = useState(false);

  useEffect(() => {
    if (!initialSearch) return;
    setSearch(initialSearch.term);
    setBrandFilter('');
    setTransmissionFilter('');
    setFuelFilter('');
    setMinYear('');
    setExactYearOnly(false);
    setExactFipeOnly(false);
    setFipeContext(initialSearch);
    setVisibilityMode('active');
    setSortBy('relevance');
  }, [initialSearch]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      portalFilter ||
      brandFilter ||
      transmissionFilter ||
      fuelFilter ||
      sellerFilter ||
      minPrice ||
      maxPrice ||
      minYear ||
      maxKm ||
      onlyBelowFipe ||
      exactYearOnly ||
      exactFipeOnly ||
      fipeContext ||
      visibilityMode !== 'active',
  );

  const activeFilterCount = [
    portalFilter,
    brandFilter,
    transmissionFilter,
    fuelFilter,
    sellerFilter,
    minPrice || maxPrice,
    minYear,
    maxKm,
  ].filter(Boolean).length;

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((cur) => (cur === msg ? null : cur));
    }, 3000);
  }, []);

  const enrichWithFipe = useCallback(async (items: CarListingItem[]): Promise<CarListingItem[]> => {
    if (items.length === 0) return items;

    const allMatches: Record<string, CarListingItem['fipeMatch']> = {};
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100).map((c) => ({
        id: c.id,
        brand: c.brand || undefined,
        model: c.model || undefined,
        version: c.version || undefined,
        year: c.year,
        fuel: c.fuel || undefined,
        transmission: c.transmission || undefined,
        title: c.title,
      }));
      const res = await matchListingsFipe(batch);
      Object.assign(allMatches, res.matches);
    }

    return items.map((car) => {
      const match = allMatches[car.id] ?? null;
      const refVal = match?.valor ?? car.fipePricePortal ?? null;
      const diffVal = refVal && car.price > 0 ? car.price - refVal : null;
      const diffPct =
        refVal && refVal > 0 && car.price > 0
          ? ((car.price - refVal) / refVal) * 100
          : null;

      return {
        ...car,
        fipeMatch: match,
        fipeReferenceValue: refVal,
        fipeDiffValue: diffVal,
        fipeDiffPct: diffPct,
      };
    });
  }, []);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await fetchPublicCarListings(pb);
      const enriched = await enrichWithFipe(items);
      setCarros(enriched);
      setSelectedCar((cur) =>
        cur ? enriched.find((c) => c.id === cur.id) ?? null : null,
      );
    } catch {
      setLoadError('Não foi possível carregar os anúncios no momento. Tente novamente em instantes.');
      setCarros([]);
    } finally {
      setLoading(false);
    }
  }, [pb, enrichWithFipe]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  async function handleToggleFavorite(car: CarListingItem) {
    const nextFav = !car.favorite;
    await updateCarCuration(pb, car, { favorite: nextFav });
    setCarros((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, favorite: nextFav } : c)),
    );
    setSelectedCar((cur) =>
      cur?.id === car.id ? { ...cur, favorite: nextFav } : cur,
    );
    showNotice(nextFav ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
  }

  async function handleToggleHidden(car: CarListingItem) {
    const nextHidden = !car.hidden;
    await updateCarCuration(pb, car, { hidden: nextHidden });
    setCarros((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, hidden: nextHidden } : c)),
    );
    setSelectedCar((cur) =>
      cur?.id === car.id ? { ...cur, hidden: nextHidden } : cur,
    );
    showNotice(nextHidden ? 'Anúncio ocultado.' : 'Anúncio restaurado.');
  }

  async function handleSaveNotes(car: CarListingItem, notes: string) {
    await updateCarCuration(pb, car, { notes });
    setCarros((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, notes } : c)),
    );
    setSelectedCar((cur) => (cur?.id === car.id ? { ...cur, notes } : cur));
    showNotice('Observação salva.');
  }

  function resetFilters() {
    setSearch('');
    setPortalFilter('');
    setBrandFilter('');
    setTransmissionFilter('');
    setFuelFilter('');
    setSellerFilter('');
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxKm('');
    setOnlyBelowFipe(false);
    setExactYearOnly(false);
    setExactFipeOnly(false);
    setFipeContext(null);
    setVisibilityMode('active');
    setSortBy('newest');
  }

  const filterOptions = useMemo(() => {
    const portals = new Set<string>();
    const brands = new Set<string>();
    const transmissions = new Set<string>();
    const fuels = new Set<string>();
    const sellers = new Set<string>();

    for (const c of carros) {
      if (c.portalName) portals.add(c.portalName);
      if (c.brand) brands.add(c.brand);
      if (c.transmission) transmissions.add(c.transmission);
      if (c.fuel) fuels.add(c.fuel);
      if (c.sellerType) sellers.add(c.sellerType);
    }

    return {
      portals: [...portals].sort(),
      brands: [...brands].sort(),
      transmissions: [...transmissions].sort(),
      fuels: [...fuels].sort(),
      sellers: [...sellers].sort(),
    };
  }, [carros]);

  const filteredCars = useMemo(() => {
    const queryTokens = normalizeSearchText(search.trim())
      .split(/\s+/)
      .filter(Boolean);
    const minP = Number(minPrice.replace(/[^\d]/g, '')) || 0;
    const maxP = Number(maxPrice.replace(/[^\d]/g, '')) || 0;
    const minY = Number(minYear) || 0;
    const maxK = Number(maxKm.replace(/[^\d]/g, '')) || 0;

    const list = carros.filter((c) => {
      if (visibilityMode === 'active' && c.hidden) return false;
      if (visibilityMode === 'favorites' && (!c.favorite || c.hidden)) return false;
      if (visibilityMode === 'hidden' && !c.hidden) return false;

      if (portalFilter && c.portalName !== portalFilter) return false;
      if (brandFilter && c.brand !== brandFilter) return false;
      if (transmissionFilter && c.transmission !== transmissionFilter) return false;
      if (fuelFilter && c.fuel !== fuelFilter) return false;
      if (sellerFilter && c.sellerType !== sellerFilter) return false;

      if (minP > 0 && (c.price <= 0 || c.price < minP)) return false;
      if (maxP > 0 && (c.price <= 0 || c.price > maxP)) return false;
      if (minY > 0 && (!c.year || c.year < minY)) return false;
      if (maxK > 0 && (c.mileageKm === null || c.mileageKm > maxK)) return false;
      if (onlyBelowFipe && (c.fipeDiffPct === null || c.fipeDiffPct > 0)) return false;
      if (exactYearOnly && fipeContext?.year && c.year !== fipeContext.year) return false;
      if (exactFipeOnly && fipeContext?.codigoFipe && c.fipeMatch?.codigo_fipe !== fipeContext.codigoFipe) {
        return false;
      }

      if (queryTokens.length > 0) {
        const hay = normalizeSearchText(
          [
            c.title,
            c.brand,
            c.model,
            c.version,
            c.year ? String(c.year) : '',
            c.manufactureYear ? String(c.manufactureYear) : '',
            c.transmission,
            c.fuel,
            c.bodyType,
            c.color,
            c.neighborhood,
            c.city,
            c.state,
            c.portalName,
            c.sellerType,
            c.notes,
            c.fipeMatch?.codigo_fipe ?? '',
            c.fipeMatch?.nome_modelo ?? '',
          ].join(' '),
        );
        if (!queryTokens.every((token) => hay.includes(token))) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case 'relevance': {
          const diff =
            computeFipeCompatibilityScore(b, fipeContext) -
            computeFipeCompatibilityScore(a, fipeContext);
          if (diff !== 0) return diff;
          return (a.fipeDiffPct ?? Infinity) - (b.fipeDiffPct ?? Infinity);
        }
        case 'price_asc':
          return (a.price || Infinity) - (b.price || Infinity);
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        case 'km_asc':
          return (a.mileageKm ?? Infinity) - (b.mileageKm ?? Infinity);
        case 'year_desc':
          return (b.year ?? 0) - (a.year ?? 0);
        case 'fipe_discount_desc':
          return (a.fipeDiffPct ?? Infinity) - (b.fipeDiffPct ?? Infinity);
        case 'newest':
        default:
          return b.updated.localeCompare(a.updated);
      }
    });

    return list;
  }, [
    carros,
    search,
    portalFilter,
    brandFilter,
    transmissionFilter,
    fuelFilter,
    sellerFilter,
    minPrice,
    maxPrice,
    minYear,
    maxKm,
    onlyBelowFipe,
    exactYearOnly,
    exactFipeOnly,
    fipeContext,
    visibilityMode,
    sortBy,
  ]);

  const stats = useMemo(() => {
    const active = carros.filter((c) => !c.hidden);
    const priced = active.filter((c) => c.price > 0);
    const avgPrice =
      priced.length > 0
        ? priced.reduce((acc, c) => acc + c.price, 0) / priced.length
        : 0;
    const belowFipeCount = active.filter(
      (c) => c.fipeDiffPct !== null && c.fipeDiffPct <= 0,
    ).length;
    const favCount = carros.filter((c) => c.favorite).length;

    return {
      total: active.length,
      belowFipeCount,
      avgPrice,
      favCount,
    };
  }, [carros]);

  return (
    <div className="space-y-6">
      {/* Compact public header */}
      <section className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803d] dark:text-[#3ecf8e]">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Joinville &amp; Região</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-[#ededed]">
              Anúncios Reais vs. Tabela FIPE
            </h1>
            <p className="text-xs sm:text-sm text-[#707070] dark:text-[#a1a1aa] max-w-2xl">
              Compare preços de veículos anunciados em Joinville com a referência atual da Tabela FIPE.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadListings()}
            disabled={loading}
            className="h-8 self-start sm:self-center inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs font-medium text-[#171717] dark:text-[#ededed] hover:border-[#3ecf8e]/50 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3ecf8e] ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Atualizar</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-[#ededed] dark:border-[#27272a] text-xs text-[#707070] dark:text-[#a1a1aa] tabular-nums">
          <span>
            Anúncios:{' '}
            <strong className="text-[#171717] dark:text-[#ededed]">
              {stats.total.toLocaleString('pt-BR')}
            </strong>
          </span>
          <span>•</span>
          <span>
            Abaixo da FIPE:{' '}
            <strong className="text-[#15803d] dark:text-[#3ecf8e]">
              {stats.belowFipeCount.toLocaleString('pt-BR')}
            </strong>
          </span>
          <span>•</span>
          <span>
            Preço médio:{' '}
            <strong className="text-[#171717] dark:text-[#ededed]">
              {stats.avgPrice > 0 ? formatBRL(stats.avgPrice) : '—'}
            </strong>
          </span>
          <span>•</span>
          <span>
            Favoritos:{' '}
            <strong className="text-[#171717] dark:text-[#ededed]">
              {stats.favCount.toLocaleString('pt-BR')}
            </strong>
          </span>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 px-4 py-2.5 text-xs font-medium text-[#15803d] dark:text-[#3ecf8e]"
        >
          {notice}
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300"
        >
          {loadError}
        </div>
      )}

      <div className="space-y-4">
        {/* Filter controls: unified h-8 toolbar + symmetrical 4x2 grid */}
        <section
          aria-label="Filtros de busca"
          className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-3.5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <label htmlFor={searchInputId} className="sr-only">
                Buscar por marca, modelo, versão, bairro ou observação
              </label>
              <input
                id={searchInputId}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar modelo, versão, bairro ou nota..."
                className="w-full h-8 pl-8 pr-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:outline-none focus:border-[#3ecf8e]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Segmented visibility tabs */}
              <div
                role="group"
                aria-label="Visibilidade dos anúncios"
                className="inline-flex items-center h-8 p-0.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212]"
              >
                {(['active', 'favorites', 'hidden', 'all'] as VisibilityMode[]).map((mode) => {
                  const labels: Record<VisibilityMode, string> = {
                    active: 'Ativos',
                    favorites: 'Favoritos',
                    hidden: 'Ocultos',
                    all: 'Todos',
                  };
                  const pressed = visibilityMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => setVisibilityMode(mode)}
                      className={`h-[26px] inline-flex items-center justify-center px-2.5 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
                        pressed
                          ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e]'
                          : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }`}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                aria-pressed={onlyBelowFipe}
                onClick={() => setOnlyBelowFipe((v) => !v)}
                className={`h-8 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                  onlyBelowFipe
                    ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/50'
                    : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a] hover:text-[#171717] dark:hover:text-[#ededed]'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Abaixo da FIPE</span>
              </button>

              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
                className={`h-8 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-[6px] border text-xs font-medium transition-colors cursor-pointer ${
                  showFilters
                    ? 'border-[#3ecf8e]/50 bg-[#3ecf8e]/10 text-[#15803d] dark:text-[#3ecf8e]'
                    : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#3ecf8e] text-[#171717] text-[10px] font-semibold tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Limpar todos os filtros"
                  className="h-8 inline-flex items-center justify-center gap-1.5 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs font-medium text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3.5 border-t border-[#ededed] dark:border-[#27272a]">
              {/* Row 1: 4 equal dropdown cells */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Portal
                </span>
                <CustomDropdown
                  value={portalFilter}
                  onChange={(val) => setPortalFilter(String(val))}
                  placeholder="Todos os portais"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={Boolean(portalFilter)}
                  options={[
                    { value: '', label: 'Todos os portais' },
                    ...filterOptions.portals.map((p) => ({ value: p, label: p })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Marca
                </span>
                <CustomDropdown
                  value={brandFilter}
                  onChange={(val) => setBrandFilter(String(val))}
                  placeholder="Todas as marcas"
                  searchable
                  searchPlaceholder="Filtrar marca..."
                  className="w-full"
                  menuClassName="w-full min-w-[180px]"
                  isActive={Boolean(brandFilter)}
                  options={[
                    { value: '', label: 'Todas as marcas' },
                    ...filterOptions.brands.map((b) => ({ value: b, label: b })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Câmbio
                </span>
                <CustomDropdown
                  value={transmissionFilter}
                  onChange={(val) => setTransmissionFilter(String(val))}
                  placeholder="Todos os câmbios"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={Boolean(transmissionFilter)}
                  options={[
                    { value: '', label: 'Todos os câmbios' },
                    ...filterOptions.transmissions.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Combustível
                </span>
                <CustomDropdown
                  value={fuelFilter}
                  onChange={(val) => setFuelFilter(String(val))}
                  placeholder="Todos"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={Boolean(fuelFilter)}
                  options={[
                    { value: '', label: 'Todos' },
                    ...filterOptions.fuels.map((f) => ({ value: f, label: f })),
                  ]}
                />
              </div>

              {/* Row 2: 4 equal cells */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Anunciante
                </span>
                <CustomDropdown
                  value={sellerFilter}
                  onChange={(val) => setSellerFilter(String(val))}
                  placeholder="Loja e Particular"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={Boolean(sellerFilter)}
                  options={[
                    { value: '', label: 'Loja e Particular' },
                    ...filterOptions.sellers.map((s) => ({ value: s, label: s })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Faixa de preço (R$)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label htmlFor={minPriceId} className="sr-only">
                      Preço mínimo em R$
                    </label>
                    <input
                      id={minPriceId}
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Mín."
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:outline-none focus:border-[#3ecf8e]"
                    />
                  </div>
                  <div>
                    <label htmlFor={maxPriceId} className="sr-only">
                      Preço máximo em R$
                    </label>
                    <input
                      id={maxPriceId}
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Máx."
                      className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:outline-none focus:border-[#3ecf8e]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={minYearId}
                  className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider"
                >
                  Ano mínimo
                </label>
                <input
                  id={minYearId}
                  type="number"
                  min={1980}
                  max={2030}
                  value={minYear}
                  onChange={(e) => setMinYear(e.target.value)}
                  placeholder="Ex.: 2018"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:outline-none focus:border-[#3ecf8e]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={maxKmId}
                  className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider"
                >
                  Km máximo
                </label>
                <input
                  id={maxKmId}
                  type="number"
                  min={0}
                  value={maxKm}
                  onChange={(e) => setMaxKm(e.target.value)}
                  placeholder="Ex.: 80000"
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:outline-none focus:border-[#3ecf8e]"
                />
              </div>
            </div>
          )}

          {fipeContext && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#ededed] dark:border-[#27272a]">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[#707070] dark:text-[#a1a1aa]">
                  Referência FIPE:
                </span>
                <span className="font-medium text-[#171717] dark:text-[#ededed]">
                  {fipeContext.fipeLabel}
                </span>
                {fipeContext.codigoFipe && (
                  <button
                    type="button"
                    aria-pressed={exactFipeOnly}
                    onClick={() => setExactFipeOnly((v) => !v)}
                    className={`h-6 inline-flex items-center px-2 rounded-[4px] font-mono text-[11px] border cursor-pointer ${
                      exactFipeOnly
                        ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/50'
                        : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                    }`}
                  >
                    FIPE {fipeContext.codigoFipe}
                  </button>
                )}
                {fipeContext.year && (
                  <button
                    type="button"
                    aria-pressed={exactYearOnly}
                    onClick={() => setExactYearOnly((v) => !v)}
                    className={`h-6 inline-flex items-center px-2 rounded-[4px] text-[11px] tabular-nums border cursor-pointer ${
                      exactYearOnly
                        ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/50'
                        : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                    }`}
                  >
                    Ano {fipeContext.year}
                  </button>
                )}
                {fipeContext.transmission && (
                  <button
                    type="button"
                    aria-pressed={transmissionFilter === fipeContext.transmission}
                    onClick={() =>
                      setTransmissionFilter((cur) =>
                        cur === fipeContext.transmission ? '' : fipeContext.transmission!,
                      )
                    }
                    className={`h-6 inline-flex items-center px-2 rounded-[4px] text-[11px] border cursor-pointer ${
                      transmissionFilter === fipeContext.transmission
                        ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/50'
                        : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                    }`}
                  >
                    {fipeContext.transmission}
                  </button>
                )}
                {fipeContext.fuel && (
                  <button
                    type="button"
                    aria-pressed={fuelFilter === fipeContext.fuel}
                    onClick={() =>
                      setFuelFilter((cur) =>
                        cur === fipeContext.fuel ? '' : fipeContext.fuel!,
                      )
                    }
                    className={`h-6 inline-flex items-center px-2 rounded-[4px] text-[11px] border cursor-pointer ${
                      fuelFilter === fipeContext.fuel
                        ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/50'
                        : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                    }`}
                  >
                    {fipeContext.fuel}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] underline underline-offset-2 cursor-pointer"
              >
                Limpar referência
              </button>
            </div>
          )}
        </section>

        {/* Results count & Sort bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-xs text-[#707070] dark:text-[#a1a1aa]">
            <span className="tabular-nums">
              Exibindo{' '}
              <strong className="text-[#171717] dark:text-[#ededed]">
                {filteredCars.length.toLocaleString('pt-BR')}
              </strong>{' '}
              {filteredCars.length === 1 ? 'anúncio' : 'anúncios'}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs text-[#707070] dark:text-[#a1a1aa] whitespace-nowrap">
              Ordenar por:
            </span>
            <CustomDropdown
              value={sortBy}
              onChange={(val) => setSortBy(val as SortMode)}
              className="w-48 sm:w-52"
              menuClassName="w-52"
              align="right"
              isActive={sortBy !== 'newest'}
              options={[
                ...(fipeContext ? [{ value: 'relevance', label: 'Mais compatíveis' }] : []),
                { value: 'newest', label: 'Mais recentes' },
                { value: 'fipe_discount_desc', label: 'Maior desconto vs FIPE' },
                { value: 'price_asc', label: 'Menor preço' },
                { value: 'price_desc', label: 'Maior preço' },
                { value: 'km_asc', label: 'Menor quilometragem' },
                { value: 'year_desc', label: 'Ano mais novo' },
              ]}
            />
          </div>
        </div>

        {/* Cards grid */}
        {loading && carros.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="h-80 rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#18181b] animate-pulse"
              />
            ))}
          </div>
        ) : filteredCars.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#dfdfdf] dark:border-[#27272a] p-10 text-center space-y-2">
            <Car className="w-8 h-8 text-[#9a9a9a] mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
              Nenhum veículo encontrado para os filtros atuais
            </p>
            <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">
              Tente limpar ou ajustar os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCars.map((car) => {
              const thumb = car.images[0]?.thumbUrl;
              const diffPct = car.fipeDiffPct;
              const isBelow = diffPct !== null && diffPct <= 0;

              return (
                <article
                  key={car.id}
                  onClick={() => setSelectedCar(car)}
                  className="group rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] hover:border-[#3ecf8e]/60 transition-colors overflow-hidden flex flex-col cursor-pointer"
                >
                  <div className="relative aspect-[16/10] bg-[#f5f5f5] dark:bg-[#121212] overflow-hidden flex items-center justify-center">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={car.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <Car className="w-10 h-10 text-[#b2b2b2] dark:text-[#52525b]" aria-hidden="true" />
                    )}

                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-medium bg-black/75 text-white backdrop-blur-xs">
                        {car.portalName}
                      </span>
                      {car.sellerType && (
                        <span className="inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-medium bg-white/90 dark:bg-[#18181b]/90 text-[#171717] dark:text-[#ededed]">
                          {car.sellerType}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {car.year && (
                          <span className="inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-medium tabular-nums bg-[#fafafa] dark:bg-[#121212] text-[#171717] dark:text-[#ededed] border border-[#ededed] dark:border-[#27272a]">
                            {car.year}
                          </span>
                        )}
                        {diffPct !== null && (
                          <span
                            className={`inline-flex items-center gap-1 h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-medium tabular-nums border ${
                              isBelow
                                ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isBelow ? (
                              <TrendingDown className="w-3 h-3" aria-hidden="true" />
                            ) : (
                              <TrendingUp className="w-3 h-3" aria-hidden="true" />
                            )}
                            {formatPct(diffPct)} FIPE
                          </span>
                        )}
                        {car.isTurbo && (
                          <span className="inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            Turbo
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-[#171717] dark:text-[#ededed] line-clamp-2">
                        {car.title}
                      </h3>

                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-lg font-bold text-[#171717] dark:text-[#ededed] tabular-nums">
                          {formatBRL(car.price)}
                        </span>
                        {car.fipeReferenceValue && (
                          <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                            FIPE {formatBRL(car.fipeReferenceValue)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#707070] dark:text-[#a1a1aa]">
                        {car.mileageKm !== null && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Gauge className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                            {car.mileageKm.toLocaleString('pt-BR')} km
                          </span>
                        )}
                        {car.transmission && (
                          <span className="inline-flex items-center gap-1">
                            <Settings2 className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                            {car.transmission}
                          </span>
                        )}
                        {car.fuel && (
                          <span className="inline-flex items-center gap-1">
                            <Fuel className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                            {car.fuel}
                          </span>
                        )}
                      </div>

                      <p className="inline-flex items-center gap-1 text-[11px] text-[#9a9a9a] dark:text-[#71717a] truncate">
                        <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span>
                          {[car.neighborhood, car.city, car.state].filter(Boolean).join(', ') || 'Joinville, SC'}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#ededed] dark:border-[#27272a]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={car.favorite ? 'Remover dos favoritos' : 'Favoritar anúncio'}
                          aria-pressed={car.favorite}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleFavorite(car);
                          }}
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-[6px] border cursor-pointer ${
                            car.favorite
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                              : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a] hover:border-rose-500/40'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${car.favorite ? 'fill-current' : ''}`} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={car.hidden ? 'Restaurar anúncio' : 'Ocultar anúncio'}
                          aria-pressed={car.hidden}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleHidden(car);
                          }}
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-[6px] border cursor-pointer ${
                            car.hidden
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                              : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a] hover:border-amber-500/40'
                          }`}
                        >
                          <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <a
                        href={car.ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 inline-flex items-center gap-1 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] hover:border-[#3ecf8e]/60 text-xs font-medium text-[#171717] dark:text-[#ededed]"
                      >
                        <span>Ver anúncio</span>
                        <ExternalLink className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <CarListingModal
        car={selectedCar}
        onClose={() => setSelectedCar(null)}
        onToggleFavorite={handleToggleFavorite}
        onToggleHidden={handleToggleHidden}
        onSaveNotes={handleSaveNotes}
      />
    </div>
  );
}
