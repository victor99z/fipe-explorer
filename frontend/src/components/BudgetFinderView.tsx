import React, { useState, useEffect, useRef } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Check, X,
  ChevronDown, SlidersHorizontal, RotateCcw,
  Zap, Leaf, BatteryCharging, Fuel, TrendingUp, TrendingDown, Info,
  Database, ArrowUpRight, Sparkles
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import BrandLogo from './ui/brand-logo';
import CustomDropdown from './ui/custom-dropdown';
import VehicleHistoryModal from './VehicleHistoryModal';
import { Vehicle, VehicleSearchResponse, EngineSizeItem, FuelItem } from '../types/vehicle';
import { fetchBrands, fetchEngineSizes, fetchCars, fetchFuels } from '../services/api';

const POPULAR_BRANDS: string[] = [
  'VW - VolksWagen',
  'GM - Chevrolet',
  'Fiat',
  'Toyota',
  'Honda',
  'Hyundai',
  'Jeep',
  'Renault',
  'Nissan',
  'Ford',
  'BMW'
];

const POPULAR_ELECTRIC_BRANDS: string[] = [
  'BYD',
  'GWM',
  'Volvo',
  'Renault',
  'GM - Chevrolet',
  'BMW',
  'Mercedes-Benz',
  'Audi',
  'Porsche',
  'MINI',
  'Peugeot',
];

const isElectricVehicle = (car: Pick<Vehicle, 'nome_combustivel' | 'nome_modelo'>): boolean => {
  const fuel = (car.nome_combustivel || '').trim().toLowerCase();
  if (fuel === 'elétrico' || fuel === 'eletrico') return true;
  const model = (car.nome_modelo || '').toLowerCase();
  return (
    model.includes('(elétrico)') ||
    model.includes('(eletrico)') ||
    model.includes('(eltétrico)') ||
    model.includes('(életrico)')
  );
};

const extractElectricModelSpec = (nomeModelo?: string): string | null => {
  if (!nomeModelo) return null;
  const batteryMatch = nomeModelo.match(/\b(\d+(?:[.,]\d+)?)\s*kwh\b/i);
  if (batteryMatch) {
    return `Bateria ${batteryMatch[1].replace('.', ',')} kWh`;
  }
  const powerMatch = nomeModelo.match(/\b(\d+(?:[.,]\d+)?)\s*(kw|cv|hp)\b/i);
  if (powerMatch) {
    const unit = powerMatch[2].toLowerCase() === 'kw' ? 'kW' : powerMatch[2].toLowerCase();
    return `Potência ${powerMatch[1].replace('.', ',')} ${unit}`;
  }
  const driveMatch = nomeModelo.match(/\b(awd|4wd|rwd|4x4|quattro|xdrive|4matic)\b/i);
  if (driveMatch) {
    const raw = driveMatch[1];
    const formatted = /^(awd|4wd|rwd)$/i.test(raw)
      ? raw.toUpperCase()
      : raw.toLowerCase() === '4matic'
      ? '4MATIC'
      : raw.toLowerCase() === 'xdrive'
      ? 'xDrive'
      : raw.toLowerCase() === 'quattro'
      ? 'Quattro'
      : '4x4';
    return `Tração ${formatted}`;
  }
  return null;
};

const getQuickBrands = (
  combustivel: string,
  allBrands: string[],
  selectedBrands: string[]
): string[] => {
  if (combustivel !== 'eletrico') return POPULAR_BRANDS;
  const baseElectricBrands =
    allBrands.length > 0
      ? POPULAR_ELECTRIC_BRANDS.filter((b) => allBrands.includes(b))
      : POPULAR_ELECTRIC_BRANDS;
  return Array.from(new Set([...baseElectricBrands, ...selectedBrands]));
};

interface EngineItem {
  id: string;
  label: string;
}

const POPULAR_ENGINES: EngineItem[] = [
  { id: 'todos', label: 'Todos' },
  { id: '1.0', label: '1.0' },
  { id: '1.3', label: '1.3' },
  { id: '1.4', label: '1.4' },
  { id: '1.5', label: '1.5' },
  { id: '1.6', label: '1.6' },
  { id: '1.8', label: '1.8' },
  { id: '2.0', label: '2.0' },
  { id: '2.0+', label: '2.0+' },
];

export interface BudgetFinderViewProps {
  onSwitchTab?: (tab: string) => void;
  onSearchListings?: (vehicle: Vehicle) => void;
}

