import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader2, Zap, Leaf } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ScriptableContext
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Button } from './ui/button';
import { Vehicle, HistoryResponse } from '../types/vehicle';
import { fetchVehicleHistory } from '../services/api';

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

export interface VehicleHistoryModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

export default function VehicleHistoryModal({ vehicle, onClose }: VehicleHistoryModalProps) {
  const [monthlyData, setMonthlyData] = useState<HistoryResponse | null>(null);
  const [yearlyData, setYearlyData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingYearly, setLoadingYearly] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [groupby, setGroupby] = useState<'mes' | 'ano'>('mes');

  useEffect(() => {
    if (!vehicle) return;

    // Handle ESC key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    let isCancelled = false;
    setGroupby('mes');
    setLoading(true);
    setError(null);
    setMonthlyData(null);
    setYearlyData(null);

    async function loadVehicleHistory() {
      try {
        if (!vehicle) return;

        // Fetch monthly data (the single source of truth for KPI summary cards)
        const mesPromise = fetchVehicleHistory({
          tipo_veiculo: 'carro',
          codigo_fipe: vehicle.codigo_fipe,
          ano_modelo: vehicle.ano_modelo,
          groupby: 'mes',
          metrica_ano: 'media'
        });

        // Preload yearly series in parallel for instant toggle without changing cards
        const anoPromise = fetchVehicleHistory({
          tipo_veiculo: 'carro',
          codigo_fipe: vehicle.codigo_fipe,
          ano_modelo: vehicle.ano_modelo,
          groupby: 'ano',
          metrica_ano: 'media'
        }).catch((err) => {
          console.warn("Falha ao pré-carregar histórico anual:", err);
          return null;
        });

        const [mesRes, anoRes] = await Promise.all([mesPromise, anoPromise]);

        if (!isCancelled) {
          setMonthlyData(mesRes);
          if (anoRes) {
            setYearlyData(anoRes);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error(err);
          const msg = err instanceof Error ? err.message : 'Erro ao consultar histórico.';
          setError(msg);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadVehicleHistory();

    return () => {
      isCancelled = true;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [vehicle, onClose]);

  const handleToggleGroupby = async (targetGroupby: 'mes' | 'ano') => {
    setGroupby(targetGroupby);
    if (targetGroupby === 'ano' && !yearlyData && vehicle) {
      setLoadingYearly(true);
      try {
        const data = await fetchVehicleHistory({
          tipo_veiculo: 'carro',
          codigo_fipe: vehicle.codigo_fipe,
          ano_modelo: vehicle.ano_modelo,
          groupby: 'ano',
          metrica_ano: 'media'
        });
        setYearlyData(data);
      } catch (err: unknown) {
        console.error("Erro ao carregar dados anuais:", err);
      } finally {
        setLoadingYearly(false);
      }
    }
  };

  if (!vehicle) return null;

  const buildChartData = () => {
    const activeData = groupby === 'mes' ? monthlyData : yearlyData;
    if (!activeData || !activeData.series || activeData.series.length === 0) return null;

    const series = activeData.series;
    const labels = series.map((item) => item.periodo);
    const prices = series.map((item) => item.valor);

    return {
      labels,
      datasets: [
        {
          label: 'Preço FIPE (R$)',
          data: prices,
          borderColor: '#3ecf8e',
          backgroundColor: (context: ScriptableContext<'line'>) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 280);
            gradient.addColorStop(0, 'rgba(62, 207, 142, 0.25)');
            gradient.addColorStop(1, 'rgba(62, 207, 142, 0.0)');
            return gradient;
          },
          borderWidth: 2,
          pointRadius: groupby === 'mes' ? 1.5 : 3.5,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.25,
        }
      ]
    };
  };

  const chartData = buildChartData();

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: isDark ? '#18181b' : '#1c1c1c',
        titleColor: '#3ecf8e',
        bodyColor: '#ffffff',
        borderColor: isDark ? '#27272a' : '#282828',
        borderWidth: 1,
        padding: 8,
        titleFont: { size: 10, family: 'Inter, sans-serif' },
        bodyFont: { size: 11, family: 'Inter, sans-serif' },
        callbacks: {
          label: (context) => `R$ ${(context.parsed.y ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
        ticks: { 
          color: isDark ? '#a1a1aa' : '#707070', 
          font: { size: 9, family: 'Inter, sans-serif' }, 
          maxTicksLimit: isMobile ? 5 : 8,
          maxRotation: 0,
          autoSkip: true
        }
      },
      y: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
        ticks: {
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 9, family: 'Inter, sans-serif' },
          callback: (value) => 'R$ ' + (Number(value) / 1000).toFixed(0) + 'k'
        }
      }
    }
  };

  const summary = monthlyData?.summary;
  const variacaoTotal = summary?.variacao_total_pct ?? summary?.variacao_pct ?? vehicle?.variacao_pct;
  const hasVariacao = variacaoTotal !== undefined && variacaoTotal !== null;
  const isPositive = Number(variacaoTotal) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl bg-[#ffffff] dark:bg-[#18181b] sm:border border-[#dfdfdf] dark:border-[#27272a] sm:rounded-xl rounded-none shadow-2xl flex flex-col overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-[#ededed] dark:border-[#27272a] flex items-start justify-between bg-[#ffffff] dark:bg-[#18181b] shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
              <span className="font-mono text-[10px] sm:text-xs text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                {vehicle.codigo_fipe}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                {vehicle.nome_marca}
              </span>
              {vehicle.ano_modelo && (
                <span className="text-[10px] sm:text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  Ano {vehicle.ano_modelo}
                </span>
              )}
              {vehicle.nome_combustivel === 'Elétrico' && (
                <span className="text-[10px] sm:text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 px-1.5 py-0.5 rounded-[4px] flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Elétrico
                </span>
              )}
              {vehicle.nome_combustivel === 'Híbrido' && (
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-[#3ecf8e] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-[4px] flex items-center gap-1">
                  <Leaf className="w-2.5 h-2.5" /> Híbrido
                </span>
              )}
              {vehicle.nome_combustivel && vehicle.nome_combustivel !== 'Elétrico' && vehicle.nome_combustivel !== 'Híbrido' && (
                <span className="text-[10px] sm:text-xs font-medium text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  {vehicle.nome_combustivel}
                </span>
              )}
              {vehicle.is_turbo && (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e]" />
                  Turbo
                </span>
              )}
              {vehicle.is_automatico && (
                <span className="text-[10px] sm:text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  Automático
                </span>
              )}
              {vehicle.litragem && (
                <span className="text-[10px] sm:text-xs font-medium text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  Motor {vehicle.litragem}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-xl font-semibold text-[#171717] dark:text-[#ededed] tracking-tight truncate sm:whitespace-normal">
              {vehicle.nome_modelo}
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] rounded-[6px] hover:bg-[#fafafa] dark:hover:bg-[#27272a] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-5 flex-1">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#3ecf8e] animate-spin mb-2" />
              <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">Carregando histórico FIPE...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-[6px] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] text-center">
              <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">{error}</p>
            </div>
          )}

          {!loading && monthlyData && (
            <>
              {/* Summary KPIs - Always computed from monthly historical data */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-2.5 sm:p-3">
                  <p className="text-[9px] sm:text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-semibold">Preço Atual</p>
                  <p className="text-sm sm:text-base font-bold text-[#171717] dark:text-[#ededed] mt-0.5 truncate">
                    {summary?.valor_atual_formatado || vehicle.valor_formatado}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 font-mono truncate">
                    Ref: {summary?.periodo_atual || summary?.data_atual || vehicle.periodo_referencia}
                  </p>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-2.5 sm:p-3">
                  <p className="text-[9px] sm:text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-semibold">Primeiro Registro</p>
                  <p className="text-sm sm:text-base font-bold text-[#171717] dark:text-[#ededed] mt-0.5 truncate">
                    {summary?.valor_inicial_formatado || vehicle.valor_inicial_formatado || 'N/A'}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 font-mono truncate">
                    Ref: {summary?.periodo_inicial || summary?.data_inicial || 'Início'}
                  </p>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-2.5 sm:p-3">
                  <p className="text-[9px] sm:text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-semibold">Variação Total</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {hasVariacao ? (
                      <>
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 text-[#15803d] dark:text-[#3ecf8e] shrink-0" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-[#707070] dark:text-[#a1a1aa] shrink-0" />
                        )}
                        <span className={`text-sm sm:text-base font-bold truncate ${isPositive ? 'text-[#15803d] dark:text-[#3ecf8e]' : 'text-[#707070] dark:text-[#a1a1aa]'}`}>
                          {isPositive ? '+' : ''}{variacaoTotal}%
                        </span>
                      </>
                    ) : (
                      <span className="text-sm sm:text-base font-bold text-[#707070] dark:text-[#a1a1aa]">0.0%</span>
                    )}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 truncate">acumulado</p>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-2.5 sm:p-3">
                  <p className="text-[9px] sm:text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-semibold">Pico Máximo</p>
                  <p className="text-sm sm:text-base font-bold text-[#171717] dark:text-[#ededed] mt-0.5 truncate">
                    {summary?.valor_maximo_formatado || 'N/A'}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 font-mono truncate">Min: {summary?.valor_minimo_formatado || 'N/A'}</p>
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-3 sm:p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                    Evolução Histórica de Preço
                  </span>
                  <div className="flex items-center gap-1 bg-[#ffffff] dark:bg-[#18181b] border border-[#dfdfdf] dark:border-[#27272a] p-0.5 rounded-[4px]">
                    <button
                      type="button"
                      onClick={() => handleToggleGroupby('mes')}
                      className={`px-2 py-0.5 text-[11px] sm:text-xs rounded-[3px] transition-colors cursor-pointer focus:outline-none ${
                        groupby === 'mes' ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium' : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }`}
                    >
                      Mês
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGroupby('ano')}
                      className={`px-2 py-0.5 text-[11px] sm:text-xs rounded-[3px] transition-colors cursor-pointer focus:outline-none ${
                        groupby === 'ano' ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium' : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }`}
                    >
                      Ano
                    </button>
                  </div>
                </div>

                <div className="h-64 sm:h-72 w-full bg-[#ffffff] dark:bg-[#18181b] p-1.5 sm:p-2 rounded-[4px] border border-[#ededed] dark:border-[#27272a] relative">
                  {loadingYearly ? (
                    <div className="h-full flex flex-col items-center justify-center">
                      <Loader2 className="w-5 h-5 text-[#3ecf8e] animate-spin mb-1.5" />
                      <span className="text-xs text-[#707070] dark:text-[#a1a1aa]">Carregando evolução anual...</span>
                    </div>
                  ) : chartData ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#707070] dark:text-[#a1a1aa] text-xs">
                      Sem dados suficientes para gerar o gráfico.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-t border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] flex items-center justify-between shrink-0">
          <div className="text-xs text-[#707070] dark:text-[#a1a1aa]">
            <span className="font-mono text-[#171717] dark:text-[#ededed] font-medium">{summary?.valor_atual_formatado || vehicle.valor_formatado}</span>
            <span className="hidden sm:inline text-[11px] ml-1">({vehicle.nome_marca} {vehicle.ano_modelo})</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-4 text-xs font-medium cursor-pointer">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
