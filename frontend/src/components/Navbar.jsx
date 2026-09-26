import React from 'react';
import { Database, Sparkles, TrendingUp } from 'lucide-react';
import { Badge } from './ui/badge';

export default function Navbar() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg text-white tracking-tight">FIPEX<span className="text-blue-400">.parquet</span></h1>
              <Badge variant="brand" className="uppercase text-[10px]">
                PRO 2026
              </Badge>
            </div>
            <p className="text-xs text-slate-400">Histórico FIPE & Valorização de Veículos ao longo do Tempo</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Base Parquet: <strong className="text-emerald-400">9.4M+ registros</strong></span>
          </div>

          <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-slate-300 font-normal">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>DuckDB Ultra Fast Engine</span>
          </Badge>
        </div>
      </div>
    </header>
  );
}
