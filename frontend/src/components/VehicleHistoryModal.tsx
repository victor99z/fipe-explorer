import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
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
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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

    async function loadVehicleHistory() {
      setLoading(true);
      setError(null);
      try {
        if (!vehicle) return;
        const data = await fetchVehicleHistory({
          tipo_veiculo: vehicle.nome_combustivel ? 'carro' : 'carro',
          codigo_fipe: vehicle.codigo_fipe,
          ano_modelo: vehicle.ano_modelo,
          groupby: groupby,
          metrica_ano: 'media'
        });
        if (!isCancelled) {
          setHistoryData(data);
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
  }, [vehicle, groupby, onClose]);

  if (!vehicle) return null;

  const buildChartData = () => {
    if (!historyData || !historyData.series || historyData.series.length === 0) return null;

    const series = historyData.series;
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
          pointRadius: groupby === 'mes' ? 1 : 3.5,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.25,
        }
      ]
    };
  };

  const chartData = buildChartData();

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

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
        titleFont: { size: 11, family: 'Inter, sans-serif' },
        bodyFont: { size: 12, family: 'Inter, sans-serif' },
        callbacks: {
          label: (context) => `R$ ${(context.parsed.y ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
        ticks: { color: isDark ? '#a1a1aa' : '#707070', font: { size: 10, family: 'Inter, sans-serif' }, maxTicksLimit: 10 }
      },
      y: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)' },
        ticks: {
          color: isDark ? '#a1a1aa' : '#707070',
          font: { size: 10, family: 'Inter, sans-serif' },
          callback: (value) => 'R$ ' + (Number(value) / 1000).toFixed(0) + 'k'
        }
      }
    }
  };

  const summary = historyData?.summary;
  const variacaoTotal = summary?.variacao_total_pct ?? summary?.variacao_pct ?? vehicle?.variacao_pct;
  const hasVariacao = variacaoTotal !== undefined && variacaoTotal !== null;
  const isPositive = Number(variacaoTotal) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-3xl bg-[#ffffff] dark:bg-[#18181b] border border-[#dfdfdf] dark:border-[#27272a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#ededed] dark:border-[#27272a] flex items-start justify-between bg-[#ffffff] dark:bg-[#18181b]">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="font-mono text-xs text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                {vehicle.codigo_fipe}
              </span>
              <span className="text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                {vehicle.nome_marca}
              </span>
              {vehicle.ano_modelo && (
                <span className="text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  Ano {vehicle.ano_modelo}
                </span>
              )}
              {vehicle.is_turbo && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e]" />
                  Turbo
                </span>
              )}
              {vehicle.is_automatico && (
                <span className="text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  Automático
                </span>
              )}
              {vehicle.litragem && (
                <span className="text-xs font-medium text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] px-1.5 py-0.5 rounded-[4px]">
                  Motor {vehicle.litragem}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-medium text-[#171717] dark:text-[#ededed] tracking-tight">
              {vehicle.nome_modelo}
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] rounded-[6px] hover:bg-[#fafafa] dark:hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
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

          {!loading && historyData && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-3">
                  <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium">Preço Atual</p>
                  <p className="text-base font-medium text-[#171717] dark:text-[#ededed] mt-0.5">
                    {summary?.valor_atual_formatado || vehicle.valor_formatado}
                  </p>
                  <p className="text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 font-mono">
                    Ref: {summary?.periodo_atual || summary?.data_atual || vehicle.periodo_referencia}
                  </p>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-3">
                  <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium">Primeiro Registro</p>
                  <p className="text-base font-medium text-[#171717] dark:text-[#ededed] mt-0.5">
                    {summary?.valor_inicial_formatado || vehicle.valor_inicial_formatado || 'N/A'}
                  </p>
                  <p className="text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5 font-mono">
                    Ref: {summary?.periodo_inicial || summary?.data_inicial || 'Início'}
                  </p>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-3">
                  <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium">Variação Total</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {hasVariacao ? (
                      <>
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 text-[#15803d] dark:text-[#3ecf8e]" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-[#707070] dark:text-[#a1a1aa]" />
                        )}
                        <span className={`text-base font-medium ${isPositive ? 'text-[#15803d] dark:text-[#3ecf8e]' : 'text-[#707070] dark:text-[#a1a1aa]'}`}>
                          {isPositive ? '+' : ''}{variacaoTotal}%
                        </span>
                      </>
                    ) : (
                      <span className="text-base font-medium text-[#707070] dark:text-[#a1a1aa]">0.0%</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5">acumulado</p>
                </div>

                <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-3">
                  <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] uppercase font-medium">Pico Máximo</p>
                  <p className="text-base font-medium text-[#171717] dark:text-[#ededed] mt-0.5">
                    {summary?.valor_maximo_formatado || 'N/A'}
                  </p>
                  <p className="text-[10px] text-[#9a9a9a] dark:text-[#71717a] mt-0.5">Min: {summary?.valor_minimo_formatado || 'N/A'}</p>
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a] rounded-[6px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-[#707070] dark:text-[#a1a1aa] uppercase tracking-wider">
                    Evolução Histórica de Preço
                  </span>
                  <div className="flex items-center gap-1 bg-[#ffffff] dark:bg-[#18181b] border border-[#dfdfdf] dark:border-[#27272a] p-0.5 rounded-[4px]">
                    <button
                      type="button"
                      onClick={() => setGroupby('mes')}
                      className={`px-2 py-0.5 text-xs rounded-[3px] transition-colors cursor-pointer focus:outline-none ${
                        groupby === 'mes' ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium' : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }`}
                    >
                      Mês
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupby('ano')}
                      className={`px-2 py-0.5 text-xs rounded-[3px] transition-colors cursor-pointer focus:outline-none ${
                        groupby === 'ano' ? 'bg-[#171717] dark:bg-[#3ecf8e] text-[#ffffff] dark:text-[#171717] font-medium' : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }`}
                    >
                      Ano
                    </button>
                  </div>
                </div>

                <div className="h-60 w-full bg-[#ffffff] dark:bg-[#18181b] p-2 rounded-[4px] border border-[#ededed] dark:border-[#27272a]">
                  {chartData ? (
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
        <div className="px-6 py-3 border-t border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
