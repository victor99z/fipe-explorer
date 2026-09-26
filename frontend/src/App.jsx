import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSearch from './components/HeroSearch';
import FilterBar from './components/FilterBar';
import SummaryCards from './components/SummaryCards';
import ChartSection from './components/ChartSection';
import DataTableSection from './components/DataTableSection';
import ComparisonSection from './components/ComparisonSection';
import PriceSearchSection from './components/PriceSearchSection';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Loader2, AlertCircle, TrendingUp, DollarSign, Search, Sparkles } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'budget'

  const [filters, setFilters] = useState({
    tipo_veiculo: 'carro',
    search_term: '',
    ano_modelo: null,
    marca: '',
    modelo: '',
    codigo_fipe: null,
    groupby: 'ano',
    metrica_ano: 'media'
  });

  const [presets, setPresets] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch preset examples
  useEffect(() => {
    async function fetchPresets() {
      try {
        const res = await fetch('/api/presets');
        if (res.ok) {
          const list = await res.json();
          setPresets(list);
        }
      } catch (err) {
        console.error("Erro ao carregar presets:", err);
      }
    }
    fetchPresets();
  }, []);

  // Main data fetch effect for historical graph
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('tipo_veiculo', filters.tipo_veiculo || 'carro');
        queryParams.append('groupby', filters.groupby || 'ano');
        queryParams.append('metrica_ano', filters.metrica_ano || 'media');

        if (filters.codigo_fipe) {
          queryParams.append('codigo_fipe', filters.codigo_fipe);
        } else if (filters.search_term) {
          queryParams.append('search_term', filters.search_term);
        } else {
          if (filters.marca) queryParams.append('marca', filters.marca);
          if (filters.modelo) queryParams.append('modelo', filters.modelo);
        }

        if (filters.ano_modelo) {
          queryParams.append('ano_modelo', filters.ano_modelo);
        }

        const res = await fetch(`/api/history?${queryParams.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Dados não encontrados para os filtros selecionados.");
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [filters]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSelectVehicle = (vehicle) => {
    const marcaVal = vehicle.nome_marca || vehicle.marca || '';
    const modeloVal = vehicle.nome_modelo || vehicle.modelo || '';
    setFilters(prev => ({
      ...prev,
      search_term: vehicle.search_term !== undefined ? vehicle.search_term : null,
      codigo_fipe: vehicle.codigo_fipe || null,
      marca: marcaVal,
      modelo: modeloVal,
      nome_marca: marcaVal,
      nome_modelo: modeloVal,
      ano_modelo: vehicle.ano_modelo || null,
      tipo_veiculo: vehicle.tipo_veiculo || prev.tipo_veiculo
    }));
    setActiveTab('history');
  };

  const handleResetFilters = () => {
    setFilters({
      tipo_veiculo: 'carro',
      search_term: '',
      ano_modelo: null,
      marca: '',
      modelo: '',
      codigo_fipe: null,
      groupby: 'ano',
      metrica_ano: 'media'
    });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs Switcher */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="history">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span>1. Consulta & Histórico de Veículo</span>
              </TabsTrigger>
              <TabsTrigger value="budget">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>2. O Que Comprar? (Busca por Orçamento)</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Vehicle History & Depreciation */}
          <TabsContent value="history">
            {/* Hero Search Box */}
            <HeroSearch
              onSelectVehicle={handleSelectVehicle}
              presets={presets}
              currentSearch={filters.search_term || ''}
            />

            {/* Detailed Filters Panel */}
            <FilterBar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleResetFilters}
            />

            {/* Loading Spinner */}
            {loading && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-16 text-center my-8 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-white mb-1">Consultando base FIPEX (DuckDB)...</h3>
                <p className="text-xs text-slate-400">Processando milhões de registros históricos em milissegundos</p>
              </div>
            )}

            {/* Error Alert */}
            {!loading && error && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center my-8">
                <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">Nenhum dado retornado</h3>
                <p className="text-sm text-slate-300 mb-4">{error}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Limpar filtros
                </Button>
              </div>
            )}

            {/* Content Section */}
            {!loading && data && data.summary && (
              <>
                {/* KPI Cards */}
                <SummaryCards summary={data.summary} info={data.info} />

                {/* Interactive Graph Section */}
                <ChartSection series={data.series} info={data.info} />

                {/* Side by Side Comparison Section */}
                <ComparisonSection primaryInfo={data.info} primarySeries={data.series} />

                {/* Full Historical Data Table */}
                <DataTableSection series={data.series} info={data.info} />
              </>
            )}
          </TabsContent>

          {/* Tab 2: Price Range Finder ("O que posso comprar com R$ X?") */}
          <TabsContent value="budget">
            <PriceSearchSection
              onSelectVehicleForAnalysis={handleSelectVehicle}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          <p>© 2026 FIPEX Explorer • Dados extraídos do arquivo Parquet fipex-prices.parquet (9.4M de dados históricos FIPE)</p>
        </div>
      </footer>
    </div>
  );
}
