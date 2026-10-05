import React, { useState } from 'react';
import { Table as TableIcon, Download, Search, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import { HistoryPoint, HistoryInfo } from '../types/vehicle';

export interface DataTableSectionProps {
  series?: HistoryPoint[];
  info?: HistoryInfo;
}

export default function DataTableSection({ series = [], info }: DataTableSectionProps) {
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  if (!series || series.length === 0) return null;

  const filteredSeries = series.filter(item => 
    item.periodo.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const sortedSeries = [...filteredSeries].sort((a, b) => {
    if (sortAsc) {
      return a.ano_referencia - b.ano_referencia || a.mes_referencia - b.mes_referencia;
    } else {
      return b.ano_referencia - a.ano_referencia || b.mes_referencia - a.mes_referencia;
    }
  });

  const exportToCSV = () => {
    const headers = ["Periodo", "Ano_Referencia", "Mes_Referencia", "Valor_R$", "Variacao_Periodo_RS", "Variacao_Periodo_PCT", "Variacao_Acumulada_PCT", "Valor_Min_RS", "Valor_Max_RS"];
    const rows = series.map(s => [
      s.periodo,
      s.ano_referencia,
      s.mes_referencia,
      s.valor,
      s.variacao_periodo_rs,
      s.variacao_periodo_pct,
      s.variacao_acumulada_pct,
      s.valor_min,
      s.valor_max
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `fipe_historico_${info?.nome_marca || 'carro'}_${info?.ano_modelo || 'ano'}.csv`.replace(/\s+/g, '_');
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="mb-8 bg-slate-900/90 border-slate-800">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-2">
          <TableIcon className="w-5 h-5 text-emerald-400" />
          <div>
            <CardTitle className="text-base font-extrabold text-white">Tabela Histórica Detalhada</CardTitle>
            <CardDescription className="text-xs text-slate-400">Valores agrupados por {series[0]?.periodo?.includes('/') ? 'Mês' : 'Ano'}</CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Filtrar ano/mês..."
              className="pl-8 text-xs h-9"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 p-0 sm:p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer hover:text-white" onClick={() => setSortAsc(!sortAsc)}>
                <div className="flex items-center gap-1">
                  <span>Período</span>
                  {sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
              </TableHead>
              <TableHead className="text-right">Valor FIPE (R$)</TableHead>
              <TableHead className="text-right">Variação (R$)</TableHead>
              <TableHead className="text-center">Variação (%)</TableHead>
              <TableHead className="text-right">Acumulado (%)</TableHead>
              <TableHead className="text-right">Mín - Máx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-mono-num text-slate-300">
            {sortedSeries.map((row, idx) => {
              const isPeriodUp = row.variacao_periodo_pct >= 0;
              const isAccumUp = row.variacao_acumulada_pct >= 0;

              return (
                <TableRow key={idx}>
                  <TableCell className="font-bold text-white font-sans">
                    {row.periodo}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-400">
                    {row.valor_formatado}
                  </TableCell>
                  <TableCell className={`text-right ${
                    row.variacao_periodo_rs > 0 ? 'text-emerald-400' : row.variacao_periodo_rs < 0 ? 'text-rose-400' : 'text-slate-400'
                  }`}>
                    {row.variacao_periodo_rs > 0 ? '+' : ''}{row.variacao_periodo_rs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={isPeriodUp ? 'success' : 'destructive'}>
                      {isPeriodUp ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {isPeriodUp ? '+' : ''}{row.variacao_periodo_pct}%
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${
                    isAccumUp ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {isAccumUp ? '+' : ''}{row.variacao_acumulada_pct}%
                  </TableCell>
                  <TableCell className="text-right text-slate-400 text-[11px]">
                    R$ {(row.valor_min/1000).toFixed(1)}k - R$ {(row.valor_max/1000).toFixed(1)}k
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
