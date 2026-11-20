import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Car,
  ChevronLeft,
  ChevronRight,
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
import {
  applyCarImageFallback,
  createPocketBaseClient,
  fetchCarFacetsAndStats,
  fetchPagedCarListings,
  loadLocalCarPrefs,
  updateCarCuration,
  type CarFacetsAndStats,
  type CarListingItem,
  type SortMode,
  type VisibilityMode,
} from '../../services/pocketbase';
import CustomDropdown from '../ui/custom-dropdown';
import { CarListingModal } from './CarListingModal';

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

const ITEMS_PER_PAGE = 24;

const DEFAULT_FUEL_OPTIONS = ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'Híbrido', 'Elétrico'];

const MOTORIZACAO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'turbo', label: 'Turbo' },
  { value: 'aspirado', label: 'Aspirado' },
];

const CAMBIO_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'automatico', label: 'Automático' },
  { value: 'manual', label: 'Manual' },
  { value: 'CVT', label: 'CVT' },
];

const LITRAGEM_OPTIONS = [
  { value: 'todos', label: 'Todas' },
  { value: '1.0', label: '1.0' },
  { value: '1.3', label: '1.3' },
  { value: '1.4', label: '1.4' },
  { value: '1.5', label: '1.5' },
  { value: '1.6', label: '1.6' },
  { value: '1.8', label: '1.8' },
  { value: '2.0', label: '2.0' },
  { value: '2.0+', label: '2.0+' },
];

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

function countLocalFavorites(): number {
  const prefs = loadLocalCarPrefs();
  return Object.values(prefs).filter((p) => p.favorite && !p.hidden).length;
}

function mapIntentCambio(transmission?: string): string {
  if (!transmission) return 'todos';
  const low = transmission.toLowerCase();
  if (low.includes('cvt')) return 'CVT';
  if (low.includes('autom')) return 'automatico';
  if (low.includes('manual')) return 'manual';
  return 'todos';
}

export interface JoinvilleCarsViewProps {
  initialSearch?: FipeListingSearchIntent | null;
}