export default function BudgetFinderView({
  onSwitchTab: _onSwitchTab,
  onSearchListings,
}: BudgetFinderViewProps) {
  const [budgetValue, setBudgetValue] = useState<string>('80000');
  const [useSmartRange, setUseSmartRange] = useState<boolean>(true);
  const [showAdvancedPricing, setShowAdvancedPricing] = useState<boolean>(false);
  const [minPrice, setMinPrice] = useState<string>('64000');
  const [maxPrice, setMaxPrice] = useState<string>('80000');

  const [motorizacao, setMotorizacao] = useState<string>('todos');
  const [cambio, setCambio] = useState<string>('todos');
  const [litragem, setLitragem] = useState<string>('todos');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [searchModel, setSearchModel] = useState<string>('');
  const [minYear, setMinYear] = useState<string>('2018');
  const [maxYear, setMaxYear] = useState<string>('2026');
  const [combustivel, setCombustivel] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<string>('preco_desc');
  const [page, setPage] = useState<number>(1);

  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [availableEngines, setAvailableEngines] = useState<EngineSizeItem[]>([]);
  const [availableFuels, setAvailableFuels] = useState<FuelItem[]>([]);
  const [data, setData] = useState<VehicleSearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [brandDropdownOpen, setBrandDropdownOpen] = useState<boolean>(false);
  const [brandSearchTerm, setBrandSearchTerm] = useState<string>('');
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<Vehicle | null>(null);

  const parsePriceInput = (raw: string): string => raw.replace(/\D/g, '');

  const formatPriceInput = (val: string): string => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    const num = Number(digits);
    return Number.isNaN(num) ? '' : num.toLocaleString('pt-BR');
  };

  const applyBudget = (rawVal: string, isSmart: boolean = useSmartRange) => {
    const clean = parsePriceInput(rawVal);
    setBudgetValue(clean);
    if (!clean) {
      setMinPrice('0');
      setMaxPrice('');
      setPage(1);
      return;
    }
    const num = Number(clean);
    if (!isNaN(num) && num > 0) {
      if (isSmart) {
        setMinPrice(Math.round(num * 0.8).toString());
        setMaxPrice(num.toString());
      } else {
        setMinPrice('0');
        setMaxPrice(num.toString());
      }
    }
    setPage(1);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target as Node)) {
        setBrandDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [brandDropdownStyle, setBrandDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (brandDropdownOpen && brandDropdownRef.current) {
      const updatePosition = () => {
        if (!brandDropdownRef.current) return;
        const rect = brandDropdownRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const menuWidth = Math.min(288, viewportWidth - 24);

        let targetLeft = rect.left;
        if (rect.left + menuWidth > viewportWidth - 12) {
          targetLeft = rect.right - menuWidth;
        }

        const clampedLeft = Math.max(12, Math.min(targetLeft, viewportWidth - menuWidth - 12));
        const offsetLeft = clampedLeft - rect.left;

        setBrandDropdownStyle({
          left: `${offsetLeft}px`,
          width: `${menuWidth}px`,
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [brandDropdownOpen]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [brands, engines, fuels] = await Promise.all([
          fetchBrands('carro'),
          fetchEngineSizes('carro'),
          fetchFuels('carro')
        ]);
        setAllBrands(brands);
        setAvailableEngines(engines);
        setAvailableFuels(fuels);
      } catch (err: unknown) {
        console.error("Erro ao carregar opções de filtro:", err);
      }
    }
    loadFilterOptions();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function executeSearch() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchCars({
          tipo_veiculo: 'carro',
          preco_min: minPrice || '0',
          preco_max: maxPrice || '1000000',
          ano_min: minYear || '1990',
          ano_max: maxYear || '2026',
          motorizacao,
          cambio,
          litragem,
          marcas: selectedBrands,
          combustivel,
          search: searchModel.trim() || undefined,
          ordenacao,
          page,
          limit: 18
        });

        if (!isCancelled) {
          setData(result);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error(err);
          setError("Não foi possível carregar os dados. Verifique a conexão com o servidor.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      executeSearch();
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [minPrice, maxPrice, motorizacao, cambio, litragem, selectedBrands, searchModel, minYear, maxYear, combustivel, ordenacao, page]);

  const toggleBrand = (brandName: string) => {
    setSelectedBrands(prev => {
      if (prev.includes(brandName)) {
        return prev.filter(b => b !== brandName);
      } else {
        return [...prev, brandName];
      }
    });
    setPage(1);
  };

  const handleResetFilters = () => {
    setBudgetValue('80000');
    setUseSmartRange(true);
    setMinPrice('64000');
    setMaxPrice('80000');
    setMotorizacao('todos');
    setCambio('todos');
    setLitragem('todos');
    setSelectedBrands([]);
    setSearchModel('');
    setMinYear('2018');
    setMaxYear('2026');
    setCombustivel('todos');
    setOrdenacao('preco_desc');
    setPage(1);
  };

  const formattedBudgetDisplay = (): string => {
    const num = Number(budgetValue);
    if (isNaN(num) || num <= 0) return 'R$ 0,00';
    return `R$ ${num.toLocaleString('pt-BR')}`;
  };

  return (
    <div className="w-full space-y-10 sm:space-y-14">

      {/* 1. SPLIT-SCREEN KNOLLING HERO */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left: Editorial Flat-Lay Paper Tray */}
        <div className="lg:col-span-7 knolling-card knolling-enter p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#E6E6FA] text-[#2D2D2D] border border-[#2D2D2D]/15 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>FIG. 01 // EXPLORADOR FIPE &amp; INMETRO</span>
            </span>

            <h1
              className="font-bold tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3] leading-[1.12]"
              style={{ fontSize: 'clamp(2.25rem, 4.2vw, 3.25rem)' }}
            >
              Consulte no seu orçamento.
              <span className="inline-block mt-2 px-3 py-1 rounded-xl bg-[#CBE4F0] text-[#2D2D2D] border border-[#2D2D2D]/15 text-[0.72em] leading-snug font-bold">
                Filtre carros na FIPE em 90°
              </span>
            </h1>

            <p className="text-base text-[#2D2D2D]/78 dark:text-[#F5F2F3]/80 leading-[1.6] max-w-[68ch]">
              Organize suas opções de compra com precisão visual: cruze instantaneamente{' '}
              <strong className="tabular-nums font-bold text-[#2D2D2D] dark:text-[#F5F2F3]">9,42 milhões</strong>{' '}
              de registros históricos FIPE por cilindrada do motor, alimentação turbo, câmbio e eficiência energética PBEV do INMETRO.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12">
            <a
              href="#filtro-console"
              className="h-10 inline-flex items-center justify-center gap-2 bg-[#CBE4F0] hover:bg-[#b5d7e8] text-[#2D2D2D] font-semibold text-sm px-5 rounded-xl border border-[#2D2D2D]/15 shadow-[0_2px_10px_rgba(45,45,45,0.08)] transition-all duration-200 active:-translate-y-[1px]"
            >
              <span>Pesquisar veículos</span>
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </a>

            <span className="text-xs font-mono text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65">
              Base FIPEX 2026 • DuckDB Query Engine
            </span>
          </div>
        </div>

        {/* Right: Knolling Overhead Specimen Board (2x2 orthogonal objects) */}
        <div
          className="lg:col-span-5 knolling-card knolling-enter p-5 sm:p-6 flex flex-col justify-between gap-4"
          style={{ animationDelay: '80ms' }}
        >
          <div className="flex items-center justify-between border-b border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 pb-3">
            <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70">
              Specimen Board // 0° / 90°
            </span>
            <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-[8px] bg-[#D0F0C0] text-[#2D2D2D] border border-[#2D2D2D]/15">
              ATIV. LIVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            <div className="rounded-xl bg-[#F6D0D6]/85 border border-[#2D2D2D]/15 p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col justify-between gap-2 text-[#2D2D2D]">
              <Database className="w-4 h-4" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider opacity-75">Histórico FIPE</p>
                <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">9,42M linhas</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#CBE4F0]/90 border border-[#2D2D2D]/15 p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col justify-between gap-2 text-[#2D2D2D]">
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider opacity-75">Faixa Ativa</p>
                <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">80% – 100%</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#D0F0C0]/90 border border-[#2D2D2D]/15 p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col justify-between gap-2 text-[#2D2D2D]">
              <Fuel className="w-4 h-4" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider opacity-75">Selo PBEV</p>
                <p className="text-base font-bold leading-tight mt-0.5">km/l &amp; MJ/km</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#E6E6FA]/95 border border-[#2D2D2D]/15 p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex flex-col justify-between gap-2 text-[#2D2D2D]">
              <Search className="w-4 h-4" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider opacity-75">Cruzamento Real</p>
                <p className="text-base font-bold leading-tight mt-0.5">Anúncios vs FIPE</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. KNOLLING QUERY BUILDER CONSOLE */}
      <section id="filtro-console" className="knolling-card overflow-visible">
        {/* Console Header */}
        <div className="px-4 sm:px-6 py-3 bg-[#E6E6FA]/75 dark:bg-[#3B3948] border-b border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 rounded-t-xl flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2D2D2D] dark:bg-[#CBE4F0]" aria-hidden="true" />
            <span className="text-xs font-mono font-semibold text-[#2D2D2D] dark:text-[#F5F2F3]">
              fipex.knolling.query
            </span>
            <span className="text-[11px] text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65 font-mono hidden xs:inline">
              // --type=carro
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              aria-pressed={useSmartRange}
              onClick={() => {
                const next = !useSmartRange;
                setUseSmartRange(next);
                applyBudget(budgetValue, next);
              }}
              className={`h-7 inline-flex items-center gap-1.5 px-2.5 rounded-xl border transition-colors cursor-pointer text-[11px] font-medium ${
                useSmartRange
                  ? 'bg-[#D0F0C0] text-[#2D2D2D] border-[#2D2D2D]/20 font-semibold'
                  : 'bg-[#FFFDFB] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 hover:bg-[#FAF6F7]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${useSmartRange ? 'bg-[#2D2D2D]' : 'bg-[#2D2D2D]/35 dark:bg-[#F5F2F3]/35'}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Faixa inteligente (80% a 100%)</span>
              <span className="sm:hidden">Faixa intel. (80-100%)</span>
            </button>

            <button
              type="button"
              aria-expanded={showAdvancedPricing}
              onClick={() => setShowAdvancedPricing(!showAdvancedPricing)}
              className="h-7 px-2.5 rounded-xl border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FFFDFB] dark:bg-[#242226] text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 hover:bg-[#CBE4F0]/55 hover:text-[#2D2D2D] flex items-center gap-1 transition-colors cursor-pointer text-[11px] font-medium"
            >
              <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
              <span className="hidden sm:inline">{showAdvancedPricing ? 'Fechar ajuste' : 'Ajustar min/max'}</span>
              <span className="sm:hidden">{showAdvancedPricing ? 'Fechar' : 'Ajustar'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="h-7 px-2.5 rounded-xl border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FFFDFB] dark:bg-[#242226] text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 hover:bg-[#F6D0D6]/55 hover:text-[#2D2D2D] flex items-center gap-1 transition-colors cursor-pointer text-[11px] font-medium"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Console Body */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Orçamento Disponível */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="budget-input"
                className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider"
              >
                Orçamento Disponível
              </label>
              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center h-6 px-2.5 rounded-xl text-[11px] leading-none font-semibold tabular-nums text-[#2D2D2D] bg-[#CBE4F0]/65 border border-[#2D2D2D]/15">
                  Faixa ativa:{' '}
                  {minPrice ? `R$ ${Number(minPrice).toLocaleString('pt-BR')}` : 'R$ 0'}
                  {' a '}
                  {maxPrice ? `R$ ${Number(maxPrice).toLocaleString('pt-BR')}` : 'sem teto'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 flex items-center rounded-xl bg-[#FAF6F7] dark:bg-[#242226] border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 px-3.5 h-10 focus-within:border-[#2D2D2D] focus-within:ring-2 focus-within:ring-[#CBE4F0] focus-within:ring-offset-2 transition-all">
                <span className="text-sm font-bold text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 mr-2 select-none">R$</span>
                <input
                  id="budget-input"
                  type="text"
                  inputMode="numeric"
                  value={formatPriceInput(budgetValue)}
                  onChange={(e) => applyBudget(e.target.value)}
                  placeholder="Ex: 80.000"
                  className={`w-full bg-transparent text-[#2D2D2D] dark:text-[#F5F2F3] font-bold tabular-nums text-base sm:text-lg focus:outline-none placeholder:text-[#2D2D2D]/40 dark:placeholder:text-[#F5F2F3]/40 ${budgetValue ? 'pr-6' : ''}`}
                />
                {budgetValue && (
                  <button
                    type="button"
                    aria-label="Limpar orçamento"
                    onClick={() => applyBudget('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 hover:text-[#2D2D2D] dark:hover:text-[#F5F2F3] p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Shortcut Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[30000, 50000, 70000, 80000, 100000, 120000, 150000, 200000, 300000].map((val) => {
                  const isActive = Number(budgetValue) === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => applyBudget(val.toString())}
                      className={`h-8 px-2.5 text-xs tabular-nums rounded-xl border transition-all duration-200 cursor-pointer inline-flex items-center justify-center ${
                        isActive
                          ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/30 font-bold shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                          : 'bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#E6E6FA]/60 text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 font-medium'
                      }`}
                    >
                      {(val / 1000).toFixed(0)}k
                    </button>
                  );
                })}
              </div>
            </div>

            {showAdvancedPricing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#FAF6F7] dark:bg-[#242226] border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 mt-2">
                <div>
                  <label htmlFor="min-price-input" className="block text-xs font-medium text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 mb-1">
                    Preço Mínimo (R$)
                  </label>
                  <Input
                    id="min-price-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatPriceInput(minPrice)}
                    onChange={(e) => { setMinPrice(parsePriceInput(e.target.value)); setPage(1); }}
                    className="h-8 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="max-price-input" className="block text-xs font-medium text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 mb-1">
                    Preço Máximo (R$)
                  </label>
                  <Input
                    id="max-price-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="100.000"
                    value={formatPriceInput(maxPrice)}
                    onChange={(e) => { setMaxPrice(parsePriceInput(e.target.value)); setPage(1); }}
                    className="h-8 text-xs tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12" />

          {/* Propulsão & Combustível */}
          <div className="space-y-2">
            <div className="flex items-center justify-between h-5">
              <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                Propulsão / Combustível
              </span>
              {combustivel !== 'todos' && (
                <button
                  type="button"
                  onClick={() => { setCombustivel('todos'); setPage(1); }}
                  className="text-xs text-[#2D2D2D] dark:text-[#CBE4F0] underline hover:opacity-75 cursor-pointer whitespace-nowrap"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={combustivel === 'todos' || combustivel === ''}
                onClick={() => { setCombustivel('todos'); setPage(1); }}
                className={`h-8 px-3 rounded-xl text-xs border transition-colors inline-flex items-center justify-center cursor-pointer ${
                  combustivel === 'todos' || combustivel === ''
                    ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                    : 'bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#FAF6F7] text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 font-medium'
                }`}
              >
                Todos
              </button>

              <button
                type="button"
                aria-pressed={combustivel === 'flex,gasolina'}
                onClick={() => { setCombustivel('flex,gasolina'); setPage(1); }}
                className={`h-8 px-3 rounded-xl text-xs border transition-colors inline-flex items-center gap-1.5 justify-center cursor-pointer ${
                  combustivel === 'flex,gasolina'
                    ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                    : 'bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#FAF6F7] text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 font-medium'
                }`}
              >
                <span>Flex &amp; Gasolina</span>
              </button>

              <button
                type="button"
                aria-pressed={combustivel === 'hibrido_eletrico'}
                onClick={() => { setCombustivel('hibrido_eletrico'); setPage(1); }}
                className={`h-8 px-3 rounded-xl text-xs border transition-colors inline-flex items-center gap-1.5 justify-center cursor-pointer ${
                  combustivel === 'hibrido_eletrico'
                    ? 'bg-[#D0F0C0] text-[#2D2D2D] border-[#2D2D2D]/30 font-bold shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                    : 'bg-[#D0F0C0]/45 hover:bg-[#D0F0C0]/80 text-[#2D2D2D] dark:text-[#D0F0C0] dark:bg-[#2F3B31] border-[#2D2D2D]/15 font-medium'
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Híbridos &amp; Elétricos</span>
              </button>

              <button
                type="button"
                aria-pressed={combustivel === 'hibrido'}
                onClick={() => { setCombustivel('hibrido'); setPage(1); }}
                className={`h-8 px-3 rounded-xl text-xs border transition-colors inline-flex items-center gap-1.5 justify-center cursor-pointer ${
                  combustivel === 'hibrido'
                    ? 'bg-[#D0F0C0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                    : 'bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#D0F0C0]/35 text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 font-medium'
                }`}
              >
                <Leaf className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Híbrido</span>
              </button>

              <button
                type="button"
                aria-pressed={combustivel === 'eletrico'}
                onClick={() => {
                  setCombustivel('eletrico');
                  setLitragem('todos');
                  setMotorizacao('todos');
                  setCambio('todos');
                  setPage(1);
                }}
                className={`h-8 px-3 rounded-xl text-xs border transition-colors inline-flex items-center gap-1.5 justify-center cursor-pointer ${
                  combustivel === 'eletrico'
                    ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                    : 'bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#CBE4F0]/35 text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 font-medium'
                }`}
              >
                <BatteryCharging className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Elétrico</span>
              </button>

              <CustomDropdown
                value={['flex,gasolina', 'hibrido_eletrico', 'hibrido', 'eletrico', 'todos', ''].includes(combustivel) ? '' : combustivel}
                onChange={(val) => {
                  setCombustivel(String(val));
                  setPage(1);
                }}
                placeholder="+ Outros"
                align="right"
                menuClassName="w-56 max-w-[calc(100vw-2rem)]"
                options={[
                  {
                    value: 'diesel',
                    label: `Diesel ${availableFuels.find(f => f.nome === 'Diesel') ? `(${availableFuels.find(f => f.nome === 'Diesel')?.total_modelos})` : ''}`.trim()
                  },
                  {
                    value: 'flex',
                    label: `Apenas Flex ${availableFuels.find(f => f.nome === 'Flex') ? `(${availableFuels.find(f => f.nome === 'Flex')?.total_modelos})` : ''}`.trim()
                  },
                  {
                    value: 'gasolina',
                    label: `Apenas Gasolina ${availableFuels.find(f => f.nome === 'Gasolina') ? `(${availableFuels.find(f => f.nome === 'Gasolina')?.total_modelos})` : ''}`.trim()
                  },
                  {
                    value: 'alcool',
                    label: `Álcool / Etanol ${availableFuels.find(f => f.nome === 'Álcool') ? `(${availableFuels.find(f => f.nome === 'Álcool')?.total_modelos})` : ''}`.trim()
                  },
                  {
                    value: 'gnv',
                    label: `Gás Natural (GNV) ${availableFuels.find(f => f.nome === 'Gás Natural') ? `(${availableFuels.find(f => f.nome === 'Gás Natural')?.total_modelos})` : ''}`.trim()
                  }
                ]}
                renderTrigger={({ isOpen, setIsOpen }) => {
                  const isOtherSelected = !['flex,gasolina', 'hibrido_eletrico', 'hibrido', 'eletrico', 'todos', ''].includes(combustivel);
                  return (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-haspopup="listbox"
                      onClick={() => setIsOpen(!isOpen)}
                      className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs transition-colors border cursor-pointer ${
                        isOpen
                          ? 'border-[#2D2D2D] bg-[#CBE4F0]/60 text-[#2D2D2D]'
                          : isOtherSelected
                          ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                          : 'border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#FAF6F7]'
                      }`}
                    >
                      <span className="capitalize">{isOtherSelected ? combustivel : '+ Outros'}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                  );
                }}
              />
            </div>
          </div>

          {combustivel !== 'eletrico' && (
            <>
              <div className="border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12" />

              {/* Technical Filters */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-6 space-y-2">
                  <div className="flex items-center justify-between h-5">
                    <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                      Cilindrada do Motor
                    </span>
                    {litragem !== 'todos' && (
                      <button
                        type="button"
                        onClick={() => { setLitragem('todos'); setPage(1); }}
                        className="text-xs text-[#2D2D2D] dark:text-[#CBE4F0] underline hover:opacity-75 cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {POPULAR_ENGINES.map((eng) => {
                      const isSelected = litragem === eng.id;
                      return (
                        <button
                          key={eng.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => { setLitragem(eng.id); setPage(1); }}
                          className={`h-8 px-3 rounded-xl text-xs tabular-nums border transition-colors inline-flex items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                              : 'bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#FAF6F7] text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 font-medium'
                          }`}
                        >
                          {eng.label}
                        </button>
                      );
                    })}

                    <CustomDropdown
                      value={POPULAR_ENGINES.some(e => e.id === litragem) ? '' : (litragem === 'todos' ? '' : litragem)}
                      onChange={(val) => {
                        setLitragem(String(val) || 'todos');
                        setPage(1);
                      }}
                      placeholder="+ Outras"
                      searchable={true}
                      searchPlaceholder="Buscar cilindrada..."
                      menuClassName="w-64 max-w-[calc(100vw-2rem)]"
                      align="right"
                      isActive={!POPULAR_ENGINES.some(e => e.id === litragem) && litragem !== 'todos'}
                      options={[
                        { value: '', label: 'Todas as outras (limpar)' },
                        ...availableEngines
                          .filter(e => !POPULAR_ENGINES.some(p => p.id === e.litragem))
                          .map(e => ({
                            value: e.litragem,
                            label: `Motor ${e.litragem} (${e.total_modelos})`
                          }))
                      ]}
                      renderTrigger={({ isOpen, setIsOpen }) => {
                        const isOtherSelected = !POPULAR_ENGINES.some(e => e.id === litragem) && litragem !== 'todos';
                        return (
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-haspopup="listbox"
                            onClick={() => setIsOpen(!isOpen)}
                            className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs transition-colors border cursor-pointer ${
                              isOpen
                                ? 'border-[#2D2D2D] bg-[#CBE4F0]/60 text-[#2D2D2D]'
                                : isOtherSelected
                                ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-semibold'
                                : 'border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#FAF6F7]'
                            }`}
                          >
                            <span>{isOtherSelected ? `Motor ${litragem}` : '+ Outras'}</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                        );
                      }}
                    />
                  </div>
                </div>

                {/* Alimentação */}
                <div className="lg:col-span-3 space-y-2">
                  <div className="flex items-center h-5">
                    <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider block">
                      Alimentação
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-[#FAF6F7] dark:bg-[#242226] p-1 rounded-xl border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15">
                    {(['todos', 'turbo', 'aspirado'] as const).map((mode) => {
                      const label = mode === 'todos' ? 'Todos' : mode === 'turbo' ? 'Turbo' : 'Aspirado';
                      const pressed = motorizacao === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={pressed}
                          onClick={() => { setMotorizacao(mode); setPage(1); }}
                          className={`py-1.5 text-xs rounded-[8px] transition-colors cursor-pointer ${
                            pressed
                              ? 'bg-[#CBE4F0] text-[#2D2D2D] font-semibold shadow-2xs'
                              : 'text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 hover:text-[#2D2D2D] dark:hover:text-[#F5F2F3]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Transmissão */}
                <div className="lg:col-span-3 space-y-2">
                  <div className="flex items-center h-5">
                    <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider block">
                      Transmissão
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-[#FAF6F7] dark:bg-[#242226] p-1 rounded-xl border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15">
                    {(['todos', 'automatico', 'manual'] as const).map((mode) => {
                      const label = mode === 'todos' ? 'Todos' : mode === 'automatico' ? 'Automático' : 'Manual';
                      const pressed = cambio === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={pressed}
                          onClick={() => { setCambio(mode); setPage(1); }}
                          className={`py-1.5 text-xs rounded-[8px] transition-colors cursor-pointer ${
                            pressed
                              ? 'bg-[#CBE4F0] text-[#2D2D2D] font-semibold shadow-2xs'
                              : 'text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 hover:text-[#2D2D2D] dark:hover:text-[#F5F2F3]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12" />

          {/* Marcas, Modelo e Ano */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between h-5">
                <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider">
                  Marcas
                  {selectedBrands.length > 0 && (
                    <span className="ml-1.5 font-bold tabular-nums text-[#2D2D2D] dark:text-[#CBE4F0]">
                      ({selectedBrands.length})
                    </span>
                  )}
                </span>
                {selectedBrands.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedBrands([]); setPage(1); }}
                    className="text-xs text-[#2D2D2D] dark:text-[#CBE4F0] underline hover:opacity-75 cursor-pointer"
                  >
                    Desmarcar
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {getQuickBrands(combustivel, allBrands, selectedBrands).map((brand) => {
                  const isSelected = selectedBrands.includes(brand);
                  return (
                    <button
                      key={brand}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleBrand(brand)}
                      className={`h-8 px-2.5 rounded-xl text-xs border transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/30 font-semibold'
                          : 'bg-[#FAF6F7] dark:bg-[#242226] hover:bg-[#E6E6FA]/60 text-[#2D2D2D] dark:text-[#F5F2F3] border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 font-medium'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-[4px] bg-[#FFFDFB] border border-[#2D2D2D]/10 flex items-center justify-center p-[1px] shrink-0">
                        <BrandLogo brand={brand} size="xs" iconClassName="text-[#2D2D2D]" />
                      </span>
                      <span>{brand.split(' - ')[0]}</span>
                    </button>
                  );
                })}

                <div className="relative inline-block" ref={brandDropdownRef}>
                  <button
                    type="button"
                    aria-expanded={brandDropdownOpen}
                    aria-haspopup="listbox"
                    onClick={() => {
                      setBrandDropdownOpen(!brandDropdownOpen);
                      if (!brandDropdownOpen) setBrandSearchTerm('');
                    }}
                    className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs transition-colors border cursor-pointer ${
                      brandDropdownOpen
                        ? 'border-[#2D2D2D] bg-[#CBE4F0] text-[#2D2D2D] font-semibold'
                        : 'border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 bg-[#FFFDFB] dark:bg-[#242226] hover:bg-[#FAF6F7]'
                    }`}
                  >
                    <span>+ Todas</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${brandDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {brandDropdownOpen && (
                    <div
                      style={brandDropdownStyle}
                      className="absolute top-full mt-2 bg-[#FFFDFB] dark:bg-[#2D2D2D] border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 rounded-xl shadow-[0_12px_28px_rgba(45,45,45,0.16)] z-[200] p-2.5 flex flex-col"
                    >
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                        <input
                          type="text"
                          placeholder="Buscar marca..."
                          value={brandSearchTerm}
                          onChange={(e) => setBrandSearchTerm(e.target.value)}
                          className="h-8 w-full rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FAF6F7] dark:bg-[#242226] pl-8 pr-7 text-xs text-[#2D2D2D] dark:text-[#F5F2F3] placeholder:text-[#2D2D2D]/45 dark:placeholder:text-[#F5F2F3]/45 focus:outline-none"
                          autoFocus
                        />
                        {brandSearchTerm && (
                          <button
                            type="button"
                            aria-label="Limpar busca de marca"
                            onClick={() => setBrandSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 hover:text-[#2D2D2D] p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                        {allBrands.filter(b => b.toLowerCase().includes(brandSearchTerm.toLowerCase())).length === 0 ? (
                          <div className="py-4 text-center text-xs text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65">
                            Nenhuma marca encontrada
                          </div>
                        ) : (
                          allBrands
                            .filter(b => b.toLowerCase().includes(brandSearchTerm.toLowerCase()))
                            .map((b) => {
                              const isSel = selectedBrands.includes(b);
                              return (
                                <button
                                  key={b}
                                  type="button"
                                  onClick={() => toggleBrand(b)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[8px] text-xs text-left cursor-pointer transition-colors ${
                                    isSel
                                      ? 'bg-[#CBE4F0] text-[#2D2D2D] font-semibold'
                                      : 'text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80 hover:bg-[#E6E6FA]/60 dark:hover:bg-[#3B3948]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 mr-2">
                                    <span className="w-5 h-5 rounded-[4px] bg-[#FFFDFB] border border-[#2D2D2D]/15 p-0.5 flex items-center justify-center shrink-0">
                                      <BrandLogo brand={b} size="xs" iconClassName="text-[#2D2D2D]" />
                                    </span>
                                    <span className="truncate">{b}</span>
                                  </div>
                                  {isSel && <Check className="w-3.5 h-3.5 text-[#2D2D2D] flex-shrink-0" aria-hidden="true" />}
                                </button>
                              );
                            })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Nome do Modelo */}
            <div className="lg:col-span-3 space-y-2">
              <div className="flex items-center h-5">
                <label
                  htmlFor="model-search-input"
                  className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider block"
                >
                  Nome do Modelo
                </label>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <Input
                  id="model-search-input"
                  type="text"
                  placeholder="Ex: Polo, Civic, Onix..."
                  value={searchModel}
                  onChange={(e) => { setSearchModel(e.target.value); setPage(1); }}
                  className="pl-8 pr-7 text-xs h-8"
                />
                {searchModel && (
                  <button
                    type="button"
                    aria-label="Limpar busca por modelo"
                    onClick={() => { setSearchModel(''); setPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 hover:text-[#2D2D2D] cursor-pointer"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Ano a partir de */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center h-5">
                <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/80 uppercase tracking-wider block">
                  Ano a partir de
                </span>
              </div>
              <CustomDropdown
                value={minYear}
                onChange={(val) => { setMinYear(String(val)); setPage(1); }}
                className="w-full"
                menuClassName="w-full min-w-[160px]"
                isActive={minYear !== '1990'}
                options={[
                  { value: '1990', label: 'Qualquer ano' },
                  ...[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2012, 2010, 2005].map(y => ({
                    value: String(y),
                    label: String(y)
                  }))
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. RESULTS SUMMARY BAR */}
      <div className="knolling-card px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#2D2D2D] dark:text-[#F5F2F3] tracking-tight tabular-nums">
            Veículos disponíveis até {formattedBudgetDisplay()}
          </h2>
          <p className="text-xs text-[#2D2D2D]/70 dark:text-[#F5F2F3]/75">
            {loading ? (
              'Consultando banco DuckDB...'
            ) : (
              <span>
                <strong className="tabular-nums text-[#2D2D2D] dark:text-[#F5F2F3]">
                  {(data?.total_encontrados || 0).toLocaleString('pt-BR')}
                </strong>{' '}
                modelos encontrados dentro dos critérios
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2">
          <span className="text-xs font-medium text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 whitespace-nowrap">
            Ordenar por:
          </span>
          <CustomDropdown
            value={ordenacao}
            onChange={(val) => { setOrdenacao(String(val)); setPage(1); }}
            className="w-48 sm:w-52"
            menuClassName="w-56"
            align="right"
            isActive={ordenacao !== 'preco_desc'}
            options={[
              { value: 'preco_desc', label: 'Maior Preço (Teto)' },
              { value: 'preco_asc', label: 'Menor Preço' },
              { value: 'consumo_desc', label: 'Mais Econômicos (INMETRO)' },
              { value: 'ano_desc', label: 'Ano Mais Novo' },
              { value: 'desvalorizacao_desc', label: 'Maior Desvalorização' },
              { value: 'desvalorizacao_asc', label: 'Menor Desvalorização' },
            ]}
          />
        </div>
      </div>

      {/* 4. 2-COLUMN KNOLLING SPECIMEN GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="knolling-card p-5 space-y-4 h-64 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <div className="knolling-shimmer h-6 w-28 rounded-xl" />
                <div className="knolling-shimmer h-6 w-32 rounded-xl" />
              </div>
              <div className="knolling-shimmer h-6 w-3/4 rounded-xl" />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="knolling-shimmer h-14 rounded-xl" />
                <div className="knolling-shimmer h-14 rounded-xl" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="knolling-shimmer h-8 w-32 rounded-xl" />
                <div className="knolling-shimmer h-8 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="knolling-card p-8 text-center space-y-3">
          <p className="text-sm text-[#2D2D2D]/80 dark:text-[#F5F2F3]/80">{error}</p>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            Restaurar filtros
          </Button>
        </div>
      ) : data?.resultados?.length === 0 ? (
        <div className="knolling-card p-12 text-center space-y-3">
          <Search className="w-8 h-8 text-[#2D2D2D]/50 dark:text-[#F5F2F3]/50 mx-auto" aria-hidden="true" />
          <p className="text-base font-bold text-[#2D2D2D] dark:text-[#F5F2F3]">
            Nenhum veículo encontrado
          </p>
          <p className="text-sm text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 max-w-md mx-auto">
            Não encontramos veículos correspondentes aos filtros selecionados. Tente expandir a faixa de valor ou remover filtros específicos.
          </p>
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {data?.resultados?.map((car, idx) => {
            const hasDevaluation = car.variacao_pct !== undefined && car.variacao_pct !== null;
            const isPositive = (car.variacao_pct ?? 0) >= 0;
            const hasInitialPrice = car.valor_inicial != null && car.valor_inicial > 0;
            const diffRs = hasInitialPrice ? car.valor - (car.valor_inicial as number) : null;
            const diffRsFormatted =
              diffRs != null
                ? `${diffRs >= 0 ? '+' : '-'}R$ ${Math.abs(diffRs).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : null;
            const variacaoTooltipId = `variacao-tip-${car.codigo_fipe}-${car.ano_modelo ?? 'na'}`;
            const isElectric = isElectricVehicle(car);
            const electricSpec = isElectric ? extractElectricModelSpec(car.nome_modelo) : null;
            const hasElectricMetrics =
              car.autonomia_km != null ||
              car.consumo_urbano_eletrico != null ||
              car.eficiencia_mj_km != null;

            return (
              <div
                key={`${car.codigo_fipe}-${car.ano_modelo}`}
                onClick={() => setSelectedVehicleForHistory(car)}
                style={{ animationDelay: `${Math.min(idx, 6) * 60}ms` }}
                className="group knolling-card knolling-enter hover:border-[#2D2D2D]/35 hover:-translate-y-[1px] p-4 sm:p-5 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Card Header Compartment */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#2D2D2D]/10 dark:border-[#F5F2F3]/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-[8px] bg-[#FAF6F7] border border-[#2D2D2D]/15 p-1 flex items-center justify-center flex-shrink-0">
                        <BrandLogo brand={car.nome_marca} size="md" iconClassName="text-[#2D2D2D]" />
                      </div>
                      <span className="text-xs font-bold text-[#2D2D2D] dark:text-[#F5F2F3] truncate leading-none">
                        {car.nome_marca}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0">
                      {isElectric && (
                        <span className="inline-flex items-center gap-1 h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold bg-[#CBE4F0] text-[#2D2D2D] border border-[#2D2D2D]/15">
                          <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Elétrico
                        </span>
                      )}
                      {!isElectric && car.nome_combustivel === 'Híbrido' && (
                        <span className="inline-flex items-center gap-1 h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold bg-[#D0F0C0] text-[#2D2D2D] border border-[#2D2D2D]/15">
                          <Leaf className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Híbrido
                        </span>
                      )}
                      {car.nota_pbe && (
                        <span
                          title={`Nota PBEV INMETRO: ${car.nota_pbe}${car.match_consumo === 'conjunto_mecanico' ? ' (estimado pelo conjunto mecânico)' : ''}`}
                          className={`inline-flex items-center h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold border border-[#2D2D2D]/15 ${
                            car.nota_pbe === 'A' || car.nota_pbe === 'B'
                              ? 'bg-[#D0F0C0] text-[#2D2D2D]'
                              : car.nota_pbe === 'C'
                              ? 'bg-[#F6D0D6] text-[#2D2D2D]'
                              : 'bg-[#FAF6F7] text-[#2D2D2D]'
                          }`}
                        >
                          PBE {car.nota_pbe}
                        </span>
                      )}
                      <span className="inline-flex items-center h-5 sm:h-[22px] px-2 rounded-[8px] font-mono text-[10px] sm:text-[11px] leading-none text-[#2D2D2D] bg-[#E6E6FA] border border-[#2D2D2D]/15">
                        {car.codigo_fipe}
                      </span>
                      {car.ano_modelo && (
                        <span className="inline-flex items-center h-5 sm:h-[22px] px-2 rounded-[8px] text-[10px] sm:text-[11px] leading-none font-semibold tabular-nums text-[#2D2D2D] bg-[#CBE4F0] border border-[#2D2D2D]/15">
                          {car.ano_modelo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Model Title */}
                  <h3 className="text-base sm:text-lg font-bold text-[#2D2D2D] dark:text-[#F5F2F3] tracking-tight leading-snug line-clamp-2 mt-3 mb-3">
                    {car.nome_modelo}
                  </h3>

                  {isElectric ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3.5 text-xs bg-[#E6E6FA]/55 dark:bg-[#3B3948]/80 text-[#2D2D2D] dark:text-[#F5F2F3] p-3 rounded-xl border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/15">
                      {hasElectricMetrics ? (
                        <>
                          {car.autonomia_km != null && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <BatteryCharging className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate font-semibold tabular-nums">
                                Autonomia {car.autonomia_km.toLocaleString('pt-BR')} km
                              </span>
                            </div>
                          )}
                          {car.consumo_urbano_eletrico != null && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Zap className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate font-semibold tabular-nums">
                                {car.consumo_urbano_eletrico.toFixed(1).replace('.', ',')}
                                {car.consumo_rodoviario_eletrico != null
                                  ? ` / ${car.consumo_rodoviario_eletrico.toFixed(1).replace('.', ',')}`
                                  : ''}{' '}
                                km/le
                              </span>
                            </div>
                          )}
                          {car.eficiencia_mj_km != null && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Leaf className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate font-semibold tabular-nums">
                                {car.eficiencia_mj_km.toFixed(2).replace('.', ',')} MJ/km
                              </span>
                            </div>
                          )}
                          {car.autonomia_km == null && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <BatteryCharging className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate font-semibold">Propulsão Elétrica</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate">{electricSpec || 'Zero Emissões (BEV)'}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Zap className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate font-semibold">Propulsão Elétrica</span>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate">{electricSpec || 'Zero Emissões (BEV)'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* 2x2 Knolling Specs Compartment (Lavender) */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-3 text-xs bg-[#E6E6FA]/55 dark:bg-[#3B3948]/80 text-[#2D2D2D] dark:text-[#F5F2F3] p-3 rounded-xl border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/15">
                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate font-semibold">
                            {car.litragem ? `Motor ${car.litragem}L` : 'Motor N/D'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {car.is_automatico ? 'Automático' : 'Manual'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {car.is_turbo ? 'Turbo' : 'Aspirado'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">{car.nome_combustivel || 'Flex'}</span>
                        </div>
                      </div>

                      {/* INMETRO Consumption Tray (Soft Mint) */}
                      {(car.consumo_urbano_gasolina != null || car.consumo_urbano_etanol != null || car.consumo_urbano_eletrico != null) && (
                        <div className="mb-3.5 px-3 py-2.5 rounded-xl bg-[#D0F0C0]/45 dark:bg-[#2F3B31]/75 border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/15 space-y-1 text-[#2D2D2D] dark:text-[#F5F2F3]">
                          {car.consumo_urbano_gasolina != null && (
                            <div className="flex items-center gap-1.5">
                              <Fuel className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                              <span className="font-semibold tabular-nums text-xs">
                                {car.nome_combustivel?.toLowerCase() === 'diesel' ? 'Diesel' : 'Gasolina'}:{' '}
                                {car.consumo_urbano_gasolina.toFixed(1).replace('.', ',')} cid
                                {car.consumo_rodoviario_gasolina != null
                                  ? ` / ${car.consumo_rodoviario_gasolina.toFixed(1).replace('.', ',')} est km/l`
                                  : ' km/l'}
                              </span>
                            </div>
                          )}
                          {car.consumo_urbano_etanol != null && (
                            <div className="flex items-center gap-1.5">
                              <Fuel className="w-3.5 h-3.5 opacity-75 flex-shrink-0" aria-hidden="true" />
                              <span className="font-medium opacity-85 tabular-nums text-xs">
                                Etanol: {car.consumo_urbano_etanol.toFixed(1).replace('.', ',')} cid
                                {car.consumo_rodoviario_etanol != null
                                  ? ` / ${car.consumo_rodoviario_etanol.toFixed(1).replace('.', ',')} est km/l`
                                  : ' km/l'}
                              </span>
                            </div>
                          )}
                          {car.consumo_urbano_eletrico != null && (
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                              <span className="font-semibold tabular-nums text-xs">
                                Elétrico: {car.consumo_urbano_eletrico.toFixed(1).replace('.', ',')} cid
                                {car.consumo_rodoviario_eletrico != null
                                  ? ` / ${car.consumo_rodoviario_eletrico.toFixed(1).replace('.', ',')} est km/le`
                                  : ' km/le'}
                                {car.autonomia_km ? ` • ${car.autonomia_km} km` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Bottom Row: FIPE Price & Knolling Actions */}
                <div className="pt-3.5 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-medium tracking-wider text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65 block leading-none mb-1">
                      Tabela FIPE
                    </span>
                    <span className="text-xl font-bold tabular-nums tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3] block leading-tight whitespace-nowrap">
                      {car.valor_formatado}
                    </span>

                    {hasDevaluation && (
                      <div
                        className="group/tooltip relative inline-flex items-center gap-1 mt-1 text-xs tabular-nums cursor-help rounded-[8px] focus:outline-none"
                        tabIndex={0}
                        aria-describedby={variacaoTooltipId}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            e.currentTarget.blur();
                          }
                        }}
                      >
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[6px] font-semibold text-[11px] border border-[#2D2D2D]/15 ${
                            isPositive
                              ? 'bg-[#D0F0C0] text-[#2D2D2D]'
                              : 'bg-[#F6D0D6]/85 text-[#2D2D2D]'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <TrendingDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                          )}
                          {isPositive ? '+' : ''}{Number(car.variacao_pct).toFixed(2).replace('.', ',')}%
                        </span>
                        <span className="text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65 text-[11px] underline decoration-dotted underline-offset-2">
                          no período
                        </span>
                        <Info className="w-3 h-3 text-[#2D2D2D]/60 dark:text-[#F5F2F3]/60 shrink-0" aria-hidden="true" />

                        <div
                          id={variacaoTooltipId}
                          role="tooltip"
                          className="pointer-events-none opacity-0 invisible group-hover/tooltip:pointer-events-auto group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:pointer-events-auto group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible transition-opacity duration-200 absolute bottom-full left-0 mb-2 w-64 z-[200] rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#2D2D2D] p-3 shadow-[0_8px_24px_rgba(45,45,45,0.14)] text-left text-[11px] leading-snug text-[#2D2D2D] dark:text-[#F5F2F3]"
                        >
                          <p className="font-bold text-[11px] mb-1.5">Cálculo da Variação FIPE</p>
                          <div className="space-y-1 text-[11px] tabular-nums">
                            <div className="flex items-center justify-between gap-2 opacity-75">
                              <span>1º registro na FIPE:</span>
                              <span className="font-semibold opacity-100">
                                {car.valor_inicial_formatado || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 opacity-75">
                              <span>Preço atual ({car.periodo_referencia}):</span>
                              <span className="font-semibold opacity-100">{car.valor_formatado}</span>
                            </div>
                            {diffRsFormatted && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12">
                                <span className="opacity-75">Diferença acumulada:</span>
                                <span className="font-bold">
                                  {diffRsFormatted} ({isPositive ? '+' : ''}{Number(car.variacao_pct).toFixed(2).replace('.', ',')}%)
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="mt-2 pt-1.5 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 text-[10px] opacity-70 font-mono">
                            Fórmula: ((Atual − Inicial) ÷ Inicial) × 100
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {onSearchListings && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title={`Buscar anúncios de ${car.nome_marca} ${car.nome_modelo}`}
                        aria-label={`Buscar anúncios de ${car.nome_marca} ${car.nome_modelo}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSearchListings(car);
                        }}
                        className="h-8 w-8 bg-[#E6E6FA]/70 hover:bg-[#E6E6FA]"
                      >
                        <Search className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVehicleForHistory(car);
                      }}
                      className="text-xs h-8 px-3.5 font-semibold"
                    >
                      Ver Histórico
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. PAGINATION */}
      {data && data.total_paginas > 1 && (
        <div className="flex items-center justify-center gap-2.5 pt-2 pb-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => { setPage(p => Math.max(p - 1, 1)); window.scrollTo({ top: 350, behavior: 'smooth' }); }}
            className="h-8 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Anterior
          </Button>

          <span className="text-xs text-[#2D2D2D] dark:text-[#F5F2F3] bg-[#FFFDFB] dark:bg-[#2D2D2D] border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 rounded-xl px-3.5 h-8 inline-flex items-center font-semibold tabular-nums">
            Página {page.toLocaleString('pt-BR')} de {data.total_paginas.toLocaleString('pt-BR')}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.total_paginas}
            onClick={() => { setPage(p => Math.min(p + 1, data.total_paginas)); window.scrollTo({ top: 350, behavior: 'smooth' }); }}
            className="h-8 text-xs"
          >
            Próxima
            <ChevronRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
          </Button>
        </div>
      )}

      {selectedVehicleForHistory && (
        <VehicleHistoryModal
          vehicle={selectedVehicleForHistory}
          onClose={() => setSelectedVehicleForHistory(null)}
          onSearchListings={onSearchListings}
        />
      )}
    </div>
  );
}
