import React, { useState } from 'react';
import { GitCompare, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { HistoryInfo, HistoryPoint, HistorySummary } from '../types/vehicle';
import { fetchVehicleHistory } from '../services/api';

export interface CompareItem {
  id: number;
  title: string;
  info: HistoryInfo;
  summary: HistorySummary;
  series: HistoryPoint[];
}

export interface ComparisonSectionProps {
  primaryInfo?: HistoryInfo | null;
  primarySeries?: HistoryPoint[];
}

export default function ComparisonSection({ primaryInfo, primarySeries }: ComparisonSectionProps) {
  const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [yearTerm, setYearTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    if (compareItems.length >= 3) {
      setErrorMsg("Você pode comparar até 3 veículos por vez.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const yearVal = yearTerm ? parseInt(yearTerm) : undefined;
      const data = await fetchVehicleHistory({
        search_term: searchTerm.trim(),
        ano_modelo: yearVal,
        groupby: 'ano'
      });

      setCompareItems(prev => [...prev, {
        id: Date.now(),
        title: `${data.info.nome_marca} ${searchTerm} (${data.info.ano_modelo || yearVal || 'Todos'})`,
        info: data.info,
        summary: data.summary,
        series: data.series
      }]);
      setSearchTerm('');
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Veículo não encontrado. Tente outro modelo ou ano.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (id: number) => {
    setCompareItems(prev => prev.filter(item => item.id !== id));
  };

  const allLabelsSet = new Set<string>();
  if (primarySeries) {
    primarySeries.forEach(s => allLabelsSet.add(s.periodo));
  }
  compareItems.forEach(item => {
    item.series.forEach(s => allLabelsSet.add(s.periodo));
  });

  const sortedLabels = Array.from(allLabelsSet).sort();
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'];

  const datasets: Array<{
    label: string;
    data: (number | null)[];
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
    tension: number;
    pointRadius: number;
    borderDash?: number[];
  }> = [];

  if (primarySeries && primaryInfo) {
    datasets.push({
      label: `${primaryInfo.nome_marca} - ${primaryInfo.nome_modelo} (${primaryInfo.ano_modelo || 'Ano'})`,
      data: sortedLabels.map(l => {
        const found = primarySeries.find(s => s.periodo === l);
        return found ? found.valor : null;
      }),
      borderColor: colors[0],
      backgroundColor: 'transparent',
      borderWidth: 3,
      tension: 0.3,
      pointRadius: 4,
    });
  }

  compareItems.forEach((comp, idx) => {
    datasets.push({
      label: comp.title,
      data: sortedLabels.map(l => {
        const found = comp.series.find(s => s.periodo === l);
        return found ? found.valor : null;
      }),
      borderColor: colors[(idx + 1) % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [4, 4],
      tension: 0.3,
      pointRadius: 3,
    });
  });

  const chartData = {
    labels: sortedLabels,
    datasets
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#cbd5e1', font: { size: 12, weight: 600 } }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: R$ ${ctx.parsed.y ? ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };

  return (
    <Card className="mb-8 bg-slate-900/90 border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-emerald-400" />
          <CardTitle className="text-base font-extrabold text-white">Ferramenta de Comparação Lado a Lado</CardTitle>
        </div>
        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
          Compare desvalorização de até 3 modelos
        </Badge>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleAddVehicle} className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            type="text"
            placeholder="Digite modelo ou marca para comparar..."
            className="flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Ano modelo"
            className="w-full sm:w-28"
            value={yearTerm}
            onChange={(e) => setYearTerm(e.target.value)}
          />
          <Button
            type="submit"
            disabled={loading}
            variant="default"
            className="shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span>{loading ? 'Buscando...' : 'Adicionar ao Comparativo'}</span>
          </Button>
        </form>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {compareItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {compareItems.map((item) => (
              <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-emerald-400 font-bold font-mono-num">{item.summary.valor_atual_formatado}</span>
                    <Badge variant={item.summary.variacao_total_pct >= 0 ? 'success' : 'destructive'}>
                      {item.summary.variacao_total_pct >= 0 ? '+' : ''}{item.summary.variacao_total_pct}%
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-slate-500 hover:text-rose-400 h-8 w-8 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {compareItems.length > 0 && (
          <div className="w-full h-80 relative pt-2">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
