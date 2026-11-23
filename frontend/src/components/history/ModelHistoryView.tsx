import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  BellPlus,
  Car,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Gauge,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchHistoryFacets,
  fetchModelListingHistory,
  type GroupedAdHistory,
  type ModelHistoryFacets,
  type ModelHistoryQuery,
  type ModelHistoryResult,
} from '../../services/modelHistory';
import {
  CAMBIO_FILTER_OPTIONS,
  DEFAULT_REGIONAL_CITIES,
  isRequestAbortError,
  mapCarRecord,
  PB_CAR_COLLECTIONS,
  updateCarCuration,
  type CarListingItem,
} from '../../services/pocketbase';
import type { CarAlertInput } from '../../services/alerts';
import {
  formatBRL,
  formatDateShortBR,
  formatDateTimeBR,
  formatMileageKm,
  formatPct,
  formatSignedBRL,
} from '../../lib/formatters';
import CustomDropdown from '../ui/custom-dropdown';
import { CarListingModal } from '../joinville/CarListingModal';
import {
  buildModelHistoryUrlParams,
  parseModelHistoryUrlParams,
  parseSectionFromUrl,
  syncUrlSearchParams,
  type HistorySubTab,
  type ModelHistoryUrlState,
} from '../../lib/urlState';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  ScatterController,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export interface ModelHistoryIntent {
  search: string;
  brand?: string;
  year?: number;
  fipeCode?: string;
  nonce: number;
}

export interface ModelHistoryViewProps {
  initialIntent?: ModelHistoryIntent | null;
  onCreateAlert: (prefill: Partial<CarAlertInput>) => void;
}

type HistoryTab = HistorySubTab;
type SortKey = 'recordedAt' | 'price' | 'mileageKm' | 'fipeDiffPct' | 'year';

const FALLBACK_CHIPS: Array<{ query: string; label: string; count?: number }> = [
  { query: 'hb20 2021 diamond plus', label: 'HB20 2021 Diamond Plus' },
  { query: 'nivus highline', label: 'Nivus Highline' },
  { query: 'civic touring', label: 'Civic Touring' },
  { query: 'corolla', label: 'Corolla' },
  { query: 'argo', label: 'Fiat Argo' },
  { query: 'onix', label: 'Onix' },
];

const TRANSMISSION_OPTIONS = [
  { value: 'todos', label: 'Todos os câmbios' },
  ...CAMBIO_FILTER_OPTIONS.filter((opt) => opt.value !== 'todos'),
];

const FUEL_OPTIONS = [
  { value: 'todos', label: 'Todos combustíveis' },
  { value: 'Flex', label: 'Flex' },
  { value: 'Gasolina', label: 'Gasolina' },
  { value: 'Diesel', label: 'Diesel' },
  { value: 'Híbrido', label: 'Híbrido' },
  { value: 'Elétrico', label: 'Elétrico' },
];

const PORTAL_OPTIONS = [
  { value: '', label: 'Todos os portais' },
  { value: 'OLX Carros', label: 'OLX Carros' },
  { value: 'Webmotors', label: 'Webmotors' },
];