export default function JoinvilleCarsView({ initialSearch }: JoinvilleCarsViewProps) {
  const searchInputId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const minYearId = useId();
  const maxYearId = useId();
  const maxKmId = useId();
  const neighborhoodId = useId();

  const pb = useMemo(() => createPocketBaseClient(), []);
  const resultsTopRef = useRef<HTMLDivElement>(null);
  const requestSeqRef = useRef(0);

  const [carros, setCarros] = useState<CarListingItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<CarListingItem | null>(null);
  const [favCount, setFavCount] = useState<number>(() => countLocalFavorites());

  const [facets, setFacets] = useState<CarFacetsAndStats>({
    totalActive: 0,
    belowFipeCount: 0,
    avgPrice: 0,
    cities: ['Joinville'],
    brands: [],
    fuels: [],
  });

  const [search, setSearch] = useState(() => initialSearch?.term ?? '');
  const [cityFilter, setCityFilter] = useState('Joinville');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [motorizacaoFilter, setMotorizacaoFilter] = useState('todos');
  const [cambioFilter, setCambioFilter] = useState('todos');
  const [litragemFilter, setLitragemFilter] = useState('todos');
  const [combustivelFilter, setCombustivelFilter] = useState('todos');
  const [portalFilter, setPortalFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [maxKm, setMaxKm] = useState('');

  const [debouncedText, setDebouncedText] = useState(() => ({
    search: initialSearch?.term ?? '',
    neighborhood: '',
    minPrice: '',
    maxPrice: '',
    minYear: '',
    maxYear: '',
    maxKm: '',
  }));

  const [onlyBelowFipe, setOnlyBelowFipe] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('active');
  const [sortBy, setSortBy] = useState<SortMode>(() => (initialSearch ? 'relevance' : 'newest'));
  const [showFilters, setShowFilters] = useState(true);
  const [fipeContext, setFipeContext] = useState<FipeListingSearchIntent | null>(() => initialSearch ?? null);
  const [exactYearOnly, setExactYearOnly] = useState(false);
  const [exactFipeOnly, setExactFipeOnly] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!initialSearch) return;
    setSearch(initialSearch.term);
    setBrandFilter('');
    setMotorizacaoFilter('todos');
    setCambioFilter('todos');
    setLitragemFilter('todos');
    setCombustivelFilter('todos');
    setMinYear('');
    setMaxYear('');
    setExactYearOnly(false);
    setExactFipeOnly(false);
    setFipeContext(initialSearch);
    setVisibilityMode('active');
    setSortBy('relevance');
    setPage(1);
    setDebouncedText((cur) => ({
      ...cur,
      search: initialSearch.term,
      minYear: '',
      maxYear: '',
    }));
  }, [initialSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedText((prev) => {
        if (
          prev.search === search &&
          prev.neighborhood === neighborhoodFilter &&
          prev.minPrice === minPrice &&
          prev.maxPrice === maxPrice &&
          prev.minYear === minYear &&
          prev.maxYear === maxYear &&
          prev.maxKm === maxKm
        ) {
          return prev;
        }
        setPage(1);
        return {
          search,
          neighborhood: neighborhoodFilter,
          minPrice,
          maxPrice,
          minYear,
          maxYear,
          maxKm,
        };
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, neighborhoodFilter, minPrice, maxPrice, minYear, maxYear, maxKm]);

  useEffect(() => {
    let active = true;
    fetchCarFacetsAndStats(pb, cityFilter)
      .then((res) => {
        if (active) setFacets(res);
      })
      .catch(() => {
        // Non-blocking
      });
    return () => {
      active = false;
    };
  }, [pb, cityFilter, refreshTick]);

  useEffect(() => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setLoadError(null);

    fetchPagedCarListings(pb, {
      page,
      perPage: ITEMS_PER_PAGE,
      search: debouncedText.search,
      city: cityFilter,
      neighborhood: debouncedText.neighborhood,
      portal: portalFilter,
      brand: brandFilter,
      motorizacao: motorizacaoFilter,
      cambio: cambioFilter,
      litragem: litragemFilter,
      combustivel: combustivelFilter,
      sellerType: sellerFilter,
      minPrice: debouncedText.minPrice,
      maxPrice: debouncedText.maxPrice,
      minYear: debouncedText.minYear,
      maxYear: debouncedText.maxYear,
      maxKm: debouncedText.maxKm,
      onlyBelowFipe,
      exactYear: exactYearOnly ? fipeContext?.year : undefined,
      exactFipeCode: exactFipeOnly ? fipeContext?.codigoFipe : undefined,
      visibilityMode,
      sortBy,
    })
      .then((res) => {
        if (requestSeqRef.current !== seq) return;
        setCarros(res.items);
        setTotalItems(res.totalItems);
        setTotalPages(res.totalPages);
        if (res.page !== page && page > res.totalPages) {
          setPage(res.totalPages);
        }
        setSelectedCar((cur) =>
          cur ? res.items.find((c) => c.id === cur.id) ?? cur : null,
        );
      })
      .catch(() => {
        if (requestSeqRef.current !== seq) return;
        setLoadError('Não foi possível carregar os anúncios no momento. Tente novamente em instantes.');
        setCarros([]);
        setTotalItems(0);
        setTotalPages(1);
      })
      .finally(() => {
        if (requestSeqRef.current === seq) {
          setLoading(false);
        }
      });
  }, [
    pb,
    page,
    debouncedText,
    cityFilter,
    portalFilter,
    brandFilter,
    motorizacaoFilter,
    cambioFilter,
    litragemFilter,
    combustivelFilter,
    sellerFilter,
    onlyBelowFipe,
    exactYearOnly,
    exactFipeOnly,
    fipeContext,
    visibilityMode,
    sortBy,
    refreshTick,
  ]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      cityFilter !== 'Joinville' ||
      neighborhoodFilter.trim() ||
      portalFilter ||
      brandFilter ||
      motorizacaoFilter !== 'todos' ||
      cambioFilter !== 'todos' ||
      litragemFilter !== 'todos' ||
      combustivelFilter !== 'todos' ||
      sellerFilter ||
      minPrice ||
      maxPrice ||
      minYear ||
      maxYear ||
      maxKm ||
      onlyBelowFipe ||
      exactYearOnly ||
      exactFipeOnly ||
      fipeContext ||
      visibilityMode !== 'active',
  );

  const activeFilterCount = [
    cityFilter !== 'Joinville' ? cityFilter : '',
    brandFilter,
    minPrice || maxPrice,
    minYear || maxYear,
    motorizacaoFilter !== 'todos' ? motorizacaoFilter : '',
    cambioFilter !== 'todos' ? cambioFilter : '',
    litragemFilter !== 'todos' ? litragemFilter : '',
    combustivelFilter !== 'todos' ? combustivelFilter : '',
    portalFilter,
    sellerFilter,
    maxKm,
    neighborhoodFilter.trim(),
  ].filter(Boolean).length;

  const fuelOptions = useMemo(() => {
    const merged = new Set<string>(DEFAULT_FUEL_OPTIONS);
    for (const f of facets.fuels) {
      if (f) merged.add(f);
    }
    return [
      { value: 'todos', label: 'Todos' },
      ...[...merged].map((f) => ({ value: f, label: f })),
    ];
  }, [facets.fuels]);

  const cityOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas as cidades' },
      ...facets.cities.map((c) => ({ value: c, label: c })),
    ],
    [facets.cities],
  );

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((cur) => (cur === msg ? null : cur));
    }, 3000);
  }, []);

  async function handleToggleFavorite(car: CarListingItem) {
    const nextFav = !car.favorite;
    await updateCarCuration(pb, car, { favorite: nextFav });
    setFavCount(countLocalFavorites());
    setCarros((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, favorite: nextFav } : c)),
    );
    setSelectedCar((cur) =>
      cur?.id === car.id ? { ...cur, favorite: nextFav } : cur,
    );
    if (visibilityMode === 'favorites' && !nextFav) {
      setRefreshTick((t) => t + 1);
    }
    showNotice(nextFav ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
  }

  async function handleToggleHidden(car: CarListingItem) {
    const nextHidden = !car.hidden;
    await updateCarCuration(pb, car, { hidden: nextHidden });
    setFavCount(countLocalFavorites());
    setCarros((prev) =>
      prev.map((c) => (c.id === car.id ? { ...c, hidden: nextHidden } : c)),
    );
    setSelectedCar((cur) =>
      cur?.id === car.id ? { ...cur, hidden: nextHidden } : cur,
    );
    if (visibilityMode !== 'all') {
      setRefreshTick((t) => t + 1);
    }
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
    setCityFilter('Joinville');
    setNeighborhoodFilter('');
    setPortalFilter('');
    setBrandFilter('');
    setMotorizacaoFilter('todos');
    setCambioFilter('todos');
    setLitragemFilter('todos');
    setCombustivelFilter('todos');
    setSellerFilter('');
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxYear('');
    setMaxKm('');
    setOnlyBelowFipe(false);
    setExactYearOnly(false);
    setExactFipeOnly(false);
    setFipeContext(null);
    setVisibilityMode('active');
    setSortBy('newest');
    setPage(1);
    setDebouncedText({
      search: '',
      neighborhood: '',
      minPrice: '',
      maxPrice: '',
      minYear: '',
      maxYear: '',
      maxKm: '',
    });
  }

  function goToPage(nextPage: number) {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    setPage(clamped);
    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const cityLocationLabel =
    cityFilter === 'todas'
      ? 'Todas as cidades (SC)'
      : cityFilter === 'Joinville'
        ? 'Joinville & Região'
        : `${cityFilter}, SC`;

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = totalItems === 0 ? 0 : Math.min(page * ITEMS_PER_PAGE, totalItems);
  const fipeIntentCambio = mapIntentCambio(fipeContext?.transmission);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* KNOLLING HEADER TRAY */}
      <section className="knolling-card knolling-enter p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#E6E6FA] text-[#2D2D2D] border border-[#2D2D2D]/15 text-xs font-mono font-medium">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>FIG. 02 // {cityLocationLabel.toUpperCase()}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3]">
              Anúncios Reais vs. Tabela FIPE
            </h1>
            <p className="text-sm sm:text-base text-[#2D2D2D]/75 dark:text-[#F5F2F3]/78 max-w-[68ch] leading-[1.6]">
              Compare preços anunciados na região com a referência atualizada da Tabela FIPE e identifique oportunidades abaixo do valor de tabela.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
            className="h-9 self-start inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-[#2D2D2D]/15 bg-[#CBE4F0] hover:bg-[#b5d7e8] text-xs font-semibold text-[#2D2D2D] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200 active:-translate-y-[1px] cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>

        {/* 4 Knolling Pastel KPI Compartments */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 tabular-nums">
          <div className="rounded-xl bg-[#CBE4F0]/55 text-[#2D2D2D] border border-[#2D2D2D]/15 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
              Anúncios Ativos
            </span>
            <strong className="block text-lg sm:text-xl font-bold mt-0.5">
              {facets.totalActive.toLocaleString('pt-BR')}
            </strong>
          </div>

          <div className="rounded-xl bg-[#D0F0C0]/65 text-[#2D2D2D] border border-[#2D2D2D]/15 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
              Abaixo da FIPE
            </span>
            <strong className="block text-lg sm:text-xl font-bold mt-0.5">
              {facets.belowFipeCount.toLocaleString('pt-BR')}
            </strong>
          </div>

          <div className="rounded-xl bg-[#E6E6FA]/70 text-[#2D2D2D] border border-[#2D2D2D]/15 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
              Preço Médio
            </span>
            <strong className="block text-lg sm:text-xl font-bold mt-0.5">
              {facets.avgPrice > 0 ? formatBRL(facets.avgPrice) : '—'}
            </strong>
          </div>

          <div className="rounded-xl bg-[#F6D0D6]/65 text-[#2D2D2D] border border-[#2D2D2D]/15 p-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-75">
              Favoritos
            </span>
            <strong className="block text-lg sm:text-xl font-bold mt-0.5">
              {favCount.toLocaleString('pt-BR')}
            </strong>
          </div>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="relative z-[500] rounded-xl border border-[#2D2D2D]/20 bg-[#D0F0C0] px-4 py-2.5 text-xs font-semibold text-[#2D2D2D] shadow-[0_6px_18px_rgba(45,45,45,0.12)]"
        >
          {notice}
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-[#2D2D2D]/20 bg-[#F6D0D6] p-4 text-xs font-medium text-[#2D2D2D]"
        >
          {loadError}
        </div>
      )}

      <div className="space-y-6">
        {/* Filter Console */}
        <section
          aria-label="Filtros de busca"
          className="knolling-card p-4 sm:p-5 space-y-4 overflow-visible"
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <label htmlFor={searchInputId} className="sr-only">
                Buscar por marca, modelo, versão, código FIPE ou bairro
              </label>
              <input
                id={searchInputId}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar modelo, versão, código FIPE ou bairro..."
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FAF6F7] dark:bg-[#242226] text-xs text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 dark:placeholder:text-[#F5F2F3]/45 focus:outline-none focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-2"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label="Visibilidade dos anúncios"
                className="inline-flex items-center h-9 p-1 rounded-xl border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FAF6F7] dark:bg-[#242226]"
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
                      onClick={() => {
                        setVisibilityMode(mode);
                        setPage(1);
                      }}
                      className={`h-7 inline-flex items-center justify-center px-2.5 rounded-[8px] text-xs transition-colors cursor-pointer ${
                        pressed
                          ? 'bg-[#CBE4F0] text-[#2D2D2D] font-semibold'
                          : 'text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 hover:text-[#2D2D2D]'
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
                onClick={() => {
                  setOnlyBelowFipe((v) => !v);
                  setPage(1);
                }}
                className={`h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  onlyBelowFipe
                    ? 'bg-[#D0F0C0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                    : 'bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 hover:bg-[#D0F0C0]/45'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Abaixo da FIPE</span>
              </button>

              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
                className={`h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  showFilters
                    ? 'border-[#2D2D2D]/25 bg-[#CBE4F0] text-[#2D2D2D] font-semibold'
                    : 'border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Filtros</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-[#2D2D2D] text-[#FFFDFB] text-[10px] font-bold tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Limpar todos os filtros"
                  className="h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FAF6F7] dark:bg-[#242226] text-xs font-medium text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 hover:bg-[#F6D0D6]/55 hover:text-[#2D2D2D] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12">
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Cidade
                </span>
                <CustomDropdown
                  value={cityFilter}
                  onChange={(val) => {
                    setCityFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Joinville"
                  searchable
                  searchPlaceholder="Filtrar cidade..."
                  className="w-full"
                  menuClassName="w-full min-w-[180px]"
                  isActive={cityFilter !== 'Joinville'}
                  options={cityOptions}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Marca
                </span>
                <CustomDropdown
                  value={brandFilter}
                  onChange={(val) => {
                    setBrandFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Todas as marcas"
                  searchable
                  searchPlaceholder="Filtrar marca..."
                  className="w-full"
                  menuClassName="w-full min-w-[180px]"
                  isActive={Boolean(brandFilter)}
                  options={[
                    { value: '', label: 'Todas as marcas' },
                    ...facets.brands.map((b) => ({ value: b, label: b })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Faixa de preço (R$)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label htmlFor={minPriceId} className="sr-only">Preço mínimo em R$</label>
                    <input
                      id={minPriceId}
                      type="number"
                      min={0}
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Mín."
                      className="w-full h-8 px-2.5 rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] text-xs tabular-nums text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 focus:outline-none focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-1"
                    />
                  </div>
                  <div>
                    <label htmlFor={maxPriceId} className="sr-only">Preço máximo em R$</label>
                    <input
                      id={maxPriceId}
                      type="number"
                      min={0}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Máx."
                      className="w-full h-8 px-2.5 rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] text-xs tabular-nums text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 focus:outline-none focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Ano
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label htmlFor={minYearId} className="sr-only">Ano mínimo</label>
                    <input
                      id={minYearId}
                      type="number"
                      min={1980}
                      max={2030}
                      value={minYear}
                      onChange={(e) => setMinYear(e.target.value)}
                      placeholder="Mín."
                      className="w-full h-8 px-2.5 rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] text-xs tabular-nums text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 focus:outline-none focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-1"
                    />
                  </div>
                  <div>
                    <label htmlFor={maxYearId} className="sr-only">Ano máximo</label>
                    <input
                      id={maxYearId}
                      type="number"
                      min={1980}
                      max={2030}
                      value={maxYear}
                      onChange={(e) => setMaxYear(e.target.value)}
                      placeholder="Máx."
                      className="w-full h-8 px-2.5 rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] text-xs tabular-nums text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 focus:outline-none focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Motorização
                </span>
                <CustomDropdown
                  value={motorizacaoFilter}
                  onChange={(val) => {
                    setMotorizacaoFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Todos"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={motorizacaoFilter !== 'todos'}
                  options={MOTORIZACAO_OPTIONS}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Câmbio
                </span>
                <CustomDropdown
                  value={cambioFilter}
                  onChange={(val) => {
                    setCambioFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Todos"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={cambioFilter !== 'todos'}
                  options={CAMBIO_OPTIONS}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Litragem
                </span>
                <CustomDropdown
                  value={litragemFilter}
                  onChange={(val) => {
                    setLitragemFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Todas"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={litragemFilter !== 'todos'}
                  options={LITRAGEM_OPTIONS}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Combustível
                </span>
                <CustomDropdown
                  value={combustivelFilter}
                  onChange={(val) => {
                    setCombustivelFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Todos"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={combustivelFilter !== 'todos'}
                  options={fuelOptions}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Portal
                </span>
                <CustomDropdown
                  value={portalFilter}
                  onChange={(val) => {
                    setPortalFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Todos os portais"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={Boolean(portalFilter)}
                  options={[
                    { value: '', label: 'Todos os portais' },
                    { value: 'OLX Carros', label: 'OLX Carros' },
                    { value: 'Webmotors', label: 'Webmotors' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Anunciante
                </span>
                <CustomDropdown
                  value={sellerFilter}
                  onChange={(val) => {
                    setSellerFilter(String(val));
                    setPage(1);
                  }}
                  placeholder="Loja e Particular"
                  className="w-full"
                  menuClassName="w-full min-w-[160px]"
                  isActive={Boolean(sellerFilter)}
                  options={[
                    { value: '', label: 'Loja e Particular' },
                    { value: 'Loja', label: 'Loja' },
                    { value: 'Particular', label: 'Particular' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={maxKmId}
                  className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider"
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
                  className="w-full h-8 px-2.5 rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] text-xs tabular-nums text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 focus:outline-none focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-1"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={neighborhoodId}
                  className="block text-[11px] font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider"
                >
                  Bairro
                </label>
                <input
                  id={neighborhoodId}
                  type="text"
                  value={neighborhoodFilter}
                  onChange={(e) => setNeighborhoodFilter(e.target.value)}
                  placeholder="Ex.: América, Centro..."
                  className="w-full h-8 px-2.5 rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] text-xs text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 focus:outline-none focus:ring-2 focus:ring-[#CBE4F0] focus:ring-offset-1"
                />
              </div>
            </div>
          )}

          {fipeContext && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70">
                  Referência FIPE:
                </span>
                <span className="font-bold text-[#2D2D2D] dark:text-[#F5F2F3]">
                  {fipeContext.fipeLabel}
                </span>
                {fipeContext.codigoFipe && (
                  <button
                    type="button"
                    aria-pressed={exactFipeOnly}
                    onClick={() => {
                      setExactFipeOnly((v) => !v);
                      setPage(1);
                    }}
                    className={`h-6 inline-flex items-center px-2 rounded-[8px] font-mono text-[11px] border cursor-pointer ${
                      exactFipeOnly
                        ? 'bg-[#E6E6FA] text-[#2D2D2D] border-[#2D2D2D]/30 font-semibold'
                        : 'bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15'
                    }`}
                  >
                    FIPE {fipeContext.codigoFipe}
                  </button>
                )}
                {fipeContext.year && (
                  <button
                    type="button"
                    aria-pressed={exactYearOnly}
                    onClick={() => {
                      setExactYearOnly((v) => !v);
                      setPage(1);
                    }}
                    className={`h-6 inline-flex items-center px-2 rounded-[8px] text-[11px] tabular-nums border cursor-pointer ${
                      exactYearOnly
                        ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/30 font-semibold'
                        : 'bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15'
                    }`}
                  >
                    Ano {fipeContext.year}
                  </button>
                )}
                {fipeContext.transmission && fipeIntentCambio !== 'todos' && (
                  <button
                    type="button"
                    aria-pressed={cambioFilter === fipeIntentCambio}
                    onClick={() => {
                      setCambioFilter((cur) => (cur === fipeIntentCambio ? 'todos' : fipeIntentCambio));
                      setPage(1);
                    }}
                    className={`h-6 inline-flex items-center px-2 rounded-[8px] text-[11px] border cursor-pointer ${
                      cambioFilter === fipeIntentCambio
                        ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/30 font-semibold'
                        : 'bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15'
                    }`}
                  >
                    {fipeContext.transmission}
                  </button>
                )}
                {fipeContext.fuel && (
                  <button
                    type="button"
                    aria-pressed={combustivelFilter === fipeContext.fuel}
                    onClick={() => {
                      setCombustivelFilter((cur) =>
                        cur === fipeContext.fuel ? 'todos' : fipeContext.fuel!,
                      );
                      setPage(1);
                    }}
                    className={`h-6 inline-flex items-center px-2 rounded-[8px] text-[11px] border cursor-pointer ${
                      combustivelFilter === fipeContext.fuel
                        ? 'bg-[#D0F0C0] text-[#2D2D2D] border-[#2D2D2D]/30 font-semibold'
                        : 'bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15'
                    }`}
                  >
                    {fipeContext.fuel}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 hover:text-[#2D2D2D] underline underline-offset-2 cursor-pointer"
              >
                Limpar referência
              </button>
            </div>
          )}
        </section>

        {/* Results count & Sort bar */}
        <div
          ref={resultsTopRef}
          className="knolling-card px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 scroll-mt-20"
        >
          <div className="text-xs text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75">
            <span className="tabular-nums">
              {totalItems === 0 ? (
                <>
                  Exibindo <strong className="text-[#2D2D2D] dark:text-[#F5F2F3]">0</strong> anúncios
                </>
              ) : (
                <>
                  Exibindo{' '}
                  <strong className="text-[#2D2D2D] dark:text-[#F5F2F3]">
                    {rangeStart.toLocaleString('pt-BR')}–{rangeEnd.toLocaleString('pt-BR')}
                  </strong>{' '}
                  de{' '}
                  <strong className="text-[#2D2D2D] dark:text-[#F5F2F3]">
                    {totalItems.toLocaleString('pt-BR')}
                  </strong>{' '}
                  {totalItems === 1 ? 'anúncio' : 'anúncios'}
                </>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 whitespace-nowrap">
              Ordenar por:
            </span>
            <CustomDropdown
              value={sortBy}
              onChange={(val) => {
                setSortBy(val as SortMode);
                setPage(1);
              }}
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

        {/* 2-Column Knolling Flat-Lay Cards Grid (No 3-equal-columns) */}
        {loading && carros.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="knolling-card p-4 space-y-3">
                <div className="knolling-shimmer aspect-[16/10] w-full rounded-[10px]" />
                <div className="knolling-shimmer h-5 w-2/3 rounded-xl" />
                <div className="knolling-shimmer h-14 w-full rounded-xl" />
                <div className="flex items-center justify-between pt-1">
                  <div className="knolling-shimmer h-8 w-20 rounded-xl" />
                  <div className="knolling-shimmer h-8 w-28 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : carros.length === 0 ? (
          <div className="knolling-card p-10 text-center space-y-2.5">
            <Car className="w-8 h-8 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 mx-auto" aria-hidden="true" />
            <p className="text-base font-bold text-[#2D2D2D] dark:text-[#F5F2F3]">
              Nenhum veículo encontrado para os filtros atuais
            </p>
            <p className="text-sm text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70">
              {cityFilter === 'Joinville'
                ? 'Tente limpar filtros ou trocar a cidade para "Todas as cidades".'
                : 'Tente limpar ou ajustar os filtros selecionados.'}
            </p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 ${loading ? 'opacity-70 transition-opacity' : ''}`}>
            {carros.map((car, idx) => {
              const firstImg = car.images[0];
              const thumb = firstImg?.thumbUrl;
              const diffPct = car.fipeDiffPct;
              const isBelow = diffPct !== null && diffPct <= 0;

              return (
                <article
                  key={car.id}
                  onClick={() => setSelectedCar(car)}
                  style={{ animationDelay: `${Math.min(idx, 6) * 60}ms` }}
                  className="group knolling-card knolling-enter hover:border-[#2D2D2D]/35 hover:-translate-y-[1px] p-3.5 sm:p-4 flex flex-col cursor-pointer"
                >
                  {/* Overhead Flat-Lay Framed Photo */}
                  <div className="relative aspect-[16/10] rounded-[10px] border border-[#2D2D2D]/12 bg-[#FAF6F7] dark:bg-[#242226] overflow-hidden flex items-center justify-center">
                    {thumb ? (
                      <img
                        key={thumb}
                        src={thumb}
                        alt={car.title}
                        loading="lazy"
                        onError={(e) => applyCarImageFallback(e.currentTarget, firstImg?.fallbackUrl)}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <Car className="w-10 h-10 text-[#2D2D2D]/35 dark:text-[#F5F2F3]/35" aria-hidden="true" />
                    )}

                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center h-6 px-2.5 rounded-[8px] text-[11px] leading-none font-semibold bg-[#2D2D2D]/85 text-[#FFFDFB] backdrop-blur-xs">
                        {car.portalName}
                      </span>
                      {car.sellerType && (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-[8px] text-[11px] leading-none font-semibold bg-[#FFFDFB]/95 text-[#2D2D2D] border border-[#2D2D2D]/15">
                          {car.sellerType}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2.5">
                      {/* Pastel Spec Tags */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {car.year && (
                          <span className="inline-flex items-center h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold tabular-nums bg-[#FFFDFB] text-[#2D2D2D] border border-[#2D2D2D]/15">
                            {car.year}
                          </span>
                        )}
                        {diffPct !== null && (
                          <span
                            className={`inline-flex items-center gap-1 h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold tabular-nums border border-[#2D2D2D]/15 text-[#2D2D2D] ${
                              isBelow ? 'bg-[#D0F0C0]' : 'bg-[#F6D0D6]'
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
                        {car.engineSize && (
                          <span className="inline-flex items-center h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold tabular-nums bg-[#E6E6FA] text-[#2D2D2D] border border-[#2D2D2D]/15">
                            {car.engineSize}
                          </span>
                        )}
                        {car.isTurbo && (
                          <span className="inline-flex items-center h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold bg-[#CBE4F0] text-[#2D2D2D] border border-[#2D2D2D]/15">
                            Turbo
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-[#2D2D2D] dark:text-[#F5F2F3] line-clamp-2 leading-snug">
                        {car.title}
                      </h3>

                      {/* Price vs FIPE Comparison Tray */}
                      <div className="bg-[#FAF6F7] dark:bg-[#242226] rounded-xl p-3 border border-[#2D2D2D]/10 dark:border-[#F5F2F3]/12 flex items-baseline justify-between gap-2">
                        <span className="text-lg sm:text-xl font-bold text-[#2D2D2D] dark:text-[#F5F2F3] tabular-nums">
                          {formatBRL(car.price)}
                        </span>
                        {car.fipeReferenceValue && (
                          <span className="text-xs font-medium text-[#2D2D2D]/70 dark:text-[#F5F2F3]/75 tabular-nums">
                            FIPE {formatBRL(car.fipeReferenceValue)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75">
                        {car.mileageKm !== null && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                            {car.mileageKm.toLocaleString('pt-BR')} km
                          </span>
                        )}
                        {car.transmission && (
                          <span className="inline-flex items-center gap-1">
                            <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
                            {car.transmission}
                          </span>
                        )}
                        {car.fuel && (
                          <span className="inline-flex items-center gap-1">
                            <Fuel className="w-3.5 h-3.5" aria-hidden="true" />
                            {car.fuel}
                          </span>
                        )}
                      </div>

                      <p className="inline-flex items-center gap-1 text-xs text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {[car.neighborhood, car.city, car.state].filter(Boolean).join(', ') || 'Joinville, SC'}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={car.favorite ? 'Remover dos favoritos' : 'Favoritar anúncio'}
                          aria-pressed={car.favorite}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleFavorite(car);
                          }}
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                            car.favorite
                              ? 'bg-[#F6D0D6] text-[#2D2D2D] border-[#2D2D2D]/30'
                              : 'bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 border-[#2D2D2D]/15 hover:bg-[#F6D0D6]/55'
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
                          className={`h-8 w-8 inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                            car.hidden
                              ? 'bg-[#E6E6FA] text-[#2D2D2D] border-[#2D2D2D]/30'
                              : 'bg-[#FAF6F7] dark:bg-[#242226] text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 border-[#2D2D2D]/15 hover:bg-[#E6E6FA]/65'
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
                        className="h-8 inline-flex items-center gap-1.5 px-3 rounded-xl border border-[#2D2D2D]/15 bg-[#CBE4F0] hover:bg-[#b5d7e8] text-xs font-semibold text-[#2D2D2D] transition-colors"
                      >
                        <span>Ver anúncio</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2.5 pt-4 pb-6">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
              className="h-8 inline-flex items-center gap-1 px-3 rounded-xl border-[1.5px] border-[#2D2D2D]/20 bg-[#FFFDFB] dark:bg-[#2D2D2D] text-xs font-semibold text-[#2D2D2D] dark:text-[#F5F2F3] hover:bg-[#F6D0D6]/40 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Anterior</span>
            </button>

            <span className="text-xs text-[#2D2D2D] dark:text-[#F5F2F3] bg-[#FFFDFB] dark:bg-[#2D2D2D] border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 rounded-xl px-3.5 h-8 inline-flex items-center font-semibold tabular-nums">
              Página {page.toLocaleString('pt-BR')} de {totalPages.toLocaleString('pt-BR')}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => goToPage(page + 1)}
              className="h-8 inline-flex items-center gap-1 px-3 rounded-xl border-[1.5px] border-[#2D2D2D]/20 bg-[#FFFDFB] dark:bg-[#2D2D2D] text-xs font-semibold text-[#2D2D2D] dark:text-[#F5F2F3] hover:bg-[#CBE4F0]/55 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <span>Próxima</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
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
