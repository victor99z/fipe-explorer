import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, ChevronLeft, ChevronRight, Check, X, 
  ChevronDown, SlidersHorizontal, RotateCcw, 
  Car
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import CustomDropdown from './ui/custom-dropdown';
import VehicleHistoryModal from './VehicleHistoryModal';
import { Vehicle, VehicleSearchResponse, EngineSizeItem } from '../types/vehicle';
import { fetchBrands, fetchEngineSizes, fetchCars } from '../services/api';

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
  const [combustivel, setCombustivel] = useState<string>('');
  const [ordenacao, setOrdenacao] = useState<string>('preco_desc');
  const [page, setPage] = useState<number>(1);

  // External data
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [availableEngines, setAvailableEngines] = useState<EngineSizeItem[]>([]);
  const [data, setData] = useState<VehicleSearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Brand dropdown state
  const [brandDropdownOpen, setBrandDropdownOpen] = useState<boolean>(false);
  const [brandSearchTerm, setBrandSearchTerm] = useState<string>('');
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Modal vehicle history
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<Vehicle | null>(null);

  // Sync smart range when budget changes
  const applyBudget = (val: string, isSmart: boolean = useSmartRange) => {
    const num = Number(val);
    setBudgetValue(val);
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

  // Fetch brands and available engine sizes on mount
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [brands, engines] = await Promise.all([
          fetchBrands('carro'),
          fetchEngineSizes('carro')
        ]);
        setAllBrands(brands);
        setAvailableEngines(engines);
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
    setCombustivel('');
    setOrdenacao('preco_desc');
    setPage(1);
  };

  const formattedBudgetDisplay = (): string => {
    const num = Number(budgetValue);
    if (isNaN(num) || num <= 0) return 'R$ 0,00';
    return `R$ ${num.toLocaleString('pt-BR')}`;
  };

  return (
    <div className="w-full space-y-12">
      
      {/* 1. HERO SECTION */}
      <section className="pt-6 sm:pt-12 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Big Headline with Emerald Accent + CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#171717] dark:text-[#ededed] leading-[1.08]" style={{ letterSpacing: '-0.04em' }}>
              Consulte no seu orçamento
              <span className="block text-[#3ecf8e]">
                Filtre carros na FIPE
              </span>
            </h1>

            {/* Action buttons below headline */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#filtro-console"
                className="inline-flex items-center justify-center bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] font-medium text-sm px-4 py-2.5 rounded-[6px] transition-colors shadow-xs"
              >
                Pesquisar veículos
              </a>
            </div>
          </div>

          {/* Right Column: Technical Explanatory Lead Text */}
          <div className="lg:col-span-5 pt-2 lg:pt-3">
            <p className="text-base sm:text-lg text-[#707070] dark:text-[#a1a1aa] leading-relaxed">
              Descubra quais carros você pode comprar hoje com o seu valor disponível. Filtre instantaneamente mais de 9.4 milhões de registros FIPE por cilindrada do motor (1.0, 1.4, 2.0+), alimentação turbo e transmissão automática.
            </p>

            <div className="mt-6 flex items-center gap-6 text-xs text-[#707070] dark:text-[#a1a1aa] font-mono border-t border-[#ededed] dark:border-[#27272a] pt-4">
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
        <div className="px-5 py-3.5 bg-[#fafafa] dark:bg-[#121212] border-b border-[#ededed] dark:border-[#27272a] rounded-t-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3ecf8e]" />
            <span className="text-xs font-mono font-medium text-[#171717] dark:text-[#ededed]">fipex query builder</span>
            <span className="text-[11px] text-[#9a9a9a] dark:text-[#71717a] font-mono">--type=carro</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                const next = !useSmartRange;
                setUseSmartRange(next);
                applyBudget(budgetValue, next);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border transition-colors cursor-pointer ${
                useSmartRange 
                  ? 'border-[#3ecf8e] bg-[#ffffff] dark:bg-[#18181b] text-[#171717] dark:text-[#ededed] font-medium' 
                  : 'border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${useSmartRange ? 'bg-[#3ecf8e]' : 'bg-[#dfdfdf] dark:bg-[#3f3f46]'}`} />
              Faixa inteligente (80% a 100%)
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedPricing(!showAdvancedPricing)}
              className="text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{showAdvancedPricing ? 'Fechar ajuste' : 'Ajustar min/max'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Console Body: Input & Filters */}
        <div className="p-5 sm:p-6 space-y-6">
          
          {/* Main Budget Bar */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider block">
              Orçamento Disponível
            </label>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 flex items-center rounded-[6px] bg-[#ffffff] dark:bg-[#121212] border border-[#dfdfdf] dark:border-[#27272a] px-3 py-1.5 shadow-xs focus-within:border-[#3ecf8e] dark:focus-within:border-[#3ecf8e] focus-within:ring-1 focus-within:ring-[#3ecf8e] transition-colors">
                <span className="text-sm font-medium text-[#707070] dark:text-[#a1a1aa] mr-2">R$</span>
                <input
                  type="number"
                  step="5000"
                  min="5000"
                  max="2000000"
                  value={budgetValue}
                  onChange={(e) => applyBudget(e.target.value)}
                  placeholder="Ex: 80.000"
                  className="w-full bg-transparent text-[#171717] dark:text-[#ededed] font-medium text-lg focus:outline-none placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a]"
                />
              </div>

              {/* Quick shortcut pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[30000, 50000, 70000, 80000, 100000, 120000, 150000, 200000, 300000].map((val) => {
                  const isActive = Number(budgetValue) === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => applyBudget(val.toString())}
                      className={`px-2.5 py-1.5 text-xs rounded-[4px] border transition-colors focus:outline-none cursor-pointer ${
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
                  <label className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] mb-1">Preço Mínimo (R$)</label>
                  <Input
                    type="number"
                    step="5000"
                    placeholder="0"
                    value={minPrice}
                    onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] mb-1">Preço Máximo (R$)</label>
                  <Input
                    type="number"
                    step="5000"
                    placeholder="100.000"
                    value={maxPrice}
                    onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

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

              <div className="flex flex-wrap gap-1.5">
                {POPULAR_ENGINES.map((eng) => {
                  const isSelected = litragem === eng.id;
                  return (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => { setLitragem(eng.id); setPage(1); }}
                      className={`h-8 px-3 rounded-[6px] text-xs transition-colors inline-flex items-center justify-center focus:outline-none cursor-pointer ${
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
                  menuClassName="w-64"
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

          <div className="border-t border-[#ededed] dark:border-[#27272a]" />

          {/* Marcas, Modelo e Ano */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Marcas */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between h-5">
                <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                  Marcas
                  {selectedBrands.length > 0 && (
                    <span className="ml-1 text-[#171717] dark:text-[#ededed] font-mono">({selectedBrands.length})</span>
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
                {POPULAR_BRANDS.map((brand) => {
                  const isSelected = selectedBrands.includes(brand);
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => toggleBrand(brand)}
                      className={`h-8 px-2.5 rounded-[6px] text-xs transition-colors inline-flex items-center justify-center focus:outline-none cursor-pointer ${
                        isSelected
                          ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium'
                          : 'bg-[#fafafa] dark:bg-[#121212] hover:bg-[#efefef] dark:hover:bg-[#27272a] text-[#171717] dark:text-[#ededed] border border-[#ededed] dark:border-[#27272a]'
                      }`}
                    >
                      {brand.split(' - ')[0]}
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
                    <div className="absolute left-0 top-full mt-2 w-72 bg-[#ffffff] dark:bg-[#18181b] border border-[#dfdfdf] dark:border-[#27272a] rounded-[8px] shadow-2xl z-50 p-2.5 flex flex-col">
                      {/* Search input inside popover */}
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-[#9a9a9a] dark:text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Buscar marca..."
                          value={brandSearchTerm}
                          onChange={(e) => setBrandSearchTerm(e.target.value)}
                          className="h-8 w-full rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] pl-8 pr-7 text-xs text-[#171717] dark:text-[#ededed] placeholder:text-[#9a9a9a] dark:placeholder:text-[#71717a] focus:border-[#3ecf8e] dark:focus:border-[#3ecf8e] focus:outline-none focus:ring-1 focus:ring-[#3ecf8e] transition-colors"
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
                                  <span className="truncate mr-2">{b}</span>
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
                <label className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider block">
                  Nome do Modelo
                </label>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9a9a9a] dark:text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Ex: Polo, Civic, Onix..."
                  value={searchModel}
                  onChange={(e) => { setSearchModel(e.target.value); setPage(1); }}
                  className="pl-8 text-xs h-8"
                />
                {searchModel && (
                  <button 
                    type="button"
                    onClick={() => { setSearchModel(''); setPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9a9a9a] dark:text-[#71717a] hover:text-[#171717] dark:hover:text-[#ededed] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-lg font-medium text-[#171717] dark:text-[#ededed] tracking-tight">
            Veículos disponíveis até {formattedBudgetDisplay()}
          </h2>
          <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">
            {loading ? (
              'Consultando banco DuckDB...'
            ) : (
              <span><strong>{data?.total_encontrados || 0}</strong> modelos encontrados dentro dos critérios</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#707070] dark:text-[#a1a1aa]">Ordenar por:</span>
          <CustomDropdown
            value={ordenacao}
            onChange={(val) => { setOrdenacao(String(val)); setPage(1); }}
            className="w-48"
            menuClassName="w-52"
            align="right"
            options={[
              { value: 'preco_desc', label: 'Maior Preço (Teto)' },
              { value: 'preco_asc', label: 'Menor Preço' },
              { value: 'ano_desc', label: 'Ano Mais Novo' },
              { value: 'desvalorizacao_desc', label: 'Maior Desvalorização' },
              { value: 'desvalorizacao_asc', label: 'Menor Desvalorização' },
            ]}
          />
        </div>
      </div>

      {/* 4. GRID DE CARDS DOS CARROS: Exact Supabase Feature Card Design */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] animate-pulse p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-4 bg-[#ededed] dark:bg-[#27272a] rounded w-1/4" />
                <div className="h-5 bg-[#ededed] dark:bg-[#27272a] rounded w-3/4" />
                <div className="space-y-1.5 pt-2">
                  <div className="h-3 bg-[#ededed] dark:bg-[#27272a] rounded w-1/2" />
                  <div className="h-3 bg-[#ededed] dark:bg-[#27272a] rounded w-2/3" />
                  <div className="h-3 bg-[#ededed] dark:bg-[#27272a] rounded w-1/3" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.resultados?.map((car) => {
            const hasDevaluation = car.variacao_pct !== undefined && car.variacao_pct !== null;
            const isPositive = (car.variacao_pct ?? 0) >= 0;

            return (
              <div
                key={`${car.codigo_fipe}-${car.ano_modelo}`}
                className="group relative rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] hover:border-[#dfdfdf] dark:hover:border-[#3f3f46] transition-all p-6 flex flex-col justify-between shadow-xs hover:shadow-sm"
              >
                <div>
                  {/* Card Header (Icon + Title, just like Supabase feature card) */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[6px] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] flex items-center justify-center flex-shrink-0">
                        <Car className="w-3.5 h-3.5 text-[#171717] dark:text-[#ededed]" />
                      </div>
                      <div>
                        <span className="text-xs font-mono text-[#707070] dark:text-[#a1a1aa] block leading-none">
                          {car.nome_marca}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[11px] text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                        {car.codigo_fipe}
                      </span>
                      {car.ano_modelo && (
                        <span className="text-[11px] font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                          {car.ano_modelo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Model Title */}
                  <h3 className="text-base font-medium text-[#171717] dark:text-[#ededed] tracking-tight leading-snug line-clamp-2 mt-2 mb-4">
                    {car.nome_modelo}
                  </h3>

                  {/* Supabase-style Checklist Specs */}
                  <div className="space-y-1.5 mb-6 text-xs text-[#707070] dark:text-[#a1a1aa]">
                    {car.litragem && (
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" />
                        <span className="text-[#171717] dark:text-[#ededed]">Cilindrada do motor: {car.litragem}L</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" />
                      <span className="text-[#171717] dark:text-[#ededed]">
                        Transmissão: {car.is_automatico ? 'Automática / CVT' : 'Manual'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" />
                      <span className="text-[#171717] dark:text-[#ededed]">
                        Alimentação: {car.is_turbo ? 'Turbo sobrealimentado' : 'Aspirado natural'}
                      </span>
                    </div>

                    {car.nome_combustivel && (
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#3ecf8e] flex-shrink-0" />
                        <span className="text-[#707070] dark:text-[#a1a1aa]">Combustível: {car.nome_combustivel}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Price & Action */}
                <div className="pt-4 border-t border-[#ededed] dark:border-[#27272a] flex items-end justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#9a9a9a] dark:text-[#71717a] block">
                      Tabela FIPE
                    </span>
                    <span className="text-xl font-medium text-[#171717] dark:text-[#ededed] tracking-tight block">
                      {car.valor_formatado}
                    </span>

                    {hasDevaluation && (
                      <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                        {isPositive ? (
                          <span className="text-[#15803d] dark:text-[#3ecf8e] font-medium">+{car.variacao_pct}%</span>
                        ) : (
                          <span className="text-[#707070] dark:text-[#a1a1aa]">{car.variacao_pct}%</span>
                        )}
                        <span className="text-[#9a9a9a] dark:text-[#71717a] text-[10px]">variação</span>
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVehicleForHistory(car)}
                    className="text-xs h-8 px-3 font-medium"
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
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Anterior
          </Button>

          <span className="text-xs text-[#707070] dark:text-[#a1a1aa] px-3 font-mono">
            {page} / {data.total_paginas}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.total_paginas}
            onClick={() => { setPage(p => Math.min(p + 1, data.total_paginas)); window.scrollTo({ top: 350, behavior: 'smooth' }); }}
            className="h-8 text-xs"
          >
            Próxima
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
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
