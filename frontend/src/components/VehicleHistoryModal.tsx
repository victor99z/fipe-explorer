import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader2, Zap, Leaf, Fuel, Info } from 'lucide-react';
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
import BrandLogo from './ui/brand-logo';
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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

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
      document.body.style.overflow = previousOverflow;
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
        titleFont: { size: 11, weight: 500, family: "'Inter', sans-serif" },
        bodyFont: { size: 12, weight: 500, family: "'Inter', sans-serif" },
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
          font: { size: 10, weight: 500, family: "'Inter', sans-serif" },
          maxTicksLimit: isMobile ? 5 : 8,
          maxRotation: 0,
          autoSkip: true
        }
      },
      y: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
        ticks: {
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 10, weight: 500, family: "'Inter', sans-serif" },
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-history-modal-title"
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl bg-[#ffffff] dark:bg-[#18181b] sm:border border-[#dfdfdf] dark:border-[#27272a] sm:rounded-xl rounded-none shadow-2xl flex flex-col overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-[#ededed] dark:border-[#27272a] flex items-start justify-between bg-[#ffffff] dark:bg-[#18181b] shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
              <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] font-mono text-[10px] sm:text-xs leading-none text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                {vehicle.codigo_fipe}
              </span>
              <span className="inline-flex items-center gap-1.5 h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                <span className="w-3.5 h-3.5 rounded-[3px] bg-[#ffffff] border border-black/5 flex items-center justify-center p-[1px] shrink-0">
                  <BrandLogo brand={vehicle.nome_marca} size="xs" iconClassName="text-[#171717]" />
                </span>
                <span>{vehicle.nome_marca}</span>
              </span>
              {vehicle.ano_modelo && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium tabular-nums text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                  Ano {vehicle.ano_modelo}
                </span>
              )}
              {vehicle.nome_combustivel === 'Elétrico' && (
                <span className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60">
                  <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Elétrico
                </span>
              )}
              {vehicle.nome_combustivel === 'Híbrido' && (
                <span className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-semibold text-emerald-600 dark:text-[#3ecf8e] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <Leaf className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Híbrido
                </span>
              )}
              {vehicle.nome_combustivel && vehicle.nome_combustivel !== 'Elétrico' && vehicle.nome_combustivel !== 'Híbrido' && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                  {vehicle.nome_combustivel}
                </span>
              )}
              {vehicle.is_turbo && (
                <span className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] shrink-0" />
                  Turbo
                </span>
              )}
              {vehicle.is_automatico && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                  Automático
                </span>
              )}
              {vehicle.litragem && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[4px] text-[10px] sm:text-xs leading-none font-medium text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                  Motor {vehicle.litragem}
                </span>
              )}
            </div>
            <h2
              id="vehicle-history-modal-title"
              className="text-base sm:text-xl font-semibold text-[#171717] dark:text-[#ededed] tracking-tight truncate sm:whitespace-normal"
            >
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
                  <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium tracking-wider">Preço Atual</p>
                  <p className="text-sm sm:text-base font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed] mt-0.5 truncate">
                    {summary?.valor_atual_formatado || vehicle.valor_formatado}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 tabular-nums truncate">
                    Ref: {summary?.periodo_atual || summary?.data_atual || vehicle.periodo_referencia}
                  </p>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-2.5 sm:p-3">
                  <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium tracking-wider">Primeiro Registro</p>
                  <p className="text-sm sm:text-base font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed] mt-0.5 truncate">
                    {summary?.valor_inicial_formatado || vehicle.valor_inicial_formatado || 'N/A'}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 tabular-nums truncate">
                    Ref: {summary?.periodo_inicial || summary?.data_inicial || 'Início'}
                  </p>
                </div>

                <div
                  className="group/tooltip relative bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] hover:border-[#dfdfdf] dark:hover:border-[#3f3f46] rounded-[6px] p-2.5 sm:p-3 cursor-help focus:outline-none transition-colors"
                  tabIndex={0}
                  aria-describedby="modal-variacao-tooltip"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      e.currentTarget.blur();
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium tracking-wider">
                      Variação Total
                    </p>
                    <Info
                      className="w-3 h-3 text-[#9a9a9a] dark:text-[#71717a] group-hover/tooltip:text-[#3ecf8e] group-focus-within/tooltip:text-[#3ecf8e] transition-colors shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {hasVariacao ? (
                      <>
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 text-[#15803d] dark:text-[#3ecf8e] shrink-0" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-[#707070] dark:text-[#a1a1aa] shrink-0" aria-hidden="true" />
                        )}
                        <span className={`text-sm sm:text-base font-semibold tabular-nums tracking-tight truncate ${isPositive ? 'text-[#15803d] dark:text-[#3ecf8e]' : 'text-[#707070] dark:text-[#a1a1aa]'}`}>
                          {isPositive ? '+' : ''}{Number(variacaoTotal).toFixed(2).replace('.', ',')}%
                        </span>
                      </>
                    ) : (
                      <span className="text-sm sm:text-base font-semibold tabular-nums text-[#707070] dark:text-[#a1a1aa]">0,00%</span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 truncate">acumulado</p>

                  {/* Calculation Breakdown Tooltip */}
                  <div
                    id="modal-variacao-tooltip"
                    role="tooltip"
                    className="pointer-events-none opacity-0 invisible group-hover/tooltip:pointer-events-auto group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:pointer-events-auto group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible transition-opacity duration-150 absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-64 sm:w-72 z-30 rounded-[8px] border border-[#dfdfdf] dark:border-[#3f3f46] bg-[#ffffff] dark:bg-[#1c1c1f] p-3 shadow-xl text-left text-[11px] leading-snug text-[#171717] dark:text-[#ededed] after:content-[''] after:absolute after:bottom-full after:left-0 after:w-full after:h-2"
                  >
                    <p className="font-semibold text-[11px] text-[#171717] dark:text-[#ededed] mb-1.5">
                      Como a variação foi calculada
                    </p>
                    <div className="space-y-1 text-[11px] tabular-nums">
                      <div className="flex items-center justify-between gap-2 text-[#707070] dark:text-[#a1a1aa]">
                        <span>1º registro ({summary?.periodo_inicial || summary?.data_inicial || 'Início'}):</span>
                        <span className="font-medium text-[#171717] dark:text-[#ededed]">
                          {summary?.valor_inicial_formatado || vehicle.valor_inicial_formatado || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[#707070] dark:text-[#a1a1aa]">
                        <span>Preço atual ({summary?.periodo_atual || summary?.data_atual || vehicle.periodo_referencia}):</span>
                        <span className="font-medium text-[#171717] dark:text-[#ededed]">
                          {summary?.valor_atual_formatado || vehicle.valor_formatado}
                        </span>
                      </div>
                      {summary?.variacao_total_rs_formatada && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#ededed] dark:border-[#27272a]">
                          <span className="text-[#707070] dark:text-[#a1a1aa]">Diferença em R$:</span>
                          <span className={`font-semibold ${isPositive ? 'text-[#15803d] dark:text-[#3ecf8e]' : 'text-[#171717] dark:text-[#ededed]'}`}>
                            {summary.variacao_total_rs >= 0 ? '+' : ''}{summary.variacao_total_rs_formatada}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 pt-1.5 border-t border-[#ededed] dark:border-[#27272a] text-[10px] text-[#9a9a9a] dark:text-[#71717a] font-mono">
                      Fórmula: ((Atual − 1º Registro) ÷ 1º Registro) × 100
                    </p>
                  </div>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-2.5 sm:p-3">
                  <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium tracking-wider">Pico Máximo</p>
                  <p className="text-sm sm:text-base font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed] mt-0.5 truncate">
                    {summary?.valor_maximo_formatado || 'N/A'}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 tabular-nums truncate">Min: {summary?.valor_minimo_formatado || 'N/A'}</p>
                </div>
              </div>

              {/* INMETRO PBEV Consumption Block */}
              {(vehicle.consumo_urbano_gasolina != null ||
                vehicle.consumo_urbano_etanol != null ||
                vehicle.consumo_urbano_eletrico != null) && (
                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {vehicle.consumo_urbano_eletrico != null ? (
                        <Zap className="w-3.5 h-3.5 text-[#3ecf8e]" />
                      ) : (
                        <Fuel className="w-3.5 h-3.5 text-[#3ecf8e]" />
                      )}
                      <span className="text-[11px] font-semibold text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                        Consumo & Eficiência INMETRO (PBEV)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {vehicle.nota_pbe && (
                        <span
                          className={`inline-flex items-center h-6 px-2 rounded-[4px] text-[11px] leading-none font-semibold border ${
                            vehicle.nota_pbe === 'A'
                              ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                              : vehicle.nota_pbe === 'B'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : vehicle.nota_pbe === 'C'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-[#ffffff] dark:bg-[#18181b] text-[#707070] dark:text-[#a1a1aa] border-[#ededed] dark:border-[#27272a]'
                          }`}
                        >
                          Nota PBE: {vehicle.nota_pbe}
                        </span>
                      )}
                      {vehicle.match_consumo && (
                        <span className="inline-flex items-center h-6 px-2 rounded-[4px] text-[11px] leading-none font-medium text-[#707070] dark:text-[#a1a1aa] bg-[#ffffff] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a]">
                          {vehicle.match_consumo === 'versao_exata' ? 'Versão exata' : 'Conjunto mecânico'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {vehicle.consumo_urbano_gasolina != null && (
                      <div className="bg-[#ffffff] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] rounded-[4px] p-2.5">
                        <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] block mb-0.5">
                          {vehicle.nome_combustivel?.toLowerCase() === 'diesel' ? 'Diesel (Cid / Est)' : 'Gasolina (Cid / Est)'}
                        </span>
                        <span className="text-sm sm:text-[15px] font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed]">
                          {vehicle.consumo_urbano_gasolina.toFixed(1).replace('.', ',')} /{' '}
                          {vehicle.consumo_rodoviario_gasolina != null
                            ? vehicle.consumo_rodoviario_gasolina.toFixed(1).replace('.', ',')
                            : '-'}{' '}
                          <span className="text-xs font-normal text-[#707070] dark:text-[#a1a1aa]">km/l</span>
                        </span>
                      </div>
                    )}

                    {vehicle.consumo_urbano_etanol != null && (
                      <div className="bg-[#ffffff] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] rounded-[4px] p-2.5">
                        <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] block mb-0.5">Etanol (Cid / Est)</span>
                        <span className="text-sm sm:text-[15px] font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed]">
                          {vehicle.consumo_urbano_etanol.toFixed(1).replace('.', ',')} /{' '}
                          {vehicle.consumo_rodoviario_etanol != null
                            ? vehicle.consumo_rodoviario_etanol.toFixed(1).replace('.', ',')
                            : '-'}{' '}
                          <span className="text-xs font-normal text-[#707070] dark:text-[#a1a1aa]">km/l</span>
                        </span>
                      </div>
                    )}

                    {vehicle.consumo_urbano_eletrico != null && (
                      <div className="bg-[#ffffff] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] rounded-[4px] p-2.5">
                        <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] block mb-0.5">Elétrico (Cid / Est)</span>
                        <span className="text-sm sm:text-[15px] font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed]">
                          {vehicle.consumo_urbano_eletrico.toFixed(1).replace('.', ',')} /{' '}
                          {vehicle.consumo_rodoviario_eletrico != null
                            ? vehicle.consumo_rodoviario_eletrico.toFixed(1).replace('.', ',')
                            : '-'}{' '}
                          <span className="text-xs font-normal text-[#707070] dark:text-[#a1a1aa]">km/le</span>
                        </span>
                      </div>
                    )}

                    {vehicle.eficiencia_mj_km != null && (
                      <div className="bg-[#ffffff] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] rounded-[4px] p-2.5">
                        <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] block mb-0.5">Eficiência Energética</span>
                        <span className="text-sm sm:text-[15px] font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed]">
                          {vehicle.eficiencia_mj_km.toFixed(2).replace('.', ',')}{' '}
                          <span className="text-xs font-normal text-[#707070] dark:text-[#a1a1aa]">MJ/km</span>
                        </span>
                      </div>
                    )}

                    {vehicle.autonomia_km != null && (
                      <div className="bg-[#ffffff] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] rounded-[4px] p-2.5">
                        <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] block mb-0.5">Autonomia Elétrica</span>
                        <span className="text-sm sm:text-[15px] font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed]">
                          {vehicle.autonomia_km}{' '}
                          <span className="text-xs font-normal text-[#707070] dark:text-[#a1a1aa]">km</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
            <span className="text-sm font-semibold tabular-nums tracking-tight text-[#171717] dark:text-[#ededed]">
              {summary?.valor_atual_formatado || vehicle.valor_formatado}
            </span>
            <span className="hidden sm:inline text-[11px] ml-1.5 tabular-nums">({vehicle.nome_marca} • {vehicle.ano_modelo})</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-4 text-xs font-medium cursor-pointer">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
