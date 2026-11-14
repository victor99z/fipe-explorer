import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ChevronLeft, ChevronRight, Check, X, 
  ChevronDown, SlidersHorizontal, RotateCcw, 
  Zap, Leaf, BatteryCharging, Fuel, TrendingUp, TrendingDown, Info
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
}

export default function BudgetFinderView({ onSwitchTab: _onSwitchTab }: BudgetFinderViewProps) {
  // Budget inputs
  const [budgetValue, setBudgetValue] = useState<string>('80000');
  const [useSmartRange, setUseSmartRange] = useState<boolean>(true); // 80% to 100% of budget
  const [showAdvancedPricing, setShowAdvancedPricing] = useState<boolean>(false);
  const [minPrice, setMinPrice] = useState<string>('64000');
  const [maxPrice, setMaxPrice] = useState<string>('80000');

  // Filters
  const [motorizacao, setMotorizacao] = useState<string>('todos'); // 'todos', 'turbo', 'aspirado'
  const [cambio, setCambio] = useState<string>('todos'); // 'todos', 'automatico', 'manual'
  const [litragem, setLitragem] = useState<string>('todos'); // 'todos', '1.0', '1.4', etc.
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [searchModel, setSearchModel] = useState<string>('');
  const [minYear, setMinYear] = useState<string>('2018');
  const [maxYear, setMaxYear] = useState<string>('2026');
  const [combustivel, setCombustivel] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<string>('preco_desc');
  const [page, setPage] = useState<number>(1);

  // External data
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [availableEngines, setAvailableEngines] = useState<EngineSizeItem[]>([]);
  const [availableFuels, setAvailableFuels] = useState<FuelItem[]>([]);
  const [data, setData] = useState<VehicleSearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Brand dropdown state
  const [brandDropdownOpen, setBrandDropdownOpen] = useState<boolean>(false);
  const [brandSearchTerm, setBrandSearchTerm] = useState<string>('');
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Modal vehicle history
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<Vehicle | null>(null);

  const parsePriceInput = (raw: string): string => raw.replace(/\D/g, '');

  const formatPriceInput = (val: string): string => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    const num = Number(digits);
    return Number.isNaN(num) ? '' : num.toLocaleString('pt-BR');
  };

  // Sync smart range when budget changes
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

  // Close brand dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target as Node)) {
        setBrandDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dynamic safe viewport positioning so brand popover never overflows left or right
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

  // Fetch brands, engine sizes and fuels on mount
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

  // Main search fetch
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
    <div className="w-full space-y-8 sm:space-y-12">
      
      {/* 1. HERO SECTION */}
      <section className="pt-4 sm:pt-12 pb-2 sm:pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Big Headline with Emerald Accent + CTAs */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#171717] dark:text-[#ededed] leading-[1.1] sm:leading-[1.08]" style={{ letterSpacing: '-0.04em' }}>
              Consulte no seu orçamento
              <span className="block text-[#3ecf8e]">
                Filtre carros na FIPE
              </span>
            </h1>

            {/* Action buttons below headline */}
            <div className="flex flex-wrap items-center gap-3 pt-1 sm:pt-2">
              <a
                href="#filtro-console"
                className="inline-flex items-center justify-center bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] font-medium text-sm px-4 py-2 sm:py-2.5 rounded-[6px] transition-colors shadow-xs"
              >
                Pesquisar veículos
              </a>
            </div>
          </div>

          {/* Right Column: Technical Explanatory Lead Text */}
          <div className="lg:col-span-5 pt-1 lg:pt-3">
            <p className="text-sm sm:text-lg text-[#707070] dark:text-[#a1a1aa] leading-relaxed">
              Descubra quais carros você pode comprar hoje com o seu valor disponível. Filtre instantaneamente mais de 9.4 milhões de registros FIPE por cilindrada do motor (1.0, 1.4, 2.0+), alimentação turbo e transmissão automática.
            </p>

            <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 text-xs text-[#707070] dark:text-[#a1a1aa] font-mono border-t border-[#ededed] dark:border-[#27272a] pt-3 sm:pt-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3ecf8e]" />
                <span>Base FIPEX 2026</span>
              </div>
              <div>DuckDB Query Engine</div>
              <div>9.42M rows</div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. THE CONSOLE CARD: Developer Studio / Query Builder Container */}
      <section id="filtro-console" className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] shadow-xs transition-colors">
        
        {/* Console Header Bar */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 bg-[#fafafa] dark:bg-[#121212] border-b border-[#ededed] dark:border-[#27272a] rounded-t-xl flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3ecf8e]" />
            <span className="text-xs font-mono font-medium text-[#171717] dark:text-[#ededed]">fipex query builder</span>
            <span className="text-[11px] text-[#9a9a9a] dark:text-[#71717a] font-mono hidden xs:inline">--type=carro</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <button
              type="button"
              aria-pressed={useSmartRange}
              onClick={() => {
                const next = !useSmartRange;
                setUseSmartRange(next);
                applyBudget(budgetValue, next);
              }}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-[4px] border transition-colors cursor-pointer text-[11px] sm:text-xs ${
                useSmartRange 
                  ? 'border-[#3ecf8e] bg-[#ffffff] dark:bg-[#18181b] text-[#171717] dark:text-[#ededed] font-medium' 
                  : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${useSmartRange ? 'bg-[#3ecf8e]' : 'bg-[#dfdfdf] dark:bg-[#3f3f46]'}`} aria-hidden="true" />
              <span className="hidden sm:inline">Faixa inteligente (80% a 100%)</span>
              <span className="sm:hidden">Faixa intel. (80-100%)</span>
            </button>

            <button
              type="button"
              aria-expanded={showAdvancedPricing}
              onClick={() => setShowAdvancedPricing(!showAdvancedPricing)}
              className="text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] flex items-center gap-1 transition-colors cursor-pointer text-[11px] sm:text-xs"
            >
              <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
              <span className="hidden sm:inline">{showAdvancedPricing ? 'Fechar ajuste' : 'Ajustar min/max'}</span>
              <span className="sm:hidden">{showAdvancedPricing ? 'Fechar' : 'Ajustar'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] flex items-center gap-1 transition-colors cursor-pointer text-[11px] sm:text-xs"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Console Body: Input & Filters */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          
          {/* Main Budget Bar */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="budget-input" className="text-[11px] sm:text-xs font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                Orçamento Disponível
              </label>
              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center h-5 px-2 rounded-[4px] text-[11px] leading-none font-medium tabular-nums text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                  Faixa ativa:{' '}
                  {minPrice ? `R$ ${Number(minPrice).toLocaleString('pt-BR')}` : 'R$ 0'}
                  {' a '}
                  {maxPrice ? `R$ ${Number(maxPrice).toLocaleString('pt-BR')}` : 'sem teto'}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              <div className="relative flex-1 flex items-center rounded-[6px] bg-[#ffffff] dark:bg-[#121212] border border-[#dfdfdf] dark:border-[#27272a] px-3 py-1.5 shadow-xs focus-within:border-[#3ecf8e] dark:focus-within:border-[#3ecf8e] focus-within:ring-1 focus-within:ring-[#3ecf8e] transition-colors">
                <span className="text-sm font-medium text-[#707070] dark:text-[#a1a1aa] mr-2 select-none">R$</span>
                <input
                  id="budget-input"
                  type="text"
                  inputMode="numeric"
                  value={formatPriceInput(budgetValue)}
                  onChange={(e) => applyBudget(e.target.value)}
                  placeholder="Ex: 80.000"
                  className={`w-full bg-transparent text-[#171717] dark:text-[#ededed] font-semibold tabular-nums text-base sm:text-lg focus:outline-none focus-visible:outline-none placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] ${budgetValue ? 'pr-6' : ''}`}
                />
                {budgetValue && (
                  <button
                    type="button"
                    aria-label="Limpar orçamento"
                    onClick={() => applyBudget('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9a9a9a] dark:text-[#71717a] hover:text-[#171717] dark:hover:text-[#ededed] p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Quick shortcut pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[30000, 50000, 70000, 80000, 100000, 120000, 150000, 200000, 300000].map((val) => {
                  const isActive = Number(budgetValue) === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => applyBudget(val.toString())}
                      className={`h-8 px-2.5 text-xs tabular-nums rounded-[4px] border transition-colors focus:outline-none cursor-pointer inline-flex items-center justify-center ${
                        isActive 
                          ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] border-[#171717] dark:border-[#3ecf8e] font-medium' 
                          : 'bg-[#ffffff] dark:bg-[#121212] hover:bg-[#fafafa] dark:hover:bg-[#27272a] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                      }`}
                    >
                      {(val / 1000).toFixed(0)}k
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsible Manual Price Tuning */}
            {showAdvancedPricing && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-[6px] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] mt-2">
                <div>
                  <label htmlFor="min-price-input" className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] mb-1">Preço Mínimo (R$)</label>
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
                  <label htmlFor="max-price-input" className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] mb-1">Preço Máximo (R$)</label>
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

          <div className="border-t border-[#ededed] dark:border-[#27272a]" />

          {/* Propulsão & Combustível */}
          <div className="space-y-2">
            <div className="flex items-center justify-between h-5">
              <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider block">
                Propulsão / Combustível
              </label>
              {combustivel !== 'todos' && (
                <button 
                  type="button"
                  onClick={() => { setCombustivel('todos'); setPage(1); }}
                  className="text-[11px] text-[#171717] dark:text-[#ededed] underline hover:text-[#707070] dark:hover:text-[#a1a1aa] focus:outline-none cursor-pointer whitespace-nowrap"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* 1. Todos os Combustíveis (Padrão) */}
              <button
                type="button"
                aria-pressed={combustivel === 'todos' || combustivel === ''}
                onClick={() => { setCombustivel('todos'); setPage(1); }}
                className={`h-8 px-3 rounded-[6px] text-xs transition-colors inline-flex items-center justify-center focus:outline-none cursor-pointer ${
                  combustivel === 'todos' || combustivel === ''
                    ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium'
                    : 'bg-[#ffffff] dark:bg-[#18181b] hover:bg-[#fafafa] dark:hover:bg-[#27272a] text-[#171717] dark:text-[#ededed] border border-[#dfdfdf] dark:border-[#27272a]'
                }`}
              >
                Todos
              </button>

              {/* 2. Flex & Gasolina */}
              <button
                type="button"
                aria-pressed={combustivel === 'flex,gasolina'}
                onClick={() => { setCombustivel('flex,gasolina'); setPage(1); }}
                className={`h-8 px-3 rounded-[6px] text-xs transition-colors inline-flex items-center gap-1.5 justify-center focus:outline-none cursor-pointer ${
                  combustivel === 'flex,gasolina'
                    ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium'
                    : 'bg-[#ffffff] dark:bg-[#18181b] hover:bg-[#fafafa] dark:hover:bg-[#27272a] text-[#171717] dark:text-[#ededed] border border-[#dfdfdf] dark:border-[#27272a]'
                }`}
              >
                <span>Flex & Gasolina</span>
              </button>

              {/* 3. Híbridos & Elétricos (Destaque Especial) */}
              <button
                type="button"
                aria-pressed={combustivel === 'hibrido_eletrico'}
                onClick={() => { setCombustivel('hibrido_eletrico'); setPage(1); }}
                className={`h-8 px-3 rounded-[6px] text-xs transition-colors inline-flex items-center gap-1.5 justify-center focus:outline-none cursor-pointer border ${
                  combustivel === 'hibrido_eletrico'
                    ? 'bg-[#3ecf8e] text-[#171717] border-[#3ecf8e] font-semibold shadow-xs'
                    : 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-medium'
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Híbridos & Elétricos</span>
              </button>

              {/* 4. Apenas Híbrido */}
              <button
                type="button"
                aria-pressed={combustivel === 'hibrido'}
                onClick={() => { setCombustivel('hibrido'); setPage(1); }}
                className={`h-8 px-3 rounded-[6px] text-xs transition-colors inline-flex items-center gap-1.5 justify-center focus:outline-none cursor-pointer ${
                  combustivel === 'hibrido'
                    ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium'
                    : 'bg-[#ffffff] dark:bg-[#18181b] hover:bg-[#fafafa] dark:hover:bg-[#27272a] text-[#171717] dark:text-[#ededed] border border-[#dfdfdf] dark:border-[#27272a]'
                }`}
              >
                <Leaf className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                <span>Híbrido</span>
              </button>

              {/* 5. Apenas Elétrico */}
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
                className={`h-8 px-3 rounded-[6px] text-xs transition-colors inline-flex items-center gap-1.5 justify-center focus:outline-none cursor-pointer ${
                  combustivel === 'eletrico'
                    ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium'
                    : 'bg-[#ffffff] dark:bg-[#18181b] hover:bg-[#fafafa] dark:hover:bg-[#27272a] text-[#171717] dark:text-[#ededed] border border-[#dfdfdf] dark:border-[#27272a]'
                }`}
              >
                <BatteryCharging className="w-3.5 h-3.5 text-cyan-500 shrink-0" aria-hidden="true" />
                <span>Elétrico</span>
              </button>

              {/* 6. Dropdown Outros */}
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
                      onClick={() => setIsOpen(!isOpen)}
                      className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-[6px] text-xs transition-colors border cursor-pointer focus:outline-none ${
                        isOpen
                          ? 'border-[#3ecf8e] text-[#171717] dark:text-[#ededed] bg-[#ffffff] dark:bg-[#18181b] shadow-xs'
                          : isOtherSelected
                          ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] border-[#171717] dark:border-[#3ecf8e] font-medium'
                          : 'border-[#dfdfdf] dark:border-[#27272a] text-[#707070] dark:text-[#a1a1aa] bg-[#ffffff] dark:bg-[#121212] hover:bg-[#fafafa] dark:hover:bg-[#27272a]'
                      }`}
                    >
                      <span className="capitalize">{isOtherSelected ? combustivel : '+ Outros'}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180 text-[#3ecf8e]' : ''}`} />
                    </button>
                  );
                }}
              />
            </div>
          </div>

          {combustivel !== 'eletrico' && (
            <>
              <div className="border-t border-[#ededed] dark:border-[#27272a]" />

              {/* Technical Filters: Litragem, Alimentação, Câmbio */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Cilindrada do Motor */}
            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between h-5">
                <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Cilindrada do Motor
                </label>
                {litragem !== 'todos' && (
                  <button 
                    type="button"
                    onClick={() => { setLitragem('todos'); setPage(1); }}
                    className="text-[11px] text-[#171717] dark:text-[#ededed] underline hover:text-[#707070] dark:hover:text-[#a1a1aa] focus:outline-none cursor-pointer"
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
                      className={`h-8 px-3 rounded-[6px] text-xs tabular-nums transition-colors inline-flex items-center justify-center focus:outline-none cursor-pointer ${
                        isSelected
                          ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium'
                          : 'bg-[#ffffff] dark:bg-[#18181b] hover:bg-[#fafafa] dark:hover:bg-[#27272a] text-[#171717] dark:text-[#ededed] border border-[#dfdfdf] dark:border-[#27272a]'
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
                        onClick={() => setIsOpen(!isOpen)}
                        className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-[6px] text-xs transition-colors border cursor-pointer focus:outline-none ${
                          isOpen
                            ? 'border-[#3ecf8e] text-[#171717] dark:text-[#ededed] bg-[#ffffff] dark:bg-[#18181b] shadow-xs'
                            : isOtherSelected
                            ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] border-[#171717] dark:border-[#3ecf8e] font-medium'
                            : 'border-[#dfdfdf] dark:border-[#27272a] text-[#707070] dark:text-[#a1a1aa] bg-[#ffffff] dark:bg-[#121212] hover:bg-[#fafafa] dark:hover:bg-[#27272a]'
                        }`}
                      >
                        <span>{isOtherSelected ? `Motor ${litragem}` : '+ Outras'}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180 text-[#3ecf8e]' : ''}`} />
                      </button>
                    );
                  }}
                />
              </div>
            </div>

            {/* Alimentação (Turbo vs Aspirado) */}
            <div className="lg:col-span-3 space-y-2">
              <div className="flex items-center h-5">
                <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider block">
                  Alimentação
                </label>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-[#fafafa] dark:bg-[#121212] p-1 rounded-[6px] border border-[#ededed] dark:border-[#27272a]">
                <button
                  type="button"
                  aria-pressed={motorizacao === 'todos'}
                  onClick={() => { setMotorizacao('todos'); setPage(1); }}
                  className={`py-1.5 text-xs rounded-[4px] transition-colors focus:outline-none cursor-pointer ${
                    motorizacao === 'todos' 
                      ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium shadow-xs' 
                      : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  aria-pressed={motorizacao === 'turbo'}
                  onClick={() => { setMotorizacao('turbo'); setPage(1); }}
                  className={`py-1.5 text-xs rounded-[4px] transition-colors focus:outline-none cursor-pointer ${
                    motorizacao === 'turbo' 
                      ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium shadow-xs' 
                      : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                  }`}
                >
                  Turbo
                </button>
                <button
                  type="button"
                  aria-pressed={motorizacao === 'aspirado'}
                  onClick={() => { setMotorizacao('aspirado'); setPage(1); }}
                  className={`py-1.5 text-xs rounded-[4px] transition-colors focus:outline-none cursor-pointer ${
                    motorizacao === 'aspirado' 
                      ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium shadow-xs' 
                      : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                  }`}
                >
                  Aspirado
                </button>
              </div>
            </div>

            {/* Câmbio */}
            <div className="lg:col-span-3 space-y-2">
              <div className="flex items-center h-5">
                <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider block">
                  Transmissão
                </label>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-[#fafafa] dark:bg-[#121212] p-1 rounded-[6px] border border-[#ededed] dark:border-[#27272a]">
                <button
                  type="button"
                  aria-pressed={cambio === 'todos'}
                  onClick={() => { setCambio('todos'); setPage(1); }}
                  className={`py-1.5 text-xs rounded-[4px] transition-colors focus:outline-none cursor-pointer ${
                    cambio === 'todos' 
                      ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium shadow-xs' 
                      : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  aria-pressed={cambio === 'automatico'}
                  onClick={() => { setCambio('automatico'); setPage(1); }}
                  className={`py-1.5 text-xs rounded-[4px] transition-colors focus:outline-none cursor-pointer ${
                    cambio === 'automatico' 
                      ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium shadow-xs' 
                      : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                  }`}
                >
                  Automático
                </button>
                <button
                  type="button"
                  aria-pressed={cambio === 'manual'}
                  onClick={() => { setCambio('manual'); setPage(1); }}
                  className={`py-1.5 text-xs rounded-[4px] transition-colors focus:outline-none cursor-pointer ${
                    cambio === 'manual' 
                      ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium shadow-xs' 
                      : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

          </div>
            </>
          )}

          <div className="border-t border-[#ededed] dark:border-[#27272a]" />

          {/* Marcas, Modelo e Ano */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Marcas */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between h-5">
                <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Marcas
                  {selectedBrands.length > 0 && (
                    <span className="ml-1 text-[#15803d] dark:text-[#3ecf8e] font-semibold tabular-nums">({selectedBrands.length})</span>
                  )}
                </label>
                {selectedBrands.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => { setSelectedBrands([]); setPage(1); }}
                    className="text-[11px] text-[#171717] dark:text-[#ededed] underline hover:text-[#707070] dark:hover:text-[#a1a1aa] cursor-pointer"
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
                      className={`h-8 px-2.5 rounded-[6px] text-xs transition-colors inline-flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer ${
                        isSelected
                          ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium'
                          : 'bg-[#fafafa] dark:bg-[#121212] hover:bg-[#efefef] dark:hover:bg-[#27272a] text-[#171717] dark:text-[#ededed] border border-[#ededed] dark:border-[#27272a]'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-[3px] bg-[#ffffff] border border-black/5 flex items-center justify-center p-[1px] shrink-0">
                        <BrandLogo brand={brand} size="xs" iconClassName="text-[#171717]" />
                      </span>
                      <span>{brand.split(' - ')[0]}</span>
                    </button>
                  );
                })}

                <div className="relative inline-block" ref={brandDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setBrandDropdownOpen(!brandDropdownOpen);
                      if (!brandDropdownOpen) setBrandSearchTerm('');
                    }}
                    className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-[6px] text-xs transition-colors border cursor-pointer focus:outline-none ${
                      brandDropdownOpen
                        ? 'border-[#3ecf8e] text-[#171717] dark:text-[#ededed] bg-[#ffffff] dark:bg-[#18181b] shadow-xs'
                        : 'border-[#dfdfdf] dark:border-[#27272a] text-[#707070] dark:text-[#a1a1aa] bg-[#ffffff] dark:bg-[#121212] hover:bg-[#fafafa] dark:hover:bg-[#27272a]'
                    }`}
                  >
                    <span>+ Todas</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${brandDropdownOpen ? 'rotate-180 text-[#3ecf8e]' : ''}`} />
                  </button>

                  {brandDropdownOpen && (
                    <div
                      style={brandDropdownStyle}
                      className="absolute top-full mt-2 bg-[#ffffff] dark:bg-[#18181b] border border-[#dfdfdf] dark:border-[#27272a] rounded-[8px] shadow-2xl z-50 p-2.5 flex flex-col animate-in fade-in duration-100"
                    >
                      {/* Search input inside popover */}
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-[#9a9a9a] dark:text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Buscar marca..."
                          value={brandSearchTerm}
                          onChange={(e) => setBrandSearchTerm(e.target.value)}
                          className="h-8 w-full rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] pl-8 pr-7 text-xs text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e] dark:focus:border-[#3ecf8e] focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-[#3ecf8e] transition-colors"
                          autoFocus
                        />
                        {brandSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setBrandSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9a9a9a] dark:text-[#71717a] hover:text-[#171717] dark:hover:text-[#ededed] p-0.5 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Scrollable list of brands */}
                      <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                        {allBrands.filter(b => b.toLowerCase().includes(brandSearchTerm.toLowerCase())).length === 0 ? (
                          <div className="py-4 text-center text-xs text-[#707070] dark:text-[#a1a1aa]">
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
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[4px] text-xs text-left cursor-pointer transition-colors ${
                                    isSel 
                                      ? 'bg-[#fafafa] dark:bg-[#27272a] text-[#171717] dark:text-[#ededed] font-medium' 
                                      : 'text-[#707070] dark:text-[#a1a1aa] hover:bg-[#fafafa] dark:hover:bg-[#27272a] hover:text-[#171717] dark:hover:text-[#ededed]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 mr-2">
                                    <span className="w-5 h-5 rounded-[4px] bg-[#ffffff] border border-[#ededed] dark:border-[#3f3f46] p-0.5 flex items-center justify-center shrink-0">
                                      <BrandLogo brand={b} size="xs" iconClassName="text-[#171717]" />
                                    </span>
                                    <span className="truncate">{b}</span>
                                  </div>
                                  {isSel && <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" />}
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

            {/* Modelo */}
            <div className="lg:col-span-3 space-y-2">
              <div className="flex items-center h-5">
                <label htmlFor="model-search-input" className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider block">
                  Nome do Modelo
                </label>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9a9a9a] dark:text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9a9a9a] dark:text-[#71717a] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Ano */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center h-5">
                <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider block">
                  Ano a partir de
                </label>
              </div>
              <CustomDropdown
                value={minYear}
                onChange={(val) => { setMinYear(String(val)); setPage(1); }}
                className="w-full"
                menuClassName="w-full min-w-[160px]"
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

      {/* 3. BARRA DE RESULTADOS & ORDENAÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-[#171717] dark:text-[#ededed] tracking-tight tabular-nums">
            Veículos disponíveis até {formattedBudgetDisplay()}
          </h2>
          <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">
            {loading ? (
              'Consultando banco DuckDB...'
            ) : (
              <span><strong className="tabular-nums text-[#171717] dark:text-[#ededed]">{(data?.total_encontrados || 0).toLocaleString('pt-BR')}</strong> modelos encontrados dentro dos critérios</span>
            )}
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2">
          <span className="text-xs text-[#707070] dark:text-[#a1a1aa] whitespace-nowrap">Ordenar por:</span>
          <CustomDropdown
            value={ordenacao}
            onChange={(val) => { setOrdenacao(String(val)); setPage(1); }}
            className="w-44 sm:w-48"
            menuClassName="w-52"
            align="right"
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

      {/* 4. GRID DE CARDS DOS CARROS: Exact Supabase Feature Card Design */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 sm:h-56 rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] animate-pulse p-3.5 sm:p-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-4 bg-[#ededed] dark:bg-[#27272a] rounded w-1/4" />
                <div className="h-5 bg-[#ededed] dark:bg-[#27272a] rounded w-3/4" />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="h-4 bg-[#ededed] dark:bg-[#27272a] rounded" />
                  <div className="h-4 bg-[#ededed] dark:bg-[#27272a] rounded" />
                  <div className="h-4 bg-[#ededed] dark:bg-[#27272a] rounded" />
                  <div className="h-4 bg-[#ededed] dark:bg-[#27272a] rounded" />
                </div>
              </div>
              <div className="h-7 bg-[#ededed] dark:bg-[#27272a] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#18181b] text-center">
          <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">{error}</p>
          <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-3">
            Restaurar filtros
          </Button>
        </div>
      ) : data?.resultados?.length === 0 ? (
        <div className="p-12 rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#18181b] text-center space-y-2">
          <p className="text-sm font-medium text-[#171717] dark:text-[#ededed]">Nenhum veículo encontrado</p>
          <p className="text-xs text-[#707070] dark:text-[#a1a1aa] max-w-sm mx-auto">
            Não encontramos veículos correspondentes aos filtros selecionados. Tente expandir a faixa de valor ou remover filtros específicos.
          </p>
          <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2">
            Limpar filtros
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
          {data?.resultados?.map((car) => {
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
                className="group relative rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] hover:border-[#3ecf8e]/60 dark:hover:border-[#3ecf8e]/50 transition-all p-3.5 sm:p-5 flex flex-col justify-between shadow-xs hover:shadow-sm cursor-pointer"
              >
                <div>
                  {/* Card Header (Icon + Title, just like Supabase feature card) */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-[6px] bg-[#ffffff] dark:bg-[#f4f4f5] border border-[#ededed] dark:border-[#3f3f46] p-1 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <BrandLogo brand={car.nome_marca} size="md" iconClassName="text-[#171717]" />
                      </div>
                      <span className="text-xs font-medium text-[#707070] dark:text-[#a1a1aa] truncate leading-none">
                        {car.nome_marca}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1 flex-shrink-0">
                      {isElectric && (
                        <span className="inline-flex items-center gap-1 h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60">
                          <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Elétrico
                        </span>
                      )}
                      {!isElectric && car.nome_combustivel === 'Híbrido' && (
                        <span className="inline-flex items-center gap-1 h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-semibold text-emerald-600 dark:text-[#3ecf8e] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                          <Leaf className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Híbrido
                        </span>
                      )}
                      {car.nota_pbe && (
                        <span
                          title={`Nota PBEV INMETRO: ${car.nota_pbe}${car.match_consumo === 'conjunto_mecanico' ? ' (estimado pelo conjunto mecânico)' : ''}`}
                          className={`inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-semibold border ${
                            car.nota_pbe === 'A'
                              ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                              : car.nota_pbe === 'B'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : car.nota_pbe === 'C'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#ededed] dark:border-[#27272a]'
                          }`}
                        >
                          PBE {car.nota_pbe}
                        </span>
                      )}
                      <span className="inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] font-mono text-[10px] sm:text-[11px] leading-none text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                        {car.codigo_fipe}
                      </span>
                      {car.ano_modelo && (
                        <span className="inline-flex items-center h-5 sm:h-[22px] px-1.5 rounded-[4px] text-[10px] sm:text-[11px] leading-none font-medium tabular-nums text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                          {car.ano_modelo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Model Title */}
                  <h3 className="text-sm sm:text-base font-semibold text-[#171717] dark:text-[#ededed] tracking-tight leading-snug line-clamp-2 mt-1.5 mb-2.5 sm:mb-3">
                    {car.nome_modelo}
                  </h3>

                  {isElectric ? (
                    hasElectricMetrics ? (
                      <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 mb-3 sm:mb-4 text-xs text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] p-2.5 rounded-[6px] border border-[#ededed] dark:border-[#27272a]">
                        {car.autonomia_km != null && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <BatteryCharging className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate text-[#171717] dark:text-[#ededed] font-medium tabular-nums">
                              Autonomia {car.autonomia_km.toLocaleString('pt-BR')} km
                            </span>
                          </div>
                        )}

                        {car.consumo_urbano_eletrico != null && (
                          <div
                            className="flex items-center gap-1.5 min-w-0"
                            title={`Consumo energético cidade${car.consumo_rodoviario_eletrico != null ? ' / estrada' : ''} (INMETRO PBEV): ${car.consumo_urbano_eletrico.toFixed(1).replace('.', ',')}${car.consumo_rodoviario_eletrico != null ? ` / ${car.consumo_rodoviario_eletrico.toFixed(1).replace('.', ',')}` : ''} km/le`}
                          >
                            <Zap className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                            <span className="truncate text-[#171717] dark:text-[#ededed] font-medium tabular-nums">
                              {car.consumo_urbano_eletrico.toFixed(1).replace('.', ',')}
                              {car.consumo_rodoviario_eletrico != null
                                ? ` / ${car.consumo_rodoviario_eletrico.toFixed(1).replace('.', ',')}`
                                : ''}{' '}
                              km/le
                            </span>
                          </div>
                        )}

                        {car.eficiencia_mj_km != null && (
                          <div
                            className="flex items-center gap-1.5 min-w-0"
                            title="Eficiência energética INMETRO PBEV"
                          >
                            <Leaf className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                            <span className="truncate text-[#171717] dark:text-[#ededed] font-medium tabular-nums">
                              {car.eficiencia_mj_km.toFixed(2).replace('.', ',')} MJ/km
                            </span>
                          </div>
                        )}

                        {car.autonomia_km == null && (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <BatteryCharging className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" aria-hidden="true" />
                            <span className="truncate text-[#171717] dark:text-[#ededed] font-medium">
                              Propulsão Elétrica
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 min-w-0">
                          <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                          <span className="truncate text-[#171717] dark:text-[#ededed]">
                            {electricSpec || 'Zero Emissões (BEV)'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 mb-3 sm:mb-4 text-xs text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] p-2.5 rounded-[6px] border border-[#ededed] dark:border-[#27272a]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Zap className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate text-[#171717] dark:text-[#ededed] font-medium">
                            Propulsão Elétrica
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                          <span className="truncate text-[#171717] dark:text-[#ededed]">
                            {electricSpec || 'Zero Emissões (BEV)'}
                          </span>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      {/* Supabase-style Compact 2x2 Specs Grid */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mb-3 sm:mb-4 text-xs text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] p-2.5 rounded-[6px] border border-[#ededed] dark:border-[#27272a]">
                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3 h-3 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                          <span className="truncate text-[#171717] dark:text-[#ededed] font-medium">
                            {car.litragem ? `Motor ${car.litragem}L` : 'Motor N/D'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3 h-3 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                          <span className="truncate text-[#171717] dark:text-[#ededed]">
                            {car.is_automatico ? 'Automático' : 'Manual'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3 h-3 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                          <span className="truncate text-[#171717] dark:text-[#ededed]">
                            {car.is_turbo ? 'Turbo' : 'Aspirado'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 truncate">
                          <Check className="w-3 h-3 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                          <span className={`truncate ${car.nome_combustivel === 'Híbrido' ? 'font-medium text-[#171717] dark:text-[#ededed]' : ''}`}>
                            {car.nome_combustivel || 'Flex'}
                          </span>
                        </div>
                      </div>

                      {(car.consumo_urbano_gasolina != null || car.consumo_urbano_etanol != null || car.consumo_urbano_eletrico != null) && (
                        <div className="mb-3 sm:mb-4 px-2.5 py-2 rounded-[6px] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] space-y-1">
                          {car.consumo_urbano_gasolina != null && (
                            <div className="flex items-center gap-1.5">
                              <Fuel className="w-3 h-3 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                              <span className="text-[#171717] dark:text-[#ededed] font-medium tabular-nums text-[11px] sm:text-xs">
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
                              <Fuel className="w-3 h-3 text-[#707070] dark:text-[#a1a1aa] flex-shrink-0" aria-hidden="true" />
                              <span className="text-[#707070] dark:text-[#a1a1aa] font-medium tabular-nums text-[11px] sm:text-xs">
                                Etanol: {car.consumo_urbano_etanol.toFixed(1).replace('.', ',')} cid
                                {car.consumo_rodoviario_etanol != null
                                  ? ` / ${car.consumo_rodoviario_etanol.toFixed(1).replace('.', ',')} est km/l`
                                  : ' km/l'}
                              </span>
                            </div>
                          )}
                          {car.consumo_urbano_eletrico != null && (
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-[#3ecf8e] flex-shrink-0" aria-hidden="true" />
                              <span className="text-[#171717] dark:text-[#ededed] font-medium tabular-nums text-[11px] sm:text-xs">
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

                {/* Bottom Row: Price & Action */}
                <div className="pt-2.5 sm:pt-3.5 border-t border-[#ededed] dark:border-[#27272a] flex items-end justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-medium tracking-wider text-[#9a9a9a] dark:text-[#71717a] block leading-none mb-1">
                      Tabela FIPE
                    </span>
                    <span className="text-lg sm:text-xl font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed] block leading-tight">
                      {car.valor_formatado}
                    </span>

                    {hasDevaluation && (
                      <div
                        className="group/tooltip relative inline-flex items-center gap-1 mt-0.5 text-[11px] tabular-nums cursor-help rounded-[4px] focus:outline-none"
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
                        {isPositive ? (
                          <span className="inline-flex items-center gap-0.5 text-[#15803d] dark:text-[#3ecf8e] font-medium">
                            <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
                            +{Number(car.variacao_pct).toFixed(2).replace('.', ',')}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[#707070] dark:text-[#a1a1aa] font-medium">
                            <TrendingDown className="w-3 h-3 shrink-0" aria-hidden="true" />
                            {Number(car.variacao_pct).toFixed(2).replace('.', ',')}%
                          </span>
                        )}
                        <span className="text-[#9a9a9a] dark:text-[#71717a] text-[10px] underline decoration-dotted decoration-[#c7c7c7] dark:decoration-[#52525b] underline-offset-2">
                          no período
                        </span>
                        <Info
                          className="w-3 h-3 text-[#9a9a9a] dark:text-[#71717a] group-hover/tooltip:text-[#3ecf8e] group-focus-within/tooltip:text-[#3ecf8e] transition-colors shrink-0"
                          aria-hidden="true"
                        />

                        {/* Calculation Breakdown Tooltip */}
                        <div
                          id={variacaoTooltipId}
                          role="tooltip"
                          className="pointer-events-none opacity-0 invisible group-hover/tooltip:pointer-events-auto group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:pointer-events-auto group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible transition-opacity duration-150 absolute bottom-full left-0 mb-2 w-64 z-30 rounded-[8px] border border-[#dfdfdf] dark:border-[#3f3f46] bg-[#ffffff] dark:bg-[#1c1c1f] p-3 shadow-xl text-left text-[11px] leading-snug text-[#171717] dark:text-[#ededed] after:content-[''] after:absolute after:top-full after:left-0 after:w-full after:h-2"
                        >
                          <p className="font-semibold text-[11px] text-[#171717] dark:text-[#ededed] mb-1.5">
                            Cálculo da Variação FIPE
                          </p>
                          <div className="space-y-1 text-[11px] tabular-nums">
                            <div className="flex items-center justify-between gap-2 text-[#707070] dark:text-[#a1a1aa]">
                              <span>1º registro na FIPE:</span>
                              <span className="font-medium text-[#171717] dark:text-[#ededed]">
                                {car.valor_inicial_formatado || 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[#707070] dark:text-[#a1a1aa]">
                              <span>Preço atual ({car.periodo_referencia}):</span>
                              <span className="font-medium text-[#171717] dark:text-[#ededed]">
                                {car.valor_formatado}
                              </span>
                            </div>
                            {diffRsFormatted && (
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#ededed] dark:border-[#27272a]">
                                <span className="text-[#707070] dark:text-[#a1a1aa]">Diferença acumulada:</span>
                                <span className={`font-semibold ${isPositive ? 'text-[#15803d] dark:text-[#3ecf8e]' : 'text-[#171717] dark:text-[#ededed]'}`}>
                                  {diffRsFormatted} ({isPositive ? '+' : ''}{Number(car.variacao_pct).toFixed(2).replace('.', ',')}%)
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="mt-2 pt-1.5 border-t border-[#ededed] dark:border-[#27272a] text-[10px] text-[#9a9a9a] dark:text-[#71717a] font-mono">
                            Fórmula: ((Atual − Inicial) ÷ Inicial) × 100
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVehicleForHistory(car);
                    }}
                    className="text-xs h-8 px-3 font-medium flex-shrink-0 group-hover:border-[#171717] dark:group-hover:border-[#3ecf8e] group-hover:text-[#171717] dark:group-hover:text-[#3ecf8e] transition-colors cursor-pointer"
                  >
                    Ver Histórico
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. PAGINAÇÃO */}
      {data && data.total_paginas > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 pb-8">
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

          <span className="text-xs text-[#707070] dark:text-[#a1a1aa] px-3 font-medium tabular-nums">
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

      {/* Modal de Histórico */}
      {selectedVehicleForHistory && (
        <VehicleHistoryModal
          vehicle={selectedVehicleForHistory}
          onClose={() => setSelectedVehicleForHistory(null)}
        />
      )}

    </div>
  );
}
