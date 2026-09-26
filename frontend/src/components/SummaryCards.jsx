import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Award, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';

export default function SummaryCards({ summary, info }) {
  if (!summary) return null;

  const isUp = summary.variacao_total_pct >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {/* 1. Valor Inicial */}
      <Card className="relative overflow-hidden bg-slate-900/90 border-slate-800">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Valor Inicial</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-extrabold text-white font-mono-num mb-1">
            {summary.valor_inicial_formatado}
          </div>
          <p className="text-xs text-slate-400">
            Ref: <strong className="text-slate-300">{summary.data_inicial}</strong>
          </p>
        </CardContent>
      </Card>

      {/* 2. Valor Atual */}
      <Card className="relative overflow-hidden bg-slate-900/90 border-slate-800">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Valor Atual</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-extrabold text-emerald-400 font-mono-num mb-1">
            {summary.valor_atual_formatado}
          </div>
          <p className="text-xs text-slate-400">
            Ref: <strong className="text-slate-300">{summary.data_atual}</strong>
          </p>
        </CardContent>
      </Card>

      {/* 3. Variação Total */}
      <Card className={`relative overflow-hidden border-slate-800 ${
        isUp ? 'bg-emerald-950/20' : 'bg-rose-950/20'
      }`}>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Variação Total</span>
            {isUp ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-2xl font-extrabold font-mono-num ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isUp ? '+' : ''}{summary.variacao_total_pct}%
            </span>
            <span className="text-xs text-slate-400 font-mono-num">
              ({isUp ? '+' : ''}{summary.variacao_total_rs_formatada})
            </span>
          </div>
          <Badge variant={isUp ? 'success' : 'destructive'} className="uppercase">
            {summary.tendencia === 'valorizou' ? '🚀 Valorizou' : summary.tendencia === 'desvalorizou' ? '📉 Desvalorizou' : '⚖️ Estável'}
          </Badge>
        </CardContent>
      </Card>

      {/* 4. Maior Pico */}
      <Card className="relative overflow-hidden bg-slate-900/90 border-slate-800">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Maior Pico</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-xl font-bold text-amber-300 font-mono-num mb-1">
            {summary.valor_maximo_formatado}
          </div>
          <p className="text-xs text-slate-400">
            Pico em: <strong className="text-slate-300">{summary.data_maximo}</strong>
          </p>
        </CardContent>
      </Card>

      {/* 5. CAGR */}
      <Card className="relative overflow-hidden bg-slate-900/90 border-slate-800">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Taxa Anual (CAGR)</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-xl font-bold text-purple-300 font-mono-num mb-1">
            {summary.cagr_pct > 0 ? '+' : ''}{summary.cagr_pct}% / ano
          </div>
          <p className="text-xs text-slate-400">
            Mínimo FIPE: <strong className="text-slate-300">{summary.valor_minimo_formatado}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
