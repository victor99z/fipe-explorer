import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Calendar, Search, ArrowRight, TrendingUp, TrendingDown, 
  Sparkles, Filter, ChevronLeft, ChevronRight, Fuel, ShieldCheck, 
  Car, Flame, Gauge, Check, X, Plus, ChevronDown, LineChart as LineChartIcon, BarChart3, Layers, Award
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Separator } from './ui/separator';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function PriceSearchSection({ onSelectVehicleForAnalysis }) {
  const [targetBudget, setTargetBudget] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');
  const [tipoVeiculo, setTipoVeiculo] = useState('carro');
  const [motorizacao, setMotorizacao] = useState('todos');
  const [cambio, setCambio] = useState('todos');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [keywordSearch, setKeywordSearch] = useState('');
  const [ordenacao, setOrdenacao] = useState('preco_desc');
  const [page, setPage] = useState(1);

  const [brands, setBrands] = useState([]);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const brandDropdownRef = useRef(null);

  const [chartGroupby, setChartGroupby] = useState('mes'); // 'mes' or 'ano'
  const [chartVehicles, setChartVehicles] = useState([]); // Array of up to 3 vehicles [{codigo_fipe, ano_modelo, nome_marca, nome_modelo}]
  const [displayMode, setDisplayMode] = useState('lista'); // 'lista' or 'grid' (default to lista as requested)

  const [hasSearched, setHasSearched] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

  const [data, setData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExecuteSearch = () => {
    setPage(1);
    setHasSearched(true);
    setSearchTrigger(prev => prev + 1);
  };

  const toggleVehicleForChart = (car) => {
    const fipe = car.codigo_fipe;
    const ano = car.ano_modelo;
    const isSelected = chartVehicles.some(v => v.codigo_fipe === fipe && v.ano_modelo === ano);
    if (isSelected) {
      setChartVehicles(prev => prev.filter(v => !(v.codigo_fipe === fipe && v.ano_modelo === ano)));
    } else {
      if (chartVehicles.length >= 3) {
        alert("Você pode escolher no máximo 3 veículos para comparar no gráfico simultaneamente. Remova um veículo para adicionar este.");
        return;
      }
      setChartVehicles(prev => [...prev, {
        codigo_fipe: fipe,
        ano_modelo: ano,
        nome_marca: car.nome_marca,
        nome_modelo: car.nome_modelo
      }]);
    }
  };

  // Close brand dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
        setBrandDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch available brands
  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch(`/api/filters/brands?tipo_veiculo=${tipoVeiculo}`);
        if (res.ok) {
          const json = await res.json();
          setBrands(json);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBrands();
  }, [tipoVeiculo]);

  const setPresetBudget = (budget) => {
    setTargetBudget(budget);
    setMinPrice(Math.round(budget * 0.9));
    setMaxPrice(budget);
    setPage(1);
    setHasSearched(true);
    setSearchTrigger(prev => prev + 1);
  };

  const toggleBrand = (brandName) => {
    setSelectedBrands(prev => {
      if (prev.includes(brandName)) {
        return prev.filter(b => b !== brandName);
      } else {
        return [...prev, brandName];
      }
    });
  };

  const handleResetFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxYear('');
    setMotorizacao('todos');
    setCambio('todos');
    setSelectedBrands([]);
    setKeywordSearch('');
    setOrdenacao('preco_desc');
    setPage(1);
    setChartVehicles([]);
    setHasSearched(false);
    setData(null);
    setAnalyticsData(null);
  };

  // 1. Fetch main vehicle list results - ONLY runs when user executes search, changes page or sorting
  useEffect(() => {
    if (!hasSearched) return;

    async function fetchSearchResults() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          tipo_veiculo: tipoVeiculo,
          preco_min: minPrice || 0,
          preco_max: maxPrice || 1000000,
          ano_min: minYear || 1990,
          ano_max: maxYear || 2026,
          motorizacao: motorizacao,
          cambio: cambio,
          ordenacao: ordenacao,
          page: page,
          limit: 12
        });

        if (selectedBrands.length > 0) {
          queryParams.append('marcas', selectedBrands.join(','));
        }

        if (keywordSearch.trim()) {
          queryParams.append('search', keywordSearch.trim());
        }

        const resSearchResults = await fetch(`/api/search/by-price?${queryParams.toString()}`);

        if (!resSearchResults.ok) {
          throw new Error("Erro ao buscar veículos na faixa de preço.");
        }
        const jsonSearch = await resSearchResults.json();
        setData(jsonSearch);
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os veículos para estes filtros.");
      } finally {
        setLoading(false);
      }
    }

    fetchSearchResults();
  }, [hasSearched, searchTrigger, page, ordenacao]);

  // 2. Fetch chart comparison analytics - runs ONLY when chart selected vehicles or chart groupby changes
  useEffect(() => {
    if (!hasSearched) return;

    if (chartVehicles.length === 0) {
      setAnalyticsData(null);
      setChartLoading(false);
      return;
    }

    async function fetchChartAnalytics() {
      setChartLoading(true);
      try {
        const queryParams = new URLSearchParams({
          tipo_veiculo: tipoVeiculo,
          preco_min: minPrice || 0,
          preco_max: maxPrice || 1000000,
          ano_min: minYear || 1990,
          ano_max: maxYear || 2026,
          motorizacao: motorizacao,
          cambio: cambio,
          groupby: chartGroupby
        });

        if (selectedBrands.length > 0) {
          queryParams.append('marcas', selectedBrands.join(','));
        }
        if (keywordSearch.trim()) {
          queryParams.append('search', keywordSearch.trim());
        }

        const fipeAnosStr = chartVehicles.map(v => `${v.codigo_fipe}:${v.ano_modelo}`).join(',');
        queryParams.append('fipe_anos', fipeAnosStr);

        const resAnalytics = await fetch(`/api/search/analytics?${queryParams.toString()}`);
        if (resAnalytics.ok) {
          const jsonAnalytics = await resAnalytics.json();
          setAnalyticsData(jsonAnalytics);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setChartLoading(false);
      }
    }

    fetchChartAnalytics();
  }, [hasSearched, searchTrigger, chartGroupby, chartVehicles]);

  // Construct chart data ONLY for selected vehicles (no market average line)
  const buildChartData = () => {
    if (chartVehicles.length === 0 || !analyticsData) {
      return null;
    }

    let labels = [];
    if (analyticsData.serie_mensal_segmento && analyticsData.serie_mensal_segmento.length > 0) {
      labels = analyticsData.serie_mensal_segmento.map(pt => pt.periodo);
    } else if (analyticsData.comparativo_modelos && analyticsData.comparativo_modelos.length > 0) {
      const labelSet = new Set();
      analyticsData.comparativo_modelos.forEach(m => {
        m.pontos.forEach(p => labelSet.add(p.periodo));
      });
      labels = Array.from(labelSet);
    }

    if (labels.length === 0) return null;

    const pointRad = chartGroupby === 'mes' ? 0 : 5;
    const pointHoverRad = chartGroupby === 'mes' ? 7 : 8;
    
    // Only plot user-selected vehicles
    const datasets = [];
    const colors = ['#38bdf8', '#f43f5e', '#fb923c', '#a855f7', '#10b981'];
    if (analyticsData.comparativo_modelos && analyticsData.comparativo_modelos.length > 0) {
      analyticsData.comparativo_modelos.forEach((model, idx) => {
        const pointMap = new Map(model.pontos.map(p => [p.periodo, p.valor]));
        const modelData = labels.map(lbl => pointMap.get(lbl) || null);
        const color = colors[idx % colors.length];

        datasets.push({
          label: `${model.nome_modelo} (${model.variacao_pct >= 0 ? '+' : ''}${model.variacao_pct}%)`,
          data: modelData,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2.5,
          pointRadius: pointRad,
          pointHoverRadius: pointHoverRad,
          pointHitRadius: 12,
          tension: 0.35,
          fill: false,
        });
      });
    }

    if (datasets.length === 0) return null;

    return { labels, datasets };
  };

  const chartData = buildChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 },
          boxWidth: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#34d399',
        bodyColor: '#f8fafc',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          title: (items) => `Data FIPE: ${items[0]?.label}`,
          label: (context) => {
            const val = context.parsed.y;
            return `${context.dataset.label}: R$ ${val ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'N/A'}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { 
          color: '#94a3b8', 
          font: { family: 'Plus Jakarta Sans', size: 10 },
          maxTicksLimit: 14
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Plus Jakarta Sans', size: 10 },
          callback: (value) => 'R$ ' + (value / 1000).toFixed(0) + 'k'
        }
      }
    }
  };

  return (
    <div className="w-full mb-12">
      {/* Header Banner */}
      <Card className="mb-6 bg-slate-900/90 border-slate-800 shadow-2xl">
        <CardHeader className="p-6">
          <div className="max-w-4xl">
            <Badge variant="success" className="mb-3 px-3 py-1">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              <span>Painel Comparativo & Busca Avançada FIPE</span>
            </Badge>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Análise Comparativa & O que posso comprar?
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Filtre por orçamento, visualize a <strong>evolução gráfica por meses</strong> e acompanhe o <strong>ranking dos modelos mais e menos desvalorizados</strong>.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Main 2-Column Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: FILTROS DE BUSCA (Sidebar Panel) */}
        <Card className="lg:col-span-4 bg-slate-900/90 border-slate-800 shadow-2xl lg:sticky lg:top-4">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Filtros de Busca
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-slate-400 hover:text-emerald-400 p-0 h-auto"
              >
                Restaurar
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Atalhos de Orçamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Atalhos Rápidos de Orçamento:</label>
              <div className="flex flex-wrap gap-1.5">
                {[30000, 50000, 80000, 100000, 150000, 200000, 300000].map((budget) => (
                  <Button
                    key={budget}
                    type="button"
                    variant={targetBudget === budget && maxPrice === budget ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPresetBudget(budget)}
                    className="text-[11px] h-7 px-2.5"
                  >
                    Até {(budget / 1000).toFixed(0)}k
                  </Button>
                ))}
              </div>
            </div>

            {/* Preços */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Preço Mínimo (R$)</label>
                <Input
                  type="number"
                  step="5000"
                  placeholder="Mínimo"
                  className="text-xs h-9"
                  value={minPrice}
                  onChange={(e) => { setMinPrice(e.target.value !== '' ? Number(e.target.value) : ''); setPage(1); }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Preço Máximo (R$)</label>
                <Input
                  type="number"
                  step="5000"
                  placeholder="Máximo"
                  className="text-xs h-9"
                  value={maxPrice}
                  onChange={(e) => { setMaxPrice(e.target.value !== '' ? Number(e.target.value) : ''); setPage(1); }}
                />
              </div>
            </div>

            {/* Anos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Ano Mínimo</label>
                <Select
                  className="text-xs h-9"
                  value={minYear}
                  onChange={(e) => { setMinYear(e.target.value !== '' ? Number(e.target.value) : ''); setPage(1); }}
                >
                  <option value="">Qualquer ano</option>
                  {Array.from({ length: 30 }, (_, i) => 2026 - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Ano Máximo</label>
                <Select
                  className="text-xs h-9"
                  value={maxYear}
                  onChange={(e) => { setMaxYear(e.target.value !== '' ? Number(e.target.value) : ''); setPage(1); }}
                >
                  <option value="">Qualquer ano</option>
                  {Array.from({ length: 30 }, (_, i) => 2026 - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Motorização Turbo */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Motorização</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 items-center">
                <Button
                  type="button"
                  variant={motorizacao === 'todos' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setMotorizacao('todos'); setPage(1); }}
                  className="h-7 text-[11px]"
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant={motorizacao === 'turbo' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setMotorizacao('turbo'); setPage(1); }}
                  className={`h-7 text-[11px] ${motorizacao === 'turbo' ? 'bg-amber-600 hover:bg-amber-500' : ''}`}
                >
                  🔥 Turbo
                </Button>
                <Button
                  type="button"
                  variant={motorizacao === 'aspirado' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setMotorizacao('aspirado'); setPage(1); }}
                  className="h-7 text-[11px]"
                >
                  Aspirado
                </Button>
              </div>
            </div>

            {/* Câmbio */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>Transmissão / Câmbio</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 items-center">
                <Button
                  type="button"
                  variant={cambio === 'todos' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setCambio('todos'); setPage(1); }}
                  className="h-7 text-[11px]"
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant={cambio === 'automatico' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setCambio('automatico'); setPage(1); }}
                  className={`h-7 text-[11px] ${cambio === 'automatico' ? 'bg-cyan-600 hover:bg-cyan-500' : ''}`}
                >
                  Aut / CVT
                </Button>
                <Button
                  type="button"
                  variant={cambio === 'manual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setCambio('manual'); setPage(1); }}
                  className="h-7 text-[11px]"
                >
                  Manual
                </Button>
              </div>
            </div>

            {/* Marcas (Multisseleção) */}
            <div className="relative pt-2 border-t border-slate-800/80" ref={brandDropdownRef}>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex justify-between">
                <span>Filtrar por Marcas</span>
                {selectedBrands.length > 0 && (
                  <button onClick={() => { setSelectedBrands([]); setPage(1); }} className="text-[10px] text-emerald-400 hover:underline">Limpar</button>
                )}
              </label>
              <div 
                onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                className="flex h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 items-center justify-between cursor-pointer text-xs overflow-hidden"
              >
                <div className="truncate text-slate-200">
                  {selectedBrands.length === 0 ? (
                    <span className="text-slate-500">-- Todas as Marcas --</span>
                  ) : (
                    <span className="font-semibold text-emerald-400">{selectedBrands.length} marca(s)</span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>

              {brandDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 max-h-56 overflow-y-auto">
                  <div className="sticky top-0 bg-slate-950 pb-2 mb-2 border-b border-slate-800 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-500 ml-2" />
                    <Input
                      type="text"
                      placeholder="Buscar marca..."
                      className="h-8 text-xs border-none bg-transparent"
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                    />
                  </div>
                  {brands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase())).map((b) => {
                    const isSelected = selectedBrands.includes(b);
                    return (
                      <div
                        key={b}
                        onClick={() => toggleBrand(b)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-600/20 text-emerald-300 font-semibold' : 'text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <span>{b}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedBrands.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {selectedBrands.map(b => (
                    <Badge key={b} variant="success" className="text-[10px] px-2 py-0.5 flex items-center gap-1 font-medium">
                      {b}
                      <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => toggleBrand(b)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Busca Livre */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Busca Livre (Palavra-chave)</label>
              <Input
                type="text"
                placeholder="ex: suv, flex, 2.0..."
                className="text-xs h-9"
                value={keywordSearch}
                onChange={(e) => { setKeywordSearch(e.target.value); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleExecuteSearch(); }}
              />
            </div>

            {/* Botão Principal de Aplicação de Filtro / Busca */}
            <Button
              type="button"
              variant="default"
              onClick={handleExecuteSearch}
              className="w-full py-3 h-11 text-xs font-extrabold rounded-xl shadow-lg mt-2"
            >
              <Search className="w-4 h-4 mr-2 text-white" />
              <span>Buscar Veículos</span>
            </Button>
          </CardContent>
        </Card>

        {/* RIGHT COLUMN: MAIN CONTENT */}
        <div className="lg:col-span-8 space-y-6">
          {!hasSearched ? (
            /* Estado Inicial */
            <Card className="p-12 sm:p-16 border-slate-800 bg-slate-900/90 text-center flex flex-col items-center justify-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-extrabold text-white">Nenhum Filtro Aplicado</CardTitle>
                <CardDescription className="text-xs text-slate-400 max-w-md mx-auto">
                  Ajuste a faixa de orçamento, ano, combustível ou marca no painel ao lado e clique em <strong className="text-emerald-400">"Buscar Veículos"</strong> para listar as opções e comparar históricos!
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="default"
                size="lg"
                onClick={handleExecuteSearch}
                className="mt-2"
              >
                <Search className="w-4 h-4 mr-2" />
                <span>Buscar Veículos Agora</span>
              </Button>
            </Card>
          ) : (
            <>

          {/* ----------------------------------------------------------------------- */}
          {/* TOP BLOCK: GRAFICO COMPARATIVOS ENTRE MODELOS (Monthly Points Timeline) */}
          {/* ----------------------------------------------------------------------- */}
          {/* GRAFICO COMPARATIVO */}
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <LineChartIcon className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-base font-extrabold text-white">
                    Gráfico Comparativo entre Modelos {chartGroupby === 'mes' ? '(Pontos em Meses)' : '(Pontos por Ano)'}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  {chartGroupby === 'mes' 
                    ? 'Evolução mensal detalhada do preço FIPE médio do segmento comparado aos principais modelos.' 
                    : 'Evolução anual média consolidada do preço FIPE do segmento comparada aos modelos.'
                  }
                </CardDescription>
              </div>

              <div className="flex items-center gap-3">
                {/* Granularity Switcher */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <Button
                    type="button"
                    variant={chartGroupby === 'mes' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setChartGroupby('mes')}
                    className="h-7 text-xs font-extrabold"
                  >
                    📅 Por Mês
                  </Button>
                  <Button
                    type="button"
                    variant={chartGroupby === 'ano' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setChartGroupby('ano')}
                    className="h-7 text-xs font-extrabold"
                  >
                    📆 Por Ano
                  </Button>
                </div>

                {chartVehicles.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setChartVehicles([])}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                    >
                      Limpar Gráfico
                    </button>
                    <div className="hidden md:block bg-slate-950 border border-slate-800 px-3 py-1 rounded-xl text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Comparando</span>
                      <span className="text-sm font-extrabold text-emerald-400 font-mono-num">
                        {chartVehicles.length} de 3 Veículos
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4">

              {/* Canvas Box */}
              <div className="w-full h-72 sm:h-80 relative">
                {chartLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 rounded-xl z-20 backdrop-blur-xs">
                    <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-xs font-bold text-emerald-400">Atualizando gráfico comparativo...</span>
                  </div>
                )}
                {chartVehicles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                      <LineChartIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm mb-1">Nenhum veículo selecionado para o gráfico</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Clique no botão <strong className="text-emerald-400">+ Comparar</strong> em qualquer automóvel da lista abaixo para visualizar a evolução histórica!
                      </p>
                    </div>
                  </div>
                ) : chartData ? (
                  <Line data={chartData} options={chartOptions} />
                ) : !chartLoading ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                    Nenhum histórico disponível para os veículos selecionados.
                  </div>
                ) : null}
              </div>

              {chartVehicles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-400">
                    💡 <strong>Dica:</strong> {chartGroupby === 'mes' ? 'No modo Por Mês, passe o cursor sobre a linha para expandir o ponto exato e ver o valor.' : 'No modo Por Ano, os pontos exibem a média anual consolidada.'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LISTA DE VEÍCULOS ENCONTRADOS */}
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl space-y-6">
            <CardHeader className="pb-2 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Lista de Veículos Encontrados</span>
                    {data && (
                      <Badge variant="success" className="font-mono-num">
                        {data.total_encontrados}
                      </Badge>
                    )}
                  </CardTitle>
                </div>

                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <Button
                      type="button"
                      variant={displayMode === 'lista' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDisplayMode('lista')}
                      className="h-7 text-xs font-bold"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1" />
                      <span>Lista</span>
                    </Button>
                    <Button
                      type="button"
                      variant={displayMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDisplayMode('grid')}
                      className="h-7 text-xs font-bold"
                    >
                      <Award className="w-3.5 h-3.5 mr-1" />
                      <span>Grid</span>
                    </Button>
                  </div>

                  {/* Sort dropdown */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 hidden sm:inline">Ordenar:</span>
                    <Select
                      className="text-xs h-8 py-0"
                      value={ordenacao}
                      onChange={(e) => setOrdenacao(e.target.value)}
                    >
                      <option value="preco_desc">Maior Preço</option>
                      <option value="preco_asc">Menor Preço</option>
                      <option value="desvalorizacao_desc">📉 Maior Desvalorização (% Total)</option>
                      <option value="desvalorizacao_asc">📈 Menor Desvalorização / Valorização</option>
                      <option value="ano_desc">Ano Mais Recente</option>
                      <option value="ano_asc">Ano Mais Antigo</option>
                      <option value="modelo_asc">Nome do Modelo</option>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <div className="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs">Buscando opções no orçamento com DuckDB...</p>
                </div>
              ) : error ? (
                <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center text-rose-300 text-xs">
                  {error}
                </div>
              ) : data && data.resultados.length > 0 ? (
                <>
                  {displayMode === 'lista' ? (
                    <div className="space-y-2">
                      {data.resultados.map((car, idx) => {
                        const isChartSelected = chartVehicles.some(v => v.codigo_fipe === car.codigo_fipe && v.ano_modelo === car.ano_modelo);
                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 hover:bg-slate-950 ${
                              isChartSelected 
                                ? 'border-emerald-500 ring-1 ring-emerald-500/30 shadow-md' 
                                : 'border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="uppercase text-[10px]">
                                  {car.nome_marca}
                                </Badge>
                                <Badge variant="brand" className="text-[10px]">
                                  Ano {car.ano_modelo}
                                </Badge>
                                {car.variacao_pct !== undefined && car.variacao_pct !== null && (
                                  <Badge variant={car.variacao_pct >= 0 ? 'success' : 'destructive'} className="text-[10px]">
                                    {car.variacao_pct >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                                    {car.variacao_pct >= 0 ? `+${car.variacao_pct}%` : `${car.variacao_pct}%`}
                                  </Badge>
                                )}
                              </div>

                              <h4 className="text-xs sm:text-sm font-extrabold text-white hover:text-emerald-300 transition-colors truncate">
                                {car.nome_modelo}
                              </h4>

                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                                <Fuel className="w-3.5 h-3.5 text-slate-500" />
                                <span>{car.nome_combustivel || 'Flex'}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-[10px] text-slate-500 font-mono-num">FIPE: {car.codigo_fipe}</span>
                              </div>
                            </div>

                            <div className="sm:text-right shrink-0">
                              <span className="text-[9px] text-slate-400 block uppercase">Preço FIPE Atual</span>
                              <span className="text-base font-extrabold text-emerald-400 font-mono-num">
                                {car.valor_formatado}
                              </span>
                              {car.valor_inicial_formatado && (
                                <span className="text-[10px] text-slate-400 block">
                                  Inicial: {car.valor_inicial_formatado}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                              <button
                                type="button"
                              onClick={() => toggleVehicleForChart(car)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                                isChartSelected
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                              title="Comparar evolução no gráfico"
                            >
                              {isChartSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>No Gráfico</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                                  <span>+ Comparar</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onSelectVehicleForAnalysis({
                                codigo_fipe: car.codigo_fipe,
                                nome_marca: car.nome_marca,
                                nome_modelo: car.nome_modelo,
                                ano_modelo: car.ano_modelo,
                                search_term: null
                              })}
                              className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-sm border border-blue-400/30"
                              title="Analisar evolução histórica deste carro"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>Analisar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* ================= FORMATO GRID (CARDS) ================= */
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {data.resultados.map((car, idx) => {
                      const isChartSelected = chartVehicles.some(v => v.codigo_fipe === car.codigo_fipe && v.ano_modelo === car.ano_modelo);
                      return (
                        <div 
                          key={idx} 
                          className={`glass-panel p-4 rounded-xl transition-all flex flex-col justify-between group hover:-translate-y-0.5 shadow-md bg-slate-950/60 overflow-hidden ${
                            isChartSelected ? 'border-emerald-500/60 ring-1 ring-emerald-500/30' : 'border-slate-800 hover:border-emerald-500/40'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900 px-2 py-0.5 rounded border border-slate-800 truncate max-w-[120px]" title={car.nome_marca}>
                                {car.nome_marca}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {car.variacao_pct !== undefined && car.variacao_pct !== null && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                    car.variacao_pct >= 0 ? 'badge-up' : 'badge-down'
                                  }`}>
                                    {car.variacao_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {car.variacao_pct >= 0 ? `+${car.variacao_pct}%` : `${car.variacao_pct}%`}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                                  Ano {car.ano_modelo}
                                </span>
                              </div>
                            </div>

                            <h4 className="text-xs font-extrabold text-white group-hover:text-emerald-300 transition-colors line-clamp-2 mb-2 min-h-[2rem]">
                              {car.nome_modelo}
                            </h4>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3">
                              <Fuel className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>{car.nome_combustivel || 'Flex'}</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-[10px] text-slate-500 font-mono-num">{car.codigo_fipe}</span>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-800/80 flex flex-col gap-2 mt-auto">
                            <div>
                              <span className="text-[9px] text-slate-400 block uppercase tracking-wider">Preço FIPE</span>
                              <div className="flex items-baseline justify-between gap-1 flex-wrap">
                                <span className="text-base font-extrabold text-emerald-400 font-mono-num">
                                  {car.valor_formatado}
                                </span>
                                {car.valor_inicial_formatado && (
                                  <span className="text-[10px] text-slate-400 font-mono-num">
                                    Inicial: {car.valor_inicial_formatado}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/50 w-full">
                              <button
                                type="button"
                                onClick={() => toggleVehicleForChart(car)}
                                className={`flex-1 min-w-0 text-[11px] py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                                  isChartSelected
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                                title="Comparar evolução no gráfico"
                              >
                                {isChartSelected ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="truncate">No Gráfico</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">+ Comparar</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => onSelectVehicleForAnalysis({
                                  codigo_fipe: car.codigo_fipe,
                                  nome_marca: car.nome_marca,
                                  nome_modelo: car.nome_modelo,
                                  ano_modelo: car.ano_modelo,
                                  search_term: null
                                })}
                                className="flex-1 min-w-0 text-[11px] py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white shadow-sm border border-blue-400/30"
                                title="Analisar evolução histórica deste carro"
                              >
                                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Analisar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination Controls */}
                {data.total_paginas > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400">
                    <span>Página <strong>{data.page}</strong> de <strong>{data.total_paginas}</strong></span>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={data.page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="text-xs"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={data.page >= data.total_paginas}
                        onClick={() => setPage(p => Math.min(data.total_paginas, p + 1))}
                        className="text-xs"
                      >
                        Próxima <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <Car className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="font-bold text-white text-xs mb-1">Nenhum veículo encontrado nesta faixa</h4>
                <p className="text-[11px]">Tente expandir os filtros de preço, motorização ou marcas.</p>
              </div>
            )}
            </CardContent>
          </Card>
          </>
          )}

        </div>

      </div>
    </div>
  );
}