export default function ModelHistoryView({
  initialIntent,
  onCreateAlert,
}: ModelHistoryViewProps) {
  const { pb, user, curationMap, setCurationMap } = useAuth();
  const searchInputId = useId();
  const minYearId = useId();
  const maxYearId = useId();
  const minPriceId = useId();
  const maxPriceId = useId();
  const maxKmId = useId();
  const tableCaptionId = useId();

  const [initialUrl] = useState<ModelHistoryUrlState>(() => parseModelHistoryUrlParams());
  const lastAppliedNonceRef = React.useRef<number | null>(initialIntent?.nonce ?? null);

  const [search, setSearch] = useState(() => initialIntent?.search ?? initialUrl.search);
  const [brand, setBrand] = useState(() => initialIntent?.brand ?? initialUrl.brand);
  const [minYear, setMinYear] = useState(() =>
    initialIntent?.year ? String(initialIntent.year) : initialUrl.minYear,
  );
  const [maxYear, setMaxYear] = useState(() =>
    initialIntent?.year ? String(initialIntent.year) : initialUrl.maxYear,
  );
  const [minPrice, setMinPrice] = useState(() =>
    initialIntent ? '' : initialUrl.minPrice,
  );
  const [maxPrice, setMaxPrice] = useState(() =>
    initialIntent ? '' : initialUrl.maxPrice,
  );
  const [maxKm, setMaxKm] = useState(() =>
    initialIntent ? '' : initialUrl.maxKm,
  );
  const [cambio, setCambio] = useState(() =>
    initialIntent ? 'todos' : initialUrl.cambio,
  );
  const [fuel, setFuel] = useState(() =>
    initialIntent ? 'todos' : initialUrl.fuel,
  );
  const [portal, setPortal] = useState(() =>
    initialIntent ? '' : initialUrl.portal,
  );
  const [city, setCity] = useState(() =>
    initialIntent ? 'todas' : initialUrl.city,
  );
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>(() =>
    initialIntent ? 'all' : initialUrl.status,
  );
  const [fipeCode, setFipeCode] = useState(() =>
    initialIntent?.fipeCode ?? initialUrl.fipeCode,
  );
  const [showFilters, setShowFilters] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );

  const [activeQuery, setActiveQuery] = useState<ModelHistoryQuery>(() => ({
    search: initialIntent?.search ?? initialUrl.search,
    brand: initialIntent?.brand ?? initialUrl.brand,
    minYear: initialIntent?.year ? String(initialIntent.year) : initialUrl.minYear,
    maxYear: initialIntent?.year ? String(initialIntent.year) : initialUrl.maxYear,
    minPrice: initialIntent ? '' : initialUrl.minPrice,
    maxPrice: initialIntent ? '' : initialUrl.maxPrice,
    maxKm: initialIntent ? '' : initialUrl.maxKm,
    cambio: initialIntent ? 'todos' : initialUrl.cambio,
    fuel: initialIntent ? 'todos' : initialUrl.fuel,
    portal: initialIntent ? '' : initialUrl.portal,
    city: initialIntent ? 'todas' : initialUrl.city,
    fipeCode: initialIntent?.fipeCode ?? initialUrl.fipeCode,
    status: initialIntent ? 'all' : initialUrl.status,
  }));

  const [result, setResult] = useState<ModelHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<ModelHistoryFacets>({
    brands: [],
    cities: [...DEFAULT_REGIONAL_CITIES],
    modelChips: [],
  });
  const [activeTab, setActiveTab] = useState<HistoryTab>(() =>
    initialIntent ? 'ads' : initialUrl.activeTab,
  );
  const [expandedAdRefs, setExpandedAdRefs] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<SortKey>('recordedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedCar, setSelectedCar] = useState<CarListingItem | null>(null);

  const buildCurrentQuery = useCallback(
    (overrides?: Partial<ModelHistoryQuery>): ModelHistoryQuery => ({
      search,
      brand,
      minYear,
      maxYear,
      minPrice,
      maxPrice,
      maxKm,
      cambio,
      fuel,
      portal,
      city,
      fipeCode,
      status,
      ...overrides,
    }),
    [
      search,
      brand,
      minYear,
      maxYear,
      minPrice,
      maxPrice,
      maxKm,
      cambio,
      fuel,
      portal,
      city,
      fipeCode,
      status,
    ],
  );

  const commitQuery = useCallback(
    (overrides?: Partial<ModelHistoryQuery>) => {
      const next = buildCurrentQuery(overrides);
      const serialized = JSON.stringify(next);
      setActiveQuery((prev) => (JSON.stringify(prev) === serialized ? prev : next));
    },
    [buildCurrentQuery],
  );

  useEffect(() => {
    if (!initialIntent) return;
    if (lastAppliedNonceRef.current === initialIntent.nonce) return;
    lastAppliedNonceRef.current = initialIntent.nonce;
    const nextSearch = initialIntent.search;
    const nextBrand = initialIntent.brand ?? '';
    const yr = initialIntent.year ? String(initialIntent.year) : '';
    const nextFipe = initialIntent.fipeCode ?? '';

    setSearch(nextSearch);
    setBrand(nextBrand);
    setMinYear(yr);
    setMaxYear(yr);
    setMinPrice('');
    setMaxPrice('');
    setMaxKm('');
    setCambio('todos');
    setFuel('todos');
    setPortal('');
    setCity('todas');
    setStatus('all');
    setFipeCode(nextFipe);
    setActiveTab('ads');
    setActiveQuery({
      search: nextSearch,
      brand: nextBrand,
      minYear: yr,
      maxYear: yr,
      minPrice: '',
      maxPrice: '',
      maxKm: '',
      cambio: 'todos',
      fuel: 'todos',
      portal: '',
      city: 'todas',
      fipeCode: nextFipe,
      status: 'all',
    });
  }, [initialIntent]);

  useEffect(() => {
    if (parseSectionFromUrl() !== 'history') return;
    syncUrlSearchParams(
      buildModelHistoryUrlParams({
        search: activeQuery.search,
        brand: activeQuery.brand ?? '',
        minYear: activeQuery.minYear ?? '',
        maxYear: activeQuery.maxYear ?? '',
        minPrice: activeQuery.minPrice ?? '',
        maxPrice: activeQuery.maxPrice ?? '',
        maxKm: activeQuery.maxKm ?? '',
        cambio: activeQuery.cambio ?? 'todos',
        fuel: activeQuery.fuel ?? 'todos',
        portal: activeQuery.portal ?? '',
        city: activeQuery.city ?? 'todas',
        status: activeQuery.status ?? 'all',
        fipeCode: activeQuery.fipeCode ?? '',
        activeTab,
      }),
      'replace',
    );
  }, [activeQuery, activeTab]);

  useEffect(() => {
    const handlePop = () => {
      if (parseSectionFromUrl() !== 'history') return;
      const u = parseModelHistoryUrlParams();
      setSearch(u.search);
      setBrand(u.brand);
      setMinYear(u.minYear);
      setMaxYear(u.maxYear);
      setMinPrice(u.minPrice);
      setMaxPrice(u.maxPrice);
      setMaxKm(u.maxKm);
      setCambio(u.cambio);
      setFuel(u.fuel);
      setPortal(u.portal);
      setCity(u.city);
      setStatus(u.status);
      setFipeCode(u.fipeCode);
      setActiveTab(u.activeTab);
      setActiveQuery({
        search: u.search,
        brand: u.brand,
        minYear: u.minYear,
        maxYear: u.maxYear,
        minPrice: u.minPrice,
        maxPrice: u.maxPrice,
        maxKm: u.maxKm,
        cambio: u.cambio,
        fuel: u.fuel,
        portal: u.portal,
        city: u.city,
        fipeCode: u.fipeCode,
        status: u.status,
      });
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    fetchHistoryFacets(pb)
      .then((data) => setFacets(data))
      .catch(() => undefined);
  }, [pb]);

  const historyRequestSeqRef = React.useRef(0);

  const runSearch = useCallback(
    async (q: ModelHistoryQuery, signal?: AbortSignal) => {
      const seq = ++historyRequestSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchModelListingHistory(pb, q, signal);
        if (historyRequestSeqRef.current !== seq || signal?.aborted) return;
        setResult(res);
      } catch (err) {
        if (
          historyRequestSeqRef.current !== seq ||
          signal?.aborted ||
          isRequestAbortError(err)
        ) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível consultar o histórico de anúncios deste modelo.',
        );
      } finally {
        if (historyRequestSeqRef.current === seq && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [pb],
  );

  useEffect(() => {
    const controller = new AbortController();
    void runSearch(activeQuery, controller.signal);
    return () => {
      controller.abort();
    };
  }, [activeQuery, runSearch]);

  // Debounced auto-sync (~450ms) for open text & numeric inputs
  useEffect(() => {
    const next = buildCurrentQuery();
    const serializedNext = JSON.stringify(next);
    if (serializedNext === JSON.stringify(activeQuery)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveQuery((prev) =>
        JSON.stringify(prev) === serializedNext ? prev : next,
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeQuery, buildCurrentQuery]);

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    commitQuery();
  }

  function resetFilters() {
    setSearch('');
    setBrand('');
    setMinYear('');
    setMaxYear('');
    setMinPrice('');
    setMaxPrice('');
    setMaxKm('');
    setCambio('todos');
    setFuel('todos');
    setPortal('');
    setCity('todas');
    setStatus('all');
    setFipeCode('');
    setActiveQuery({
      search: '',
      brand: '',
      minYear: '',
      maxYear: '',
      minPrice: '',
      maxPrice: '',
      maxKm: '',
      cambio: 'todos',
      fuel: 'todos',
      portal: '',
      city: 'todas',
      fipeCode: '',
      status: 'all',
    });
  }

  function applyQuickChip(term: string) {
    const nextSearch =
      search.trim().toLowerCase() === term.trim().toLowerCase() ? '' : term;
    setSearch(nextSearch);
    setBrand('');
    setMinYear('');
    setMaxYear('');
    setFipeCode('');
    commitQuery({
      search: nextSearch,
      brand: '',
      minYear: '',
      maxYear: '',
      fipeCode: '',
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'price' || key === 'mileageKm' ? 'asc' : 'desc');
    }
  }

  async function handleInspectAd(ad: GroupedAdHistory) {
    if (!ad.carroId && !ad.ref) return;
    try {
      const rec = ad.carroId
        ? await pb
            .collection(PB_CAR_COLLECTIONS.CARROS)
            .getOne<Record<string, unknown>>(ad.carroId)
            .catch(() => null)
        : null;
      const fallbackRec =
        rec ??
        (await pb
          .collection(PB_CAR_COLLECTIONS.CARROS)
          .getFirstListItem<Record<string, unknown>>(
            pb.filter('ref = {:ref}', { ref: ad.ref }),
          )
          .catch(() => null));

      if (fallbackRec) {
        setSelectedCar(mapCarRecord(pb, fallbackRec, curationMap));
      } else {
        window.open(ad.ref, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(ad.ref, '_blank', 'noopener,noreferrer');
    }
  }

  const sortedTimeline = useMemo(() => {
    if (!result) return [];
    const items = [...result.timelineEvents];
    const factor = sortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (sortKey === 'recordedAt') {
        return (
          factor *
          (new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
        );
      }
      if (sortKey === 'price') return factor * (a.price - b.price);
      if (sortKey === 'mileageKm') {
        return factor * ((a.mileageKm ?? 9999999) - (b.mileageKm ?? 9999999));
      }
      if (sortKey === 'fipeDiffPct') {
        return factor * ((a.fipeDiffPct ?? 999) - (b.fipeDiffPct ?? 999));
      }
      return factor * ((a.year ?? 0) - (b.year ?? 0));
    });
    return items;
  }, [result, sortKey, sortDir]);

  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  const timeChartData = useMemo(() => {
    if (!result || result.timeSeries.length === 0) return null;
    const labels = result.timeSeries.map((b) => b.label);
    const hasMultipleRange = result.timeSeries.some((b) => b.minPrice !== b.maxPrice);

    return {
      labels,
      datasets: [
        {
          label: 'Preço médio anunciado',
          data: result.timeSeries.map((b) => b.avgPrice),
          borderColor: '#3ecf8e',
          backgroundColor: 'rgba(62, 207, 142, 0.14)',
          borderWidth: 2,
          tension: 0.25,
          fill: !hasMultipleRange,
          pointRadius: 3,
        },
        ...(hasMultipleRange
          ? [
              {
                label: 'Menor preço',
                data: result.timeSeries.map((b) => b.minPrice),
                borderColor: '#0ea5e9',
                borderDash: [4, 4],
                borderWidth: 1.5,
                tension: 0.25,
                pointRadius: 2,
              },
              {
                label: 'Maior preço',
                data: result.timeSeries.map((b) => b.maxPrice),
                borderColor: '#f59e0b',
                borderDash: [4, 4],
                borderWidth: 1.5,
                tension: 0.25,
                pointRadius: 2,
              },
            ]
          : []),
        ...(result.timeSeries.some((b) => b.avgFipePrice)
          ? [
              {
                label: 'Referência FIPE',
                data: result.timeSeries.map((b) => b.avgFipePrice),
                borderColor: isDark ? '#a1a1aa' : '#52525b',
                borderDash: [6, 3],
                borderWidth: 1.5,
                tension: 0.1,
                pointRadius: 0,
              },
            ]
          : []),
      ],
    };
  }, [result, isDark]);

  const scatterChartData = useMemo(() => {
    if (!result || result.scatterPoints.length === 0) return null;
    const below = result.scatterPoints.filter(
      (p) => p.fipeDiffPct !== null && p.fipeDiffPct <= 0,
    );
    const aboveOrUnmatched = result.scatterPoints.filter(
      (p) => p.fipeDiffPct === null || p.fipeDiffPct > 0,
    );

    return {
      datasets: [
        ...(below.length > 0
          ? [
              {
                label: 'Abaixo/na FIPE',
                data: below.map((p) => ({ x: p.mileageKm, y: p.price, meta: p })),
                backgroundColor: '#3ecf8e',
                borderColor: '#15803d',
                pointRadius: 5,
                pointHoverRadius: 7,
              },
            ]
          : []),
        ...(aboveOrUnmatched.length > 0
          ? [
              {
                label: 'Acima ou sem FIPE',
                data: aboveOrUnmatched.map((p) => ({
                  x: p.mileageKm,
                  y: p.price,
                  meta: p,
                })),
                backgroundColor: '#f59e0b',
                borderColor: '#b45309',
                pointRadius: 5,
                pointHoverRadius: 7,
              },
            ]
          : []),
      ],
    };
  }, [result]);

  const lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? '#a1a1aa' : '#52525b',
          font: { size: 11, family: "'Inter', sans-serif" },
          boxWidth: 12,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${formatBRL(Number(ctx.parsed.y))}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ticks: { color: isDark ? '#a1a1aa' : '#707070', font: { size: 10 } },
      },
      y: {
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ticks: {
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 10 },
          callback: (val) => `R$ ${Math.round(Number(val) / 1000)}k`,
        },
      },
    },
  };

  const scatterOptions: ChartOptions<'scatter'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: isDark ? '#a1a1aa' : '#52525b',
          font: { size: 11, family: "'Inter', sans-serif" },
          boxWidth: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = ctx.raw as {
              x: number;
              y: number;
              meta?: {
                title?: string;
                year?: number | null;
                fipeDiffPct?: number | null;
                portal?: string;
              };
            };
            const m = raw?.meta;
            const title = m?.title ? m.title.slice(0, 42) : 'Veículo';
            const fipeTag =
              m?.fipeDiffPct !== null && m?.fipeDiffPct !== undefined
                ? ` (${formatPct(m.fipeDiffPct)} FIPE)`
                : '';
            return `${title}: ${formatBRL(raw.y)} • ${raw.x.toLocaleString('pt-BR')} km${fipeTag}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Quilometragem (km)',
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 10 },
        },
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ticks: {
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 10 },
          callback: (val) => `${Math.round(Number(val) / 1000)}k km`,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Preço pedido (R$)',
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 10 },
        },
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ticks: {
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 10 },
          callback: (val) => `R$ ${Math.round(Number(val) / 1000)}k`,
        },
      },
    },
  };

  const brandOptions = useMemo(
    () => [
      { value: '', label: 'Todas as marcas' },
      ...facets.brands.map((b) => ({ value: b, label: b })),
    ],
    [facets.brands],
  );

  const cityOptions = useMemo(
    () => [
      { value: 'todas', label: 'Todas as cidades' },
      ...facets.cities.map((c) => ({ value: c, label: c })),
    ],
    [facets.cities],
  );

  const quickChips = facets.modelChips.length > 0 ? facets.modelChips : FALLBACK_CHIPS;
  const usingRealChips = facets.modelChips.length > 0;

  const activeAdvancedCount = [
    Boolean(brand),
    Boolean(minYear || maxYear),
    cambio !== 'todos',
    fuel !== 'todos',
    Boolean(portal),
    city !== 'todas',
    Boolean(minPrice || maxPrice),
    Boolean(maxKm),
    Boolean(fipeCode),
  ].filter(Boolean).length;

  const hasAnyFilter =
    Boolean(search.trim()) || status !== 'all' || activeAdvancedCount > 0;

  return (
    <div className="space-y-3.5 sm:space-y-5 min-w-0 w-full">
      {/* Page Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:gap-4 pb-1">
        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-[#15803d] dark:text-[#3ecf8e]">
            <History className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Histórico de Mercado por Modelo</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-[#ededed]">
            Histórico de Anúncios, Preços &amp; Quilometragem
          </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-[#707070] dark:text-[#a1a1aa] max-w-2xl">
            Investigue preços praticados, variações ao longo do tempo, quilometragem e diferença para a FIPE nos anúncios monitorados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {result && result.uniqueAdsCount > 0 && (
            <div className="hidden sm:flex items-center gap-3 px-3 h-8 rounded-[6px] border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] text-xs tabular-nums mr-1">
              <span className="text-[#707070] dark:text-[#a1a1aa]">
                Anúncios{' '}
                <strong className="font-semibold text-[#171717] dark:text-[#ededed]">
                  {result.uniqueAdsCount.toLocaleString('pt-BR')}
                </strong>
              </span>
              <span className="h-3 w-px bg-[#dfdfdf] dark:bg-[#27272a]" aria-hidden="true" />
              <span className="text-[#707070] dark:text-[#a1a1aa]">
                Média{' '}
                <strong className="font-semibold text-[#171717] dark:text-[#ededed]">
                  {formatBRL(result.priceStats.avg, '—')}
                </strong>
              </span>
              <span className="h-3 w-px bg-[#dfdfdf] dark:bg-[#27272a]" aria-hidden="true" />
              <span className="text-[#707070] dark:text-[#a1a1aa]">
                Reduções{' '}
                <strong className="font-semibold text-[#15803d] dark:text-[#3ecf8e]">
                  {result.adsWithPriceDropCount.toLocaleString('pt-BR')}
                </strong>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void runSearch(activeQuery)}
            disabled={loading}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] hover:border-[#3ecf8e]/50 text-xs font-medium text-[#171717] dark:text-[#ededed] transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#3ecf8e]' : ''}`}
              aria-hidden="true"
            />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onCreateAlert({
                name: search.trim()
                  ? `Alerta ${search.trim()}`
                  : brand.trim()
                    ? `Alerta ${brand.trim()}`
                    : 'Novo alerta de modelo',
                searchQuery: search.trim(),
                brand: brand.trim(),
                minYear: Number(minYear) || 0,
                maxYear: Number(maxYear) || 0,
                minPrice: Number(minPrice) || 0,
                maxPrice: Number(maxPrice) || 0,
                maxKm: Number(maxKm) || 0,
                transmission: cambio !== 'todos' ? cambio : '',
                fuel: fuel !== 'todos' ? fuel : '',
                portal,
                city: city !== 'todas' ? city : '',
                fipeCode,
                onlyBelowFipe: true,
              })
            }
            className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold transition-colors cursor-pointer"
          >
            <BellPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Criar alerta deste modelo</span>
          </button>
        </div>
      </header>

      {/* Filter Bar Card */}
      <section
        aria-label="Filtros do histórico de modelos"
        className="min-w-0 w-full rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] p-3 sm:p-4 space-y-2.5 sm:space-y-3.5"
      >
        {/* Top Toolbar */}
        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col lg:flex-row lg:items-center gap-2.5"
        >
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-3.5 h-3.5 text-[#707070] dark:text-[#a1a1aa] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor={searchInputId} className="sr-only">
              Buscar modelo, marca ou versão para analisar histórico
            </label>
            <input
              id={searchInputId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo, versão ou ano (ex.: fiat argo, corolla, hb20 2021)..."
              className="w-full h-8 pl-8 pr-8 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs text-[#171717] dark:text-[#ededed] placeholder:text-[#707070] dark:placeholder:text-[#71717a] focus:outline-none focus:border-[#3ecf8e] transition-colors"
            />
            {search.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  commitQuery({ search: '' });
                }}
                aria-label="Limpar busca de modelo"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#707070] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Segmented status selector */}
            <div
              role="group"
              aria-label="Status dos anúncios"
              className="h-8 inline-flex items-center p-0.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212]"
            >
              {(
                [
                  { value: 'all', label: 'Todos' },
                  { value: 'active', label: 'Ativos' },
                  { value: 'inactive', label: 'Encerrados' },
                ] as const
              ).map((opt) => {
                const isSelected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setStatus(opt.value);
                      commitQuery({ status: opt.value });
                    }}
                    className={`h-7 px-2.5 rounded-[4px] text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e]'
                        : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Expand/collapse detailed filters */}
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
              className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer ${
                showFilters || activeAdvancedCount > 0
                  ? 'border-[#3ecf8e]/50 bg-[#3ecf8e]/10 text-[#15803d] dark:text-[#3ecf8e]'
                  : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Filtros</span>
              {activeAdvancedCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#3ecf8e] text-[#171717] text-[10px] font-bold tabular-nums leading-none">
                  {activeAdvancedCount}
                </span>
              )}
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-8 inline-flex items-center gap-1 px-2.5 rounded-[6px] text-xs font-medium border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </form>

        {/* Symmetrical 4x2 Detailed Filter Grid (compact 2-col on mobile) */}
        {showFilters && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-2.5 sm:pt-3 border-t border-[#ededed] dark:border-[#27272a]">
            {/* 1. Marca */}
            <div className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Marca
              </span>
              <CustomDropdown
                value={brand}
                onChange={(val) => {
                  const next = String(val);
                  setBrand(next);
                  commitQuery({ brand: next });
                }}
                options={brandOptions}
                placeholder="Todas as marcas"
                searchable
                searchPlaceholder="Buscar marca..."
                isActive={Boolean(brand)}
                className="w-full"
                menuClassName="w-full min-w-[180px]"
              />
            </div>

            {/* 2. Câmbio */}
            <div className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Câmbio
              </span>
              <CustomDropdown
                value={cambio}
                onChange={(val) => {
                  const next = String(val);
                  setCambio(next);
                  commitQuery({ cambio: next });
                }}
                options={TRANSMISSION_OPTIONS}
                placeholder="Todos os câmbios"
                isActive={cambio !== 'todos'}
                className="w-full"
                menuClassName="w-full min-w-[170px]"
              />
            </div>

            {/* 3. Combustível */}
            <div className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Combustível
              </span>
              <CustomDropdown
                value={fuel}
                onChange={(val) => {
                  const next = String(val);
                  setFuel(next);
                  commitQuery({ fuel: next });
                }}
                options={FUEL_OPTIONS}
                placeholder="Todos combustíveis"
                isActive={fuel !== 'todos'}
                className="w-full"
                menuClassName="w-full min-w-[170px]"
              />
            </div>

            {/* 4. Portal */}
            <div className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Portal
              </span>
              <CustomDropdown
                value={portal}
                onChange={(val) => {
                  const next = String(val);
                  setPortal(next);
                  commitQuery({ portal: next });
                }}
                options={PORTAL_OPTIONS}
                placeholder="Todos os portais"
                isActive={Boolean(portal)}
                className="w-full"
                menuClassName="w-full min-w-[170px]"
              />
            </div>

            {/* 5. Cidade */}
            <div className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Cidade
              </span>
              <CustomDropdown
                value={city}
                onChange={(val) => {
                  const next = String(val);
                  setCity(next);
                  commitQuery({ city: next });
                }}
                options={cityOptions}
                placeholder="Todas as cidades"
                searchable={cityOptions.length > 6}
                searchPlaceholder="Buscar cidade..."
                isActive={city !== 'todas'}
                className="w-full"
                menuClassName="w-full min-w-[180px]"
              />
            </div>

            {/* 6. Km Máximo */}
            <div className="space-y-1">
              <label
                htmlFor={maxKmId}
                className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]"
              >
                Km Máximo
              </label>
              <div className="relative">
                <input
                  id={maxKmId}
                  type="number"
                  min={0}
                  step={5000}
                  value={maxKm}
                  onChange={(e) => setMaxKm(e.target.value)}
                  placeholder="Ex.: 80000"
                  className={`w-full h-8 pl-2.5 pr-8 rounded-[6px] border text-xs tabular-nums focus:outline-none transition-colors ${
                    maxKm
                      ? 'border-[#3ecf8e]/60 bg-[#3ecf8e]/5 text-[#171717] dark:text-[#ededed]'
                      : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed]'
                  } placeholder:text-[#707070] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e]`}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#707070] dark:text-[#a1a1aa]">
                  km
                </span>
              </div>
            </div>

            {/* 7. Faixa de Ano */}
            <div className="col-span-2 lg:col-span-1 space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Faixa de Ano
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label htmlFor={minYearId} className="sr-only">
                    Ano mínimo
                  </label>
                  <input
                    id={minYearId}
                    type="number"
                    min={1980}
                    max={2030}
                    value={minYear}
                    onChange={(e) => setMinYear(e.target.value)}
                    placeholder="Mín."
                    className={`w-full h-8 px-2.5 rounded-[6px] border text-xs tabular-nums focus:outline-none transition-colors ${
                      minYear
                        ? 'border-[#3ecf8e]/60 bg-[#3ecf8e]/5 text-[#171717] dark:text-[#ededed]'
                        : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed]'
                    } placeholder:text-[#707070] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e]`}
                  />
                </div>
                <div>
                  <label htmlFor={maxYearId} className="sr-only">
                    Ano máximo
                  </label>
                  <input
                    id={maxYearId}
                    type="number"
                    min={1980}
                    max={2030}
                    value={maxYear}
                    onChange={(e) => setMaxYear(e.target.value)}
                    placeholder="Máx."
                    className={`w-full h-8 px-2.5 rounded-[6px] border text-xs tabular-nums focus:outline-none transition-colors ${
                      maxYear
                        ? 'border-[#3ecf8e]/60 bg-[#3ecf8e]/5 text-[#171717] dark:text-[#ededed]'
                        : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed]'
                    } placeholder:text-[#707070] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e]`}
                  />
                </div>
              </div>
            </div>

            {/* 8. Faixa de Preço */}
            <div className="col-span-2 lg:col-span-1 space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Faixa de Preço (R$)
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label htmlFor={minPriceId} className="sr-only">
                    Preço mínimo em reais
                  </label>
                  <input
                    id={minPriceId}
                    type="number"
                    min={0}
                    step={1000}
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Mín."
                    className={`w-full h-8 px-2.5 rounded-[6px] border text-xs tabular-nums focus:outline-none transition-colors ${
                      minPrice
                        ? 'border-[#3ecf8e]/60 bg-[#3ecf8e]/5 text-[#171717] dark:text-[#ededed]'
                        : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed]'
                    } placeholder:text-[#707070] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e]`}
                  />
                </div>
                <div>
                  <label htmlFor={maxPriceId} className="sr-only">
                    Preço máximo em reais
                  </label>
                  <input
                    id={maxPriceId}
                    type="number"
                    min={0}
                    step={1000}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Máx."
                    className={`w-full h-8 px-2.5 rounded-[6px] border text-xs tabular-nums focus:outline-none transition-colors ${
                      maxPrice
                        ? 'border-[#3ecf8e]/60 bg-[#3ecf8e]/5 text-[#171717] dark:text-[#ededed]'
                        : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed]'
                    } placeholder:text-[#707070] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e]`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real Model Quick Chips + Optional FIPE tag (single scrollable row on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap no-scrollbar pb-0.5 pt-2.5 sm:pt-3 border-t border-[#ededed] dark:border-[#27272a]">
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] mr-0.5">
            <Sparkles className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
            {usingRealChips ? 'Modelos:' : 'Sugestões:'}
          </span>

          <button
            type="button"
            aria-pressed={!activeQuery.search.trim() && !activeQuery.fipeCode}
            onClick={() => {
              setSearch('');
              setFipeCode('');
              commitQuery({ search: '', fipeCode: '' });
            }}
            className={`shrink-0 h-6 px-2.5 rounded-[5px] border text-[11px] font-medium transition-colors cursor-pointer ${
              !activeQuery.search.trim() && !activeQuery.fipeCode
                ? 'border-[#3ecf8e]/50 bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e]'
                : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] hover:border-[#3ecf8e]/40'
            }`}
          >
            Todos
          </button>

          {quickChips.slice(0, 8).map((chip) => {
            const isChipActive =
              activeQuery.search.trim().toLowerCase() === chip.query.trim().toLowerCase();
            return (
              <button
                key={chip.query}
                type="button"
                aria-pressed={isChipActive}
                onClick={() => applyQuickChip(chip.query)}
                className={`shrink-0 h-6 inline-flex items-center gap-1.5 px-2.5 rounded-[5px] border text-[11px] font-medium transition-colors cursor-pointer ${
                  isChipActive
                    ? 'border-[#3ecf8e]/50 bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e]'
                    : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed] hover:border-[#3ecf8e]/40'
                }`}
              >
                <span>{chip.label}</span>
                {chip.count !== undefined && (
                  <span className="text-[10px] opacity-70 tabular-nums">
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}

          {fipeCode && (
            <button
              type="button"
              onClick={() => {
                setFipeCode('');
                commitQuery({ fipeCode: '' });
              }}
              className="h-6 inline-flex items-center gap-1 px-2 rounded-[5px] border border-[#3ecf8e]/50 bg-[#3ecf8e]/10 text-[#15803d] dark:text-[#3ecf8e] text-[11px] font-mono cursor-pointer ml-auto"
              title="Remover filtro por código FIPE"
            >
              <span>FIPE {fipeCode}</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {loading && !result ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 text-[#3ecf8e] animate-spin" />
          <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">
            Consultando anúncios e registros históricos no PocketBase...
          </p>
        </div>
      ) : result && result.uniqueAdsCount === 0 ? (
        <div className="rounded-xl border border-dashed border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa]/50 dark:bg-[#171717]/40 p-10 text-center space-y-3">
          <Car className="w-8 h-8 text-[#9a9a9a] mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
              Nenhum anúncio histórico encontrado para &ldquo;{activeQuery.search || 'os filtros selecionados'}&rdquo;
            </p>
            <p className="text-xs text-[#707070] dark:text-[#a1a1aa] max-w-md mx-auto">
              Limpe os filtros para visualizar todos os modelos observados ou crie um alerta para capturar esse veículo automaticamente nas próximas coletas.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] hover:border-[#3ecf8e]/50 text-xs font-medium text-[#171717] dark:text-[#ededed] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ver todos os modelos</span>
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onCreateAlert({
                  name: search.trim()
                    ? `Alerta ${search.trim()}`
                    : 'Novo alerta de modelo',
                  searchQuery: search.trim(),
                  brand: brand.trim(),
                  minYear: Number(minYear) || 0,
                  maxYear: Number(maxYear) || 0,
                  minPrice: Number(minPrice) || 0,
                  maxPrice: Number(maxPrice) || 0,
                  maxKm: Number(maxKm) || 0,
                  onlyBelowFipe: true,
                })
              }
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold cursor-pointer"
            >
              <BellPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Criar alerta para este termo</span>
            </button>
          </div>
        </div>
      ) : result ? (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-[#707070] dark:text-[#a1a1aa]">
                Anúncios Observados
              </span>
              <p className="text-2xl font-bold tabular-nums text-[#171717] dark:text-[#ededed]">
                {result.uniqueAdsCount.toLocaleString('pt-BR')}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                {result.activeAdsCount} ativos • {result.totalSnapshotsCount} registros
              </p>
            </div>

            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-[#707070] dark:text-[#a1a1aa]">
                Preço Médio / Mediano
              </span>
              <p className="text-2xl font-bold tabular-nums text-[#171717] dark:text-[#ededed]">
                {formatBRL(result.priceStats.avg, '—')}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                Mediana: {formatBRL(result.priceStats.median, '—')}
              </p>
            </div>

            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-[#707070] dark:text-[#a1a1aa]">
                Faixa Praticada (Mín–Máx)
              </span>
              <p className="text-lg font-bold tabular-nums text-[#171717] dark:text-[#ededed]">
                {formatBRL(result.priceStats.min, '—')} – {formatBRL(result.priceStats.max, '—')}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                25%–75%: {formatBRL(result.priceStats.p25, '—')} a {formatBRL(result.priceStats.p75, '—')}
              </p>
            </div>

            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-[#707070] dark:text-[#a1a1aa]">
                Quilometragem Praticada
              </span>
              <p className="text-2xl font-bold tabular-nums text-[#171717] dark:text-[#ededed]">
                {result.mileageStats.avg !== null
                  ? `${Math.round(result.mileageStats.avg).toLocaleString('pt-BR')} km`
                  : '—'}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                Mín: {formatMileageKm(result.mileageStats.min)} • Máx: {formatMileageKm(result.mileageStats.max)}
              </p>
            </div>

            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-medium text-[#707070] dark:text-[#a1a1aa]">
                Média vs. Tabela FIPE
              </span>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  result.avgFipeDiffPct !== null && result.avgFipeDiffPct <= 0
                    ? 'text-[#15803d] dark:text-[#3ecf8e]'
                    : 'text-[#171717] dark:text-[#ededed]'
                }`}
              >
                {result.avgFipeDiffPct !== null ? formatPct(result.avgFipeDiffPct) : '—'}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                {result.avgFipePrice ? `FIPE ${formatBRL(result.avgFipePrice)} • ` : ''}
                {result.belowFipeCount} abaixo • {result.adsWithPriceDropCount} c/ redução
              </p>
            </div>
          </div>

          {/* Charts: Price Evolution + Price x Mileage Scatter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
            <section className="min-w-0 overflow-hidden rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa] truncate">
                  Preços Praticados ao Longo do Tempo vs. FIPE
                </h2>
                <span className="shrink-0 text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                  {result.timeSeries.length} período(s)
                </span>
              </div>
              <div className="relative h-64 w-full min-w-0 overflow-hidden">
                {timeChartData ? (
                  <Line data={timeChartData} options={lineOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[#707070]">
                    Sem pontos temporais suficientes.
                  </div>
                )}
              </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa] truncate">
                  Dispersão Preço × Quilometragem
                </h2>
                <span className="shrink-0 text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                  {result.scatterPoints.length} veículo(s) com km
                </span>
              </div>
              <div className="relative h-64 w-full min-w-0 overflow-hidden">
                {scatterChartData ? (
                  <Scatter data={scatterChartData} options={scatterOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[#707070]">
                    Sem anúncios com quilometragem registrada neste filtro.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sub-tabs */}
          <div className="space-y-4 min-w-0">
            <div
              role="tablist"
              aria-label="Visualizações do histórico de anúncios"
              className="w-full max-w-full flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-[#ededed] dark:border-[#27272a]"
            >
              {(
                [
                  { id: 'ads', label: `Anúncios do modelo (${result.uniqueAdsCount})` },
                  { id: 'timeline', label: `Linha do tempo de registros (${result.totalSnapshotsCount})` },
                  { id: 'breakdown', label: 'Comparativo por portal, anunciante e ano' },
                ] as Array<{ id: HistoryTab; label: string }>
              ).map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative shrink-0 h-10 px-3.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'text-[#15803d] dark:text-[#3ecf8e] border-b-2 border-[#3ecf8e]'
                        : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'ads' && (
              <div className="space-y-3">
                {result.groupedAds.map((ad) => {
                  const isExpanded = Boolean(expandedAdRefs[ad.ref]);
                  const hasDelta = ad.priceChangeBrl !== 0;
                  const dropped = ad.priceChangeBrl < 0;
                  return (
                    <article
                      key={ad.ref}
                      className="min-w-0 rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                              {ad.portal}
                            </span>
                            {ad.sellerType && (
                              <span className="inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                                {ad.sellerType}
                              </span>
                            )}
                            {ad.year && (
                              <span className="inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium tabular-nums bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                                {ad.year}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium border ${
                                ad.listingStatus === 'active'
                                  ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                                  : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                              }`}
                            >
                              {ad.listingStatus === 'active' ? 'Ativo' : 'Encerrado/Inativo'}
                            </span>
                            {ad.fipeDiffPct !== null && (
                              <span
                                className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-[4px] text-[10px] font-medium tabular-nums border ${
                                  ad.fipeDiffPct <= 0
                                    ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {formatPct(ad.fipeDiffPct)} FIPE
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-semibold text-[#171717] dark:text-[#ededed]">
                            {ad.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Gauge className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                              {formatMileageKm(ad.mileageKm)}
                            </span>
                            {ad.transmission && <span>{ad.transmission}</span>}
                            {ad.fuel && <span>{ad.fuel}</span>}
                            <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
                              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">
                                {[ad.neighborhood, ad.city, ad.state].filter(Boolean).join(', ') || 'SC'}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              1º registro: {formatDateShortBR(ad.firstSeenAt)} • Último: {formatDateShortBR(ad.lastSeenAt)}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 md:text-right space-y-1 tabular-nums">
                          <div className="flex items-baseline md:justify-end gap-2">
                            {hasDelta && (
                              <span className="text-xs text-[#9a9a9a] line-through">
                                {formatBRL(ad.initialPrice)}
                              </span>
                            )}
                            <span className="text-lg font-bold text-[#171717] dark:text-[#ededed]">
                              {formatBRL(ad.currentPrice)}
                            </span>
                          </div>

                          {hasDelta && (
                            <p
                              className={`text-[11px] font-medium inline-flex items-center gap-1 ${
                                dropped
                                  ? 'text-[#15803d] dark:text-[#3ecf8e]'
                                  : 'text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {dropped ? (
                                <TrendingDown className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                <TrendingUp className="w-3 h-3" aria-hidden="true" />
                              )}
                              {formatSignedBRL(ad.priceChangeBrl)}
                              {ad.priceChangePct !== null ? ` (${formatPct(ad.priceChangePct)})` : ''}
                            </p>
                          )}

                          {ad.fipePrice && (
                            <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa]">
                              FIPE {formatBRL(ad.fipePrice)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#ededed] dark:border-[#27272a]">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedAdRefs((prev) => ({ ...prev, [ad.ref]: !isExpanded }))
                          }
                          className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-[11px] font-medium hover:border-[#3ecf8e]/50 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {ad.snapshots.length} registro(s) de preço/km
                          </span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleInspectAd(ad)}
                            className="h-7 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-[11px] font-medium hover:border-[#3ecf8e]/50 cursor-pointer"
                          >
                            Ver detalhes
                          </button>
                          <a
                            href={ad.ref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] text-[11px] font-medium hover:border-[#3ecf8e]/50"
                          >
                            <span>Abrir anúncio</span>
                            <ExternalLink className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                          </a>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="rounded-lg border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] p-3 space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                            Histórico deste anúncio
                          </p>
                          <ul className="space-y-1.5">
                            {ad.snapshots.map((snap) => (
                              <li
                                key={snap.id}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums border-b last:border-b-0 border-[#ededed] dark:border-[#27272a] pb-1.5 last:pb-0"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[#707070] dark:text-[#a1a1aa]">
                                    {formatDateTimeBR(snap.recordedAt)}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] bg-[#ffffff] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a]">
                                    {snap.eventType === 'first_seen'
                                      ? '1ª captura'
                                      : snap.eventType === 'price_change'
                                        ? 'Alteração de preço'
                                        : snap.eventType === 'mileage_change'
                                          ? 'Alteração de km'
                                          : 'Acompanhamento'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[#707070] dark:text-[#a1a1aa]">
                                    {formatMileageKm(snap.mileageKm)}
                                  </span>
                                  <span className="font-semibold text-[#171717] dark:text-[#ededed]">
                                    {formatBRL(snap.price)}
                                  </span>
                                  {snap.priceDelta !== null && snap.priceDelta !== 0 && (
                                    <span
                                      className={`text-[11px] font-medium ${
                                        snap.priceDelta < 0
                                          ? 'text-[#15803d] dark:text-[#3ecf8e]'
                                          : 'text-amber-700 dark:text-amber-300'
                                      }`}
                                    >
                                      ({formatSignedBRL(snap.priceDelta)})
                                    </span>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={tableCaptionId}
                className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] overflow-x-auto"
              >
                <table className="w-full min-w-[780px] text-left border-collapse text-xs">
                  <caption id={tableCaptionId} className="sr-only">
                    Linha do tempo cronológica de preços e quilometragem praticados
                  </caption>
                  <thead className="bg-[#fafafa] dark:bg-[#171717] border-b border-[#ededed] dark:border-[#27272a] text-[11px] uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                    <tr>
                      <th
                        scope="col"
                        aria-sort={sortKey === 'recordedAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className="p-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort('recordedAt')}
                          className="w-full px-3.5 py-2.5 text-left font-medium hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                        >
                          Data {sortKey === 'recordedAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                      <th scope="col" className="px-3.5 py-2.5 font-medium">
                        Anúncio / Versão
                      </th>
                      <th
                        scope="col"
                        aria-sort={sortKey === 'year' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className="p-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort('year')}
                          className="w-full px-3.5 py-2.5 text-left font-medium hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                        >
                          Ano {sortKey === 'year' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                      <th
                        scope="col"
                        aria-sort={sortKey === 'price' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className="p-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort('price')}
                          className="w-full px-3.5 py-2.5 text-right font-medium hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                        >
                          Preço {sortKey === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                      <th
                        scope="col"
                        aria-sort={sortKey === 'mileageKm' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className="p-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort('mileageKm')}
                          className="w-full px-3.5 py-2.5 text-right font-medium hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                        >
                          Km {sortKey === 'mileageKm' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                      <th
                        scope="col"
                        aria-sort={sortKey === 'fipeDiffPct' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className="p-0"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort('fipeDiffPct')}
                          className="w-full px-3.5 py-2.5 text-right font-medium hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                        >
                          vs FIPE {sortKey === 'fipeDiffPct' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      </th>
                      <th scope="col" className="px-3.5 py-2.5 font-medium">
                        Portal / Local
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ededed] dark:divide-[#27272a]">
                    {sortedTimeline.map((snap) => (
                      <tr key={snap.id} className="hover:bg-[#fafafa] dark:hover:bg-[#141416]">
                        <td className="px-3.5 py-2.5 whitespace-nowrap tabular-nums text-[#707070] dark:text-[#a1a1aa]">
                          {formatDateTimeBR(snap.recordedAt)}
                        </td>
                        <td className="px-3.5 py-2.5 max-w-[280px]">
                          <a
                            href={snap.ref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[#171717] dark:text-[#ededed] hover:text-[#3ecf8e] line-clamp-1"
                          >
                            {snap.title}
                          </a>
                          <span className="text-[10px] text-[#707070] dark:text-[#a1a1aa]">
                            {snap.eventType}
                            {snap.priceDelta && snap.priceDelta !== 0
                              ? ` (${formatSignedBRL(snap.priceDelta)})`
                              : ''}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 tabular-nums">{snap.year ?? '—'}</td>
                        <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">
                          {formatBRL(snap.price)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums text-[#707070] dark:text-[#a1a1aa]">
                          {formatMileageKm(snap.mileageKm)}
                        </td>
                        <td
                          className={`px-3.5 py-2.5 text-right tabular-nums font-medium ${
                            snap.fipeDiffPct !== null && snap.fipeDiffPct <= 0
                              ? 'text-[#15803d] dark:text-[#3ecf8e]'
                              : 'text-[#707070] dark:text-[#a1a1aa]'
                          }`}
                        >
                          {snap.fipeDiffPct !== null ? formatPct(snap.fipeDiffPct) : '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#707070] dark:text-[#a1a1aa]">
                          {snap.portal}
                          {snap.city ? ` • ${snap.city}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'breakdown' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[
                  { title: 'Por Portal', rows: result.portalBreakdown },
                  { title: 'Por Tipo de Anunciante', rows: result.sellerBreakdown },
                  { title: 'Por Ano-Modelo', rows: result.yearBreakdown },
                ].map((group) => (
                  <section
                    key={group.title}
                    className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] overflow-hidden"
                  >
                    <h3 className="px-4 py-3 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] text-xs font-semibold">
                      {group.title}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="text-[10px] uppercase text-[#707070] dark:text-[#a1a1aa] border-b border-[#ededed] dark:border-[#27272a]">
                          <tr>
                            <th scope="col" className="px-3 py-2 font-medium">Grupo</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">Qtd</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">Médio</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium">Km méd.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ededed] dark:divide-[#27272a]">
                          {group.rows.map((r) => (
                            <tr key={r.label}>
                              <td className="px-3 py-2 font-medium">{r.label}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatBRL(r.avgPrice, '—')}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-[#707070] dark:text-[#a1a1aa]">
                                {r.avgKm !== null
                                  ? `${Math.round(r.avgKm).toLocaleString('pt-BR')} km`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      <CarListingModal
        car={selectedCar}
        onClose={() => setSelectedCar(null)}
        onToggleFavorite={async (car) => {
          const next = await updateCarCuration(
            pb,
            car,
            { favorite: !car.favorite },
            user?.profileUserId,
          );
          setCurationMap((prev) => ({ ...prev, [car.id]: next }));
          setSelectedCar((cur) => (cur?.id === car.id ? { ...cur, favorite: !car.favorite } : cur));
        }}
        onToggleHidden={async (car) => {
          const next = await updateCarCuration(
            pb,
            car,
            { hidden: !car.hidden },
            user?.profileUserId,
          );
          setCurationMap((prev) => ({ ...prev, [car.id]: next }));
          setSelectedCar((cur) => (cur?.id === car.id ? { ...cur, hidden: !car.hidden } : cur));
        }}
        onSaveNotes={async (car, notes) => {
          const next = await updateCarCuration(
            pb,
            car,
            { notes },
            user?.profileUserId,
          );
          setCurationMap((prev) => ({ ...prev, [car.id]: next }));
          setSelectedCar((cur) => (cur?.id === car.id ? { ...cur, notes } : cur));
        }}
      />
    </div>
  );
}
