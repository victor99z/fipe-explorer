import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { LineChart, BarChart2, Layers, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ChartSection({ series = [], info = {} }) {
  const [chartMode, setChartMode] = useState('line'); // 'line', 'bar', 'minmax'

  if (!series || series.length === 0) return null;

  const labels = series.map(item => item.periodo);

  const lineData = {
    labels,
    datasets: [
      {
        label: 'Valor FIPE (R$)',
        data: series.map(item => item.valor),
        borderColor: '#10b981',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#34d399',
        pointBorderColor: '#064e3b',
        pointRadius: 4,
        pointHoverRadius: 7,
      }
    ]
  };

  const barData = {
    labels,
    datasets: [
      {
        label: 'Variação no Período (%)',
        data: series.map(item => item.variacao_periodo_pct),
        backgroundColor: series.map(item => 
          item.variacao_periodo_pct >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(244, 63, 94, 0.75)'
        ),
        borderColor: series.map(item => 
          item.variacao_periodo_pct >= 0 ? '#10b981' : '#f43f5e'
        ),
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  };

  const minMaxData = {
    labels,
    datasets: [
      {
        label: 'Valor Máximo no Ano (R$)',
        data: series.map(item => item.valor_max),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: 'Valor Médio (R$)',
        data: series.map(item => item.valor),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.3,
        pointRadius: 4,
      },
      {
        label: 'Valor Mínimo no Ano (R$)',
        data: series.map(item => item.valor_min),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.3,
        pointRadius: 3,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#34d399',
        bodyColor: '#f8fafc',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              if (chartMode === 'bar') {
                label += context.parsed.y.toFixed(2) + '%';
              } else {
                label += 'R$ ' + context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Plus Jakarta Sans', size: 11 },
          callback: function(value) {
            if (chartMode === 'bar') return value + '%';
            return 'R$ ' + (value / 1000).toFixed(0) + 'k';
          }
        }
      }
    }
  };

  return (
    <Card className="mb-8 bg-slate-900/90 border-slate-800">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <CardTitle className="text-xl font-extrabold text-white">
            {info.nome_marca} - {info.nome_modelo} {info.ano_modelo ? `(${info.ano_modelo})` : ''}
          </CardTitle>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Período analisado: {info.periodo_inicial} até {info.periodo_final} • Total de observações: {series.length} {info.groupby === 'mes' ? 'meses' : 'anos'}
          </CardDescription>
        </div>

        {/* Chart View Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <Button
            variant={chartMode === 'line' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartMode('line')}
          >
            <LineChart className="w-3.5 h-3.5 mr-1" /> Preço (R$)
          </Button>
          <Button
            variant={chartMode === 'bar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartMode('bar')}
          >
            <BarChart2 className="w-3.5 h-3.5 mr-1" /> Variação (%)
          </Button>
          <Button
            variant={chartMode === 'minmax' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartMode('minmax')}
          >
            <Layers className="w-3.5 h-3.5 mr-1" /> Faixa Mín/Máx
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="w-full h-80 sm:h-96 relative">
          {chartMode === 'line' && <Line data={lineData} options={chartOptions} />}
          {chartMode === 'bar' && <Bar data={barData} options={chartOptions} />}
          {chartMode === 'minmax' && <Line data={minMaxData} options={chartOptions} />}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          {chartMode === 'line' && "Gráfico exibindo o preço FIPE ajustado em Reais (R$) a cada período."}
          {chartMode === 'bar' && "Barras verdes indicam valorização e barras vermelhas indicam desvalorização em relação ao período anterior."}
          {chartMode === 'minmax' && "Comparativo entre o menor valor, valor médio e maior valor registrado na tabela FIPE para este veículo."}
        </span>
      </CardFooter>
    </Card>
  );
}
