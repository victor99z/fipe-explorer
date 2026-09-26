import React, { useState, useEffect, useRef } from 'react';
import { Filter, Calendar, BarChart3, RefreshCw, Car, Bike, Truck, ChevronDown, Flame, Gauge, Check, X, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export default function FilterBar({ filters, onChange, onReset }) {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const brandDropdownRef = useRef(null);

  const selectedBrands = filters.marcas 
    ? filters.marcas.split(',').filter(Boolean) 
    : (filters.marca ? [filters.marca] : []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
        setBrandDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadBrands() {
      setLoadingBrands(true);
      try {
        const res = await fetch(`/api/filters/brands?tipo_veiculo=${filters.tipo_veiculo}`);
        if (res.ok) {
          const data = await res.json();
          setBrands(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBrands(false);
      }
    }
    loadBrands();
  }, [filters.tipo_veiculo]);

  useEffect(() => {
    if (selectedBrands.length === 0) {
      setModels([]);
      return;
    }
    async function loadModels() {
      setLoadingModels(true);
      try {
        const firstBrand = selectedBrands[0];
        const res = await fetch(`/api/filters/models?tipo_veiculo=${filters.tipo_veiculo}&marca=${encodeURIComponent(firstBrand)}`);
        if (res.ok) {
          const data = await res.json();
          setModels(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingModels(false);
      }
    }
    loadModels();
  }, [filters.tipo_veiculo, filters.marcas, filters.marca]);

  const toggleBrand = (brandName) => {
    let newBrands = [...selectedBrands];
    if (newBrands.includes(brandName)) {
      newBrands = newBrands.filter(b => b !== brandName);
    } else {
      newBrands.push(brandName);
    }
    const marcasStr = newBrands.join(',');
    onChange({ 
      marcas: marcasStr, 
      marca: newBrands.length === 1 ? newBrands[0] : '', 
      modelo: '', 
      ano_modelo: null, 
      codigo_fipe: null, 
      search_term: null 
    });
  };

  const clearBrands = () => {
    onChange({ marcas: '', marca: '', modelo: '', ano_modelo: null, codigo_fipe: null });
  };

  const filteredBrands = brands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));

  return (
    <Card className="mb-8 bg-slate-900/90 border-slate-800">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Filter className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base font-extrabold text-white">Filtros de Pesquisa por Veículo</CardTitle>
            <CardDescription className="text-xs text-slate-400">Selecione marca(s), modelo, motorização turbo e tipo de câmbio</CardDescription>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="self-start sm:self-auto text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1 text-emerald-400" />
          <span>Restaurar Filtros</span>
        </Button>
      </CardHeader>

      <CardContent className="pt-6 space-y-5">
        {/* Row 1: Tipo de Veículo, Multi-Marcas, Modelo, Ano Modelo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Tipo de Veículo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Tipo de Veículo</label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 h-11 items-center">
              <Button
                type="button"
                variant={filters.tipo_veiculo === 'carro' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ tipo_veiculo: 'carro', marca: '', marcas: '', modelo: '', ano_modelo: null })}
                className="h-8 text-xs font-semibold"
              >
                <Car className="w-3.5 h-3.5 mr-1" /> Carro
              </Button>
              <Button
                type="button"
                variant={filters.tipo_veiculo === 'moto' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ tipo_veiculo: 'moto', marca: '', marcas: '', modelo: '', ano_modelo: null })}
                className="h-8 text-xs font-semibold"
              >
                <Bike className="w-3.5 h-3.5 mr-1" /> Moto
              </Button>
              <Button
                type="button"
                variant={filters.tipo_veiculo === 'caminhão' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ tipo_veiculo: 'caminhão', marca: '', marcas: '', modelo: '', ano_modelo: null })}
                className="h-8 text-xs font-semibold"
              >
                <Truck className="w-3.5 h-3.5 mr-1" /> Caminhão
              </Button>
            </div>
          </div>

          {/* 2. Seleção Múltipla de Marcas */}
          <div className="relative" ref={brandDropdownRef}>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex justify-between">
              <span>Marcas (Multisseleção)</span>
              {selectedBrands.length > 0 && (
                <button onClick={clearBrands} className="text-[10px] text-emerald-400 hover:underline">Limpar ({selectedBrands.length})</button>
              )}
            </label>
            <div 
              onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
              className="flex h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 items-center justify-between cursor-pointer text-xs overflow-hidden"
            >
              <div className="truncate text-slate-200">
                {selectedBrands.length === 0 ? (
                  <span className="text-slate-500">-- Todas as Marcas --</span>
                ) : selectedBrands.length === 1 ? (
                  <span className="font-semibold text-emerald-400">{selectedBrands[0]}</span>
                ) : (
                  <span className="font-semibold text-emerald-400">{selectedBrands.length} marcas selecionadas</span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>

            {brandDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 max-h-64 overflow-y-auto">
                <div className="sticky top-0 bg-slate-950 pb-2 mb-2 border-b border-slate-800 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-500 ml-2" />
                  <Input
                    type="text"
                    placeholder="Filtrar marcas..."
                    className="h-8 text-xs border-none bg-transparent"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                  />
                </div>

                {filteredBrands.map((b) => {
                  const isSelected = selectedBrands.includes(b);
                  return (
                    <div
                      key={b}
                      onClick={() => toggleBrand(b)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-600/20 text-emerald-300 font-semibold' : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <span>{b}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Modelo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Modelo</label>
            <Select
              className="h-11"
              value={filters.modelo || ''}
              onChange={(e) => onChange({ modelo: e.target.value, ano_modelo: null, codigo_fipe: null, search_term: null })}
              disabled={selectedBrands.length === 0 || loadingModels}
            >
              <option value="">-- {selectedBrands.length > 0 ? 'Todos os Modelos' : 'Selecione uma marca'} --</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </div>

          {/* 4. Ano Modelo */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Ano do Modelo</label>
            <Select
              className="h-11"
              value={filters.ano_modelo || ''}
              onChange={(e) => onChange({ ano_modelo: e.target.value ? parseInt(e.target.value) : null })}
            >
              <option value="">-- Todos os Anos --</option>
              {Array.from({ length: 30 }, (_, i) => 2026 - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
        </div>

        {selectedBrands.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 mr-1">Marcas Selecionadas:</span>
            {selectedBrands.map(b => (
              <Badge key={b} variant="success" className="flex items-center gap-1 font-medium">
                {b}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => toggleBrand(b)} />
              </Badge>
            ))}
          </div>
        )}

        {/* Row 2: Motorização, Câmbio, Visão & Métrica */}
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center relative">
          <Separator className="absolute top-0 left-0 right-0" />
          {/* Motorização */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Motorização</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 h-10 items-center">
              <Button
                type="button"
                variant={(!filters.motorizacao || filters.motorizacao === 'todos') ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ motorizacao: 'todos' })}
                className="h-8 text-[11px]"
              >
                Todos
              </Button>
              <Button
                type="button"
                variant={filters.motorizacao === 'turbo' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ motorizacao: 'turbo' })}
                className={`h-8 text-[11px] ${filters.motorizacao === 'turbo' ? 'bg-amber-600 hover:bg-amber-500' : ''}`}
              >
                🔥 Turbo
              </Button>
              <Button
                type="button"
                variant={filters.motorizacao === 'aspirado' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ motorizacao: 'aspirado' })}
                className="h-8 text-[11px]"
              >
                Aspirado
              </Button>
            </div>
          </div>

          {/* Transmissão */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Transmissão / Câmbio</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 h-10 items-center">
              <Button
                type="button"
                variant={(!filters.cambio || filters.cambio === 'todos') ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ cambio: 'todos' })}
                className="h-8 text-[11px]"
              >
                Todos
              </Button>
              <Button
                type="button"
                variant={filters.cambio === 'automatico' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ cambio: 'automatico' })}
                className={`h-8 text-[11px] ${filters.cambio === 'automatico' ? 'bg-cyan-600 hover:bg-cyan-500' : ''}`}
              >
                Aut / CVT
              </Button>
              <Button
                type="button"
                variant={filters.cambio === 'manual' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ cambio: 'manual' })}
                className="h-8 text-[11px]"
              >
                Manual
              </Button>
            </div>
          </div>

          {/* Agrupamento Temporal */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Agrupamento Temporal</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 h-10 items-center">
              <Button
                type="button"
                variant={filters.groupby === 'ano' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ groupby: 'ano' })}
                className="h-8 text-xs"
              >
                <Calendar className="w-3.5 h-3.5 mr-1" /> Por Ano
              </Button>
              <Button
                type="button"
                variant={filters.groupby === 'mes' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange({ groupby: 'mes' })}
                className="h-8 text-xs"
              >
                <BarChart3 className="w-3.5 h-3.5 mr-1" /> Por Mês
              </Button>
            </div>
          </div>

          {/* Métrica do Ano */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Métrica do Ano</label>
            <Select
              className="h-10 text-xs"
              value={filters.metrica_ano || 'media'}
              onChange={(e) => onChange({ metrica_ano: e.target.value })}
              disabled={filters.groupby === 'mes'}
            >
              <option value="media">Média Anual</option>
              <option value="fechamento">Fechamento (Dezembro)</option>
              <option value="max">Maior Valor</option>
              <option value="min">Menor Valor</option>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
