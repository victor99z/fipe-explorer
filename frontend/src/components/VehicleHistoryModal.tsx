import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Zap, Leaf, BatteryCharging, Fuel, Info, Search } from 'lucide-react';
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
  onSearchListings?: (vehicle: Vehicle) => void;
}

export default function VehicleHistoryModal({
  vehicle,
  onClose,
  onSearchListings,
}: VehicleHistoryModalProps) {
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

        const mesPromise = fetchVehicleHistory({
          tipo_veiculo: 'carro',
          codigo_fipe: vehicle.codigo_fipe,
          ano_modelo: vehicle.ano_modelo,
          groupby: 'mes',
          metrica_ano: 'media'
        });

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

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

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
          borderColor: isDark ? '#CBE4F0' : '#2D2D2D',
          pointBackgroundColor: '#CBE4F0',
          pointBorderColor: isDark ? '#2D2D2D' : '#FFFDFB',
          backgroundColor: (context: ScriptableContext<'line'>) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 280);
            gradient.addColorStop(0, isDark ? 'rgba(203, 228, 240, 0.35)' : 'rgba(203, 228, 240, 0.65)');
            gradient.addColorStop(1, 'rgba(208, 240, 192, 0.08)');
            return gradient;
          },
          borderWidth: 2,
          pointRadius: groupby === 'mes' ? 2 : 4,
          pointHoverRadius: 5.5,
          fill: true,
          tension: 0.25,
        }
      ]
    };
  };

  const chartData = buildChartData();

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#2D2D2D',
        titleColor: '#CBE4F0',
        bodyColor: '#FFFDFB',
        borderColor: 'rgba(203, 228, 240, 0.45)',
        borderWidth: 1,
        padding: 10,
        titleFont: { size: 11, weight: 600, family: "'Lato', sans-serif" },
        bodyFont: { size: 12, weight: 600, family: "'Lato', sans-serif" },
        callbacks: {
          label: (context) => `R$ ${(context.parsed.y ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(245, 242, 243, 0.08)' : 'rgba(45, 45, 45, 0.06)' },
        ticks: {
          color: isDark ? '#F5F2F3' : '#2D2D2D',
          font: { size: 10, weight: 500, family: "'Lato', sans-serif" },
          maxTicksLimit: isMobile ? 5 : 8,
          maxRotation: 0,
          autoSkip: true
        }
      },
      y: {
        grid: { color: isDark ? 'rgba(245, 242, 243, 0.08)' : 'rgba(45, 45, 45, 0.06)' },
        ticks: {
          color: isDark ? '#F5F2F3' : '#2D2D2D',
          font: { size: 10, weight: 500, family: "'Lato', sans-serif" },
          callback: (value) => 'R$ ' + (Number(value) / 1000).toFixed(0) + 'k'
        }
      }
    }
  };

  const summary = monthlyData?.summary;
  const variacaoTotal = summary?.variacao_total_pct ?? summary?.variacao_pct ?? vehicle?.variacao_pct;
  const hasVariacao = variacaoTotal !== undefined && variacaoTotal !== null;
  const isPositive = Number(variacaoTotal) >= 0;
  const combLower = (vehicle?.nome_combustivel || '').trim().toLowerCase();
  const modelLower = (vehicle?.nome_modelo || '').toLowerCase();
  const isElectric =
    combLower === 'elétrico' ||
    combLower === 'eletrico' ||
    modelLower.includes('(elétrico)') ||
    modelLower.includes('(eletrico)') ||
    modelLower.includes('(eltétrico)') ||
    modelLower.includes('(életrico)');

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-0 sm:p-4 bg-[#2D2D2D]/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-history-modal-title"
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl bg-[#FFFDFB] dark:bg-[#2D2D2D] sm:border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 sm:rounded-xl rounded-none shadow-[0_16px_40px_rgba(45,45,45,0.18)] flex flex-col overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 flex items-start justify-between bg-[#FAF6F7] dark:bg-[#242226] shrink-0">
          <div className="min-w-0 pr-3">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[8px] font-mono text-[10px] sm:text-xs leading-none text-[#2D2D2D] bg-[#E6E6FA] border border-[#2D2D2D]/15">
                {vehicle.codigo_fipe}
              </span>
              <span className="inline-flex items-center gap-1.5 h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-semibold text-[#2D2D2D] bg-[#FFFDFB] border border-[#2D2D2D]/15">
                <span className="w-3.5 h-3.5 rounded-[4px] bg-[#FAF6F7] border border-[#2D2D2D]/10 flex items-center justify-center p-[1px] shrink-0">
                  <BrandLogo brand={vehicle.nome_marca} size="xs" iconClassName="text-[#2D2D2D]" />
                </span>
                <span>{vehicle.nome_marca}</span>
              </span>
              {vehicle.ano_modelo && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-semibold tabular-nums text-[#2D2D2D] bg-[#CBE4F0] border border-[#2D2D2D]/15">
                  Ano {vehicle.ano_modelo}
                </span>
              )}
              {isElectric && (
                <span className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-semibold bg-[#CBE4F0] text-[#2D2D2D] border border-[#2D2D2D]/15">
                  <Zap className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Elétrico
                </span>
              )}
              {!isElectric && vehicle.nome_combustivel === 'Híbrido' && (
                <span className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-semibold bg-[#D0F0C0] text-[#2D2D2D] border border-[#2D2D2D]/15">
                  <Leaf className="w-2.5 h-2.5 shrink-0" aria-hidden="true" /> Híbrido
                </span>
              )}
              {!isElectric && vehicle.nome_combustivel && vehicle.nome_combustivel !== 'Híbrido' && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-medium text-[#2D2D2D] bg-[#FFFDFB] border border-[#2D2D2D]/15">
                  {vehicle.nome_combustivel}
                </span>
              )}
              {isElectric && vehicle.autonomia_km != null && (
                <span className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-medium tabular-nums text-[#2D2D2D] bg-[#D0F0C0] border border-[#2D2D2D]/15">
                  <BatteryCharging className="w-3 h-3 shrink-0" aria-hidden="true" />
                  Autonomia {vehicle.autonomia_km.toLocaleString('pt-BR')} km
                </span>
              )}
              {!isElectric && vehicle.is_turbo && (
                <span className="inline-flex items-center gap-1 h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-semibold text-[#2D2D2D] bg-[#CBE4F0]/80 border border-[#2D2D2D]/15">
                  Turbo
                </span>
              )}
              {!isElectric && vehicle.is_automatico && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-medium text-[#2D2D2D] bg-[#FFFDFB] border border-[#2D2D2D]/15">
                  Automático
                </span>
              )}
              {!isElectric && vehicle.litragem && (
                <span className="inline-flex items-center h-5 sm:h-6 px-2 rounded-[8px] text-[10px] sm:text-xs leading-none font-medium text-[#2D2D2D] bg-[#E6E6FA]/85 border border-[#2D2D2D]/15">
                  Motor {vehicle.litragem}
                </span>
              )}
            </div>
            <h2
              id="vehicle-history-modal-title"
              className="text-base sm:text-xl font-bold text-[#2D2D2D] dark:text-[#F5F2F3] tracking-tight truncate sm:whitespace-normal"
            >
              {vehicle.nome_modelo}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-8 w-8 inline-flex items-center justify-center text-[#2D2D2D] dark:text-[#F5F2F3] bg-[#FFFDFB] dark:bg-[#2D2D2D] border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 rounded-xl hover:bg-[#F6D0D6]/50 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {loading && (
            <div className="space-y-4" aria-label="Carregando histórico FIPE">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="knolling-shimmer h-20 rounded-xl border border-[#2D2D2D]/10" />
                ))}
              </div>
              <div className="knolling-shimmer h-24 rounded-xl border border-[#2D2D2D]/10" />
              <div className="knolling-shimmer h-64 sm:h-72 rounded-xl border border-[#2D2D2D]/10" />
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-[#F6D0D6]/50 border border-[#2D2D2D]/15 text-center">
              <p className="text-xs font-medium text-[#2D2D2D]">{error}</p>
            </div>
          )}

          {!loading && monthlyData && (
            <>
              {/* Summary KPIs in Pastel Knolling Compartments */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#CBE4F0]/55 text-[#2D2D2D] border border-[#2D2D2D]/15 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-semibold tracking-wider opacity-75">Preço Atual</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums tracking-tight mt-0.5 truncate">
                    {summary?.valor_atual_formatado || vehicle.valor_formatado}
                  </p>
                  <p className="text-[11px] opacity-75 mt-0.5 tabular-nums truncate">
                    Ref: {summary?.periodo_atual || summary?.data_atual || vehicle.periodo_referencia}
                  </p>
                </div>

                <div className="bg-[#E6E6FA]/65 text-[#2D2D2D] border border-[#2D2D2D]/15 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-semibold tracking-wider opacity-75">Primeiro Registro</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums tracking-tight mt-0.5 truncate">
                    {summary?.valor_inicial_formatado || vehicle.valor_inicial_formatado || 'N/A'}
                  </p>
                  <p className="text-[11px] opacity-75 mt-0.5 tabular-nums truncate">
                    Ref: {summary?.periodo_inicial || summary?.data_inicial || 'Início'}
                  </p>
                </div>

                <div
                  className="group/tooltip relative bg-[#D0F0C0]/60 text-[#2D2D2D] border border-[#2D2D2D]/15 hover:border-[#2D2D2D]/35 rounded-xl p-3 cursor-help transition-colors"
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
                    <p className="text-[10px] uppercase font-semibold tracking-wider opacity-75">Variação Total</p>
                    <Info className="w-3 h-3 opacity-70 shrink-0" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {hasVariacao ? (
                      <>
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span className="text-sm sm:text-base font-bold tabular-nums tracking-tight truncate">
                          {isPositive ? '+' : ''}{Number(variacaoTotal).toFixed(2).replace('.', ',')}%
                        </span>
                      </>
                    ) : (
                      <span className="text-sm sm:text-base font-bold tabular-nums">0,00%</span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-75 mt-0.5 truncate">acumulado</p>

                  <div
                    id="modal-variacao-tooltip"
                    role="tooltip"
                    className="pointer-events-none opacity-0 invisible group-hover/tooltip:pointer-events-auto group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-focus-within/tooltip:pointer-events-auto group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible transition-opacity duration-200 absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-64 sm:w-72 z-[320] rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#2D2D2D] p-3 shadow-[0_8px_24px_rgba(45,45,45,0.16)] text-left text-[11px] leading-snug text-[#2D2D2D] dark:text-[#F5F2F3]"
                  >
                    <p className="font-bold text-[11px] mb-1.5">Como a variação foi calculada</p>
                    <div className="space-y-1 text-[11px] tabular-nums">
                      <div className="flex items-center justify-between gap-2 opacity-75">
                        <span>1º registro ({summary?.periodo_inicial || summary?.data_inicial || 'Início'}):</span>
                        <span className="font-semibold opacity-100">
                          {summary?.valor_inicial_formatado || vehicle.valor_inicial_formatado || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 opacity-75">
                        <span>Preço atual ({summary?.periodo_atual || summary?.data_atual || vehicle.periodo_referencia}):</span>
                        <span className="font-semibold opacity-100">
                          {summary?.valor_atual_formatado || vehicle.valor_formatado}
                        </span>
                      </div>
                      {summary?.variacao_total_rs_formatada && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12">
                          <span className="opacity-75">Diferença em R$:</span>
                          <span className="font-bold">
                            {summary.variacao_total_rs >= 0 ? '+' : ''}{summary.variacao_total_rs_formatada}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 pt-1.5 border-t border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 text-[10px] opacity-70 font-mono">
                      Fórmula: ((Atual − 1º Registro) ÷ 1º Registro) × 100
                    </p>
                  </div>
                </div>

                <div className="bg-[#F6D0D6]/55 text-[#2D2D2D] border border-[#2D2D2D]/15 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-semibold tracking-wider opacity-75">Pico Máximo</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums tracking-tight mt-0.5 truncate">
                    {summary?.valor_maximo_formatado || 'N/A'}
                  </p>
                  <p className="text-[11px] opacity-75 mt-0.5 tabular-nums truncate">
                    Min: {summary?.valor_minimo_formatado || 'N/A'}
                  </p>
                </div>
              </div>

              {/* INMETRO PBEV Consumption Block */}
              {(vehicle.consumo_urbano_gasolina != null ||
                vehicle.consumo_urbano_etanol != null ||
                vehicle.consumo_urbano_eletrico != null) && (
                <div className="bg-[#D0F0C0]/35 dark:bg-[#2F3B31]/65 border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#2D2D2D] dark:text-[#F5F2F3]">
                      {vehicle.consumo_urbano_eletrico != null ? (
                        <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Fuel className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        Consumo &amp; Eficiência INMETRO (PBEV)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {vehicle.nota_pbe && (
                        <span
                          className={`inline-flex items-center h-6 px-2 rounded-[8px] text-[11px] leading-none font-semibold border border-[#2D2D2D]/15 text-[#2D2D2D] ${
                            vehicle.nota_pbe === 'A' || vehicle.nota_pbe === 'B'
                              ? 'bg-[#D0F0C0]'
                              : vehicle.nota_pbe === 'C'
                              ? 'bg-[#F6D0D6]'
                              : 'bg-[#FFFDFB]'
                          }`}
                        >
                          Nota PBE: {vehicle.nota_pbe}
                        </span>
                      )}
                      {vehicle.match_consumo && (
                        <span className="inline-flex items-center h-6 px-2 rounded-[8px] text-[11px] leading-none font-medium text-[#2D2D2D] bg-[#FFFDFB] border border-[#2D2D2D]/15">
                          {vehicle.match_consumo === 'versao_exata' ? 'Versão exata' : 'Conjunto mecânico'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {vehicle.consumo_urbano_gasolina != null && (
                      <div className="bg-[#FFFDFB] dark:bg-[#242226] border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 rounded-xl p-2.5">
                        <span className="text-[11px] text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 block mb-0.5">
                          {vehicle.nome_combustivel?.toLowerCase() === 'diesel' ? 'Diesel (Cid / Est)' : 'Gasolina (Cid / Est)'}
                        </span>
                        <span className="text-sm sm:text-[15px] font-bold tabular-nums tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3]">
                          {vehicle.consumo_urbano_gasolina.toFixed(1).replace('.', ',')} /{' '}
                          {vehicle.consumo_rodoviario_gasolina != null
                            ? vehicle.consumo_rodoviario_gasolina.toFixed(1).replace('.', ',')
                            : '-'}{' '}
                          <span className="text-xs font-normal opacity-70">km/l</span>
                        </span>
                      </div>
                    )}

                    {vehicle.consumo_urbano_etanol != null && (
                      <div className="bg-[#FFFDFB] dark:bg-[#242226] border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 rounded-xl p-2.5">
                        <span className="text-[11px] text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 block mb-0.5">Etanol (Cid / Est)</span>
                        <span className="text-sm sm:text-[15px] font-bold tabular-nums tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3]">
                          {vehicle.consumo_urbano_etanol.toFixed(1).replace('.', ',')} /{' '}
                          {vehicle.consumo_rodoviario_etanol != null
                            ? vehicle.consumo_rodoviario_etanol.toFixed(1).replace('.', ',')
                            : '-'}{' '}
                          <span className="text-xs font-normal opacity-70">km/l</span>
                        </span>
                      </div>
                    )}

                    {vehicle.consumo_urbano_eletrico != null && (
                      <div className="bg-[#FFFDFB] dark:bg-[#242226] border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 rounded-xl p-2.5">
                        <span className="text-[11px] text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 block mb-0.5">Elétrico (Cid / Est)</span>
                        <span className="text-sm sm:text-[15px] font-bold tabular-nums tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3]">
                          {vehicle.consumo_urbano_eletrico.toFixed(1).replace('.', ',')} /{' '}
                          {vehicle.consumo_rodoviario_eletrico != null
                            ? vehicle.consumo_rodoviario_eletrico.toFixed(1).replace('.', ',')
                            : '-'}{' '}
                          <span className="text-xs font-normal opacity-70">km/le</span>
                        </span>
                      </div>
                    )}

                    {vehicle.eficiencia_mj_km != null && (
                      <div className="bg-[#FFFDFB] dark:bg-[#242226] border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 rounded-xl p-2.5">
                        <span className="text-[11px] text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 block mb-0.5">Eficiência Energética</span>
                        <span className="text-sm sm:text-[15px] font-bold tabular-nums tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3]">
                          {vehicle.eficiencia_mj_km.toFixed(2).replace('.', ',')}{' '}
                          <span className="text-xs font-normal opacity-70">MJ/km</span>
                        </span>
                      </div>
                    )}

                    {vehicle.autonomia_km != null && (
                      <div className="bg-[#FFFDFB] dark:bg-[#242226] border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 rounded-xl p-2.5">
                        <span className="text-[11px] text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 block mb-0.5">Autonomia Elétrica</span>
                        <span className="text-sm sm:text-[15px] font-bold tabular-nums tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3]">
                          {vehicle.autonomia_km}{' '}
                          <span className="text-xs font-normal opacity-70">km</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chart Section */}
              <div className="bg-[#FAF6F7] dark:bg-[#242226] border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 rounded-xl p-3.5 sm:p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 uppercase tracking-wider">
                    Evolução Histórica de Preço
                  </span>
                  <div className="flex items-center gap-1 bg-[#FFFDFB] dark:bg-[#2D2D2D] border border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 p-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleToggleGroupby('mes')}
                      className={`px-2.5 py-1 text-xs rounded-[8px] transition-colors cursor-pointer ${
                        groupby === 'mes'
                          ? 'bg-[#CBE4F0] text-[#2D2D2D] font-semibold'
                          : 'text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 hover:text-[#2D2D2D]'
                      }`}
                    >
                      Mês
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGroupby('ano')}
                      className={`px-2.5 py-1 text-xs rounded-[8px] transition-colors cursor-pointer ${
                        groupby === 'ano'
                          ? 'bg-[#CBE4F0] text-[#2D2D2D] font-semibold'
                          : 'text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 hover:text-[#2D2D2D]'
                      }`}
                    >
                      Ano
                    </button>
                  </div>
                </div>

                <div className="h-64 sm:h-72 w-full bg-[#FFFDFB] dark:bg-[#2D2D2D] p-2 rounded-xl border border-[#2D2D2D]/12 dark:border-[#F5F2F3]/12 relative">
                  {loadingYearly ? (
                    <div className="h-full w-full knolling-shimmer rounded-[8px]" aria-label="Carregando evolução anual" />
                  ) : chartData ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#2D2D2D]/70 dark:text-[#F5F2F3]/70 text-xs">
                      Sem dados suficientes para gerar o gráfico.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FAF6F7] dark:bg-[#242226] flex items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75">
            <span className="text-sm font-bold tabular-nums tracking-tight text-[#2D2D2D] dark:text-[#F5F2F3]">
              {summary?.valor_atual_formatado || vehicle.valor_formatado}
            </span>
            <span className="hidden sm:inline text-xs ml-1.5 tabular-nums">
              ({vehicle.nome_marca} • {vehicle.ano_modelo})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onSearchListings && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  onClose();
                  onSearchListings(vehicle);
                }}
                className="h-8 px-3 text-xs font-semibold gap-1.5"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Buscar anúncios</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 px-4 text-xs font-medium">
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
