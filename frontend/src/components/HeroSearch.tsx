import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Car, Calendar, ArrowRight, Zap } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { PresetItem, SuggestionItem } from '../types/vehicle';
import { fetchSuggestions } from '../services/api';

export interface SelectedVehicleParams {
  codigo_fipe?: string | null;
  nome_marca?: string;
  nome_modelo?: string;
  ano_modelo?: number | null;
  search_term?: string | null;
  tipo_veiculo?: string;
}

export interface HeroSearchProps {
  onSelectVehicle: (params: SelectedVehicleParams) => void;
  presets?: PresetItem[];
  currentSearch?: string;
}

export default function HeroSearch({ onSelectVehicle, presets = [], currentSearch = "" }: HeroSearchProps) {
  const [searchTerm, setSearchTerm] = useState<string>(currentSearch);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [_loading, setLoading] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchSuggestions(searchTerm);
        setSuggestions(data);
        setIsOpen(true);
      } catch (err: unknown) {
        console.error("Erro na busca:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectSuggestion = (item: SuggestionItem, ano: number | null = null) => {
    setIsOpen(false);
    onSelectVehicle({
      codigo_fipe: item.codigo_fipe,
      nome_marca: item.nome_marca,
      nome_modelo: item.nome_modelo,
      ano_modelo: ano || (item.anos && item.anos.length > 0 ? item.anos[0] : null),
      search_term: null
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setIsOpen(false);

    const yearMatch = searchTerm.match(/\b(19\d\d|20\d\d)\b/);
    const yearExtracted = yearMatch ? parseInt(yearMatch[1]) : null;
    const cleanTerm = searchTerm.replace(/\b(19\d\d|20\d\d)\b/, '').trim();

    onSelectVehicle({
      search_term: cleanTerm || searchTerm,
      ano_modelo: yearExtracted,
      codigo_fipe: null
    });
  };

  return (
    <Card className="relative p-6 sm:p-8 rounded-2xl mb-8 overflow-visible border-slate-800 bg-slate-900/90 shadow-2xl">
      <div className="max-w-3xl mx-auto text-center mb-6">
        <Badge variant="brand" className="mb-3 px-3 py-1">
          <Zap className="w-3.5 h-3.5 mr-1" />
          <span>Análise Histórica FIPE</span>
        </Badge>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
          Descubra a valorização de qualquer veículo
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Consulte o histórico mensal dos últimos anos e veja quanto o carro ganhou ou perdeu valor agrupado por ano ou mês.
        </p>
      </div>

      {/* Main Input Box */}
      <div className="max-w-2xl mx-auto relative" ref={searchRef}>
        <form onSubmit={handleCustomSubmit} className="relative flex items-center">
          <div className="absolute left-4 text-slate-400 pointer-events-none z-10">
            <Search className="w-5 h-5" />
          </div>
          <Input
            type="text"
            className="w-full h-14 pl-12 pr-28 rounded-2xl bg-slate-950 text-white placeholder:text-slate-500 text-base shadow-inner border-slate-800"
            placeholder="Digite o modelo ou Código FIPE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          />
          <Button
            type="submit"
            variant="default"
            size="lg"
            className="absolute right-2 shadow-md rounded-xl cursor-pointer"
          >
            <span>Analisar</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        {/* Autocomplete Dropdown */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-800/60">
            <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/50 flex items-center justify-between">
              <span>Modelos encontrados ({suggestions.length})</span>
              <span className="text-[10px] text-emerald-400">Clique para selecionar</span>
            </div>
            {suggestions.map((item, idx) => (
              <div key={idx} className="p-3 hover:bg-slate-900 transition-colors">
                <div className="flex items-start justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="brand">{item.codigo_fipe}</Badge>
                      <span className="text-xs text-slate-400 font-medium">{item.nome_marca}</span>
                    </div>
                    <p className="text-sm font-semibold text-white mt-1 hover:text-emerald-300">
                      {item.nome_modelo}
                    </p>
                  </div>
                </div>

                {item.anos && item.anos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/50">
                    <span className="text-[11px] text-slate-500 mr-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> Ano Modelo:
                    </span>
                    {item.anos.slice(0, 8).map((ano) => (
                      <button
                        key={ano}
                        type="button"
                        onClick={() => handleSelectSuggestion(item, ano)}
                        className="text-xs bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 px-2 py-0.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
                      >
                        {ano}
                      </button>
                    ))}
                    {item.anos.length > 8 && (
                      <span className="text-[11px] text-slate-500">+{item.anos.length - 8} anos</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preset Quick Chips */}
      {presets.length > 0 && (
        <div className="mt-6 pt-5 flex flex-wrap items-center justify-center gap-2 relative">
          <Separator className="absolute top-0 left-0 right-0 mb-5" />
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mr-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Exemplo de busca:
          </span>
          {presets.map((preset) => (
            <Button
              key={preset.id}
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchTerm(`${preset.search_term} ${preset.ano_modelo}`);
                onSelectVehicle({
                  search_term: preset.search_term,
                  ano_modelo: preset.ano_modelo,
                  tipo_veiculo: preset.tipo_veiculo,
                  codigo_fipe: null
                });
              }}
              className="rounded-full flex items-center gap-1.5 cursor-pointer"
            >
              <Car className="w-3.5 h-3.5 text-emerald-400" />
              <span>{preset.title}</span>
              {preset.badge && (
                <Badge variant="brand" className="text-[10px] py-0 px-1.5">
                  {preset.badge}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
