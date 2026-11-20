import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import Navbar, { type AppSection } from './components/Navbar';
import BudgetFinderView from './components/BudgetFinderView';
import JoinvilleCarsView, { type FipeListingSearchIntent } from './components/joinville/JoinvilleCarsView';
import type { Vehicle } from './types/vehicle';

function normalizeFipeBrand(rawBrand: string): string {
  const trimmed = rawBrand.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes('volkswagen') || lower.startsWith('vw')) return 'Volkswagen';
  if (lower.includes('chevrolet') || lower.startsWith('gm')) return 'Chevrolet';
  if (lower.includes('caoa chery')) return 'Caoa Chery';
  if (lower.startsWith('kia')) return 'Kia';
  if (lower.includes('citro')) return 'Citroën';
  return trimmed;
}

function normalizeFipeFuel(rawFuel?: string | null): string | undefined {
  if (!rawFuel) return undefined;
  const lower = rawFuel.trim().toLowerCase();
  if (lower.includes('elétric') || lower.includes('eletric')) return 'Elétrico';
  if (lower.includes('híbrid') || lower.includes('hibrid')) return 'Híbrido';
  if (lower.includes('flex')) return 'Flex';
  if (lower.includes('diesel')) return 'Diesel';
  if (lower.includes('gasolina')) return 'Gasolina';
  if (lower.includes('álcool') || lower.includes('etanol')) return 'Etanol';
  return rawFuel.trim() || undefined;
}

function buildListingSearchIntent(vehicle: Vehicle): FipeListingSearchIntent {
  const brand = normalizeFipeBrand(vehicle.nome_marca || '');
  const firstModelToken = (vehicle.nome_modelo || '')
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^\p{L}\p{N}.-]/gu, '');

  const term = [brand, firstModelToken].filter(Boolean).join(' ').trim();
  const transmission = vehicle.is_automatico
    ? 'Automático'
    : vehicle.tipo_cambio === 'Manual'
      ? 'Manual'
      : undefined;

  return {
    term,
    brand: brand || undefined,
    model: firstModelToken || undefined,
    year: vehicle.ano_modelo ?? undefined,
    transmission,
    fuel: normalizeFipeFuel(vehicle.nome_combustivel),
    codigoFipe: vehicle.codigo_fipe || undefined,
    fipeLabel: [brand, vehicle.nome_modelo, vehicle.ano_modelo ? `(${vehicle.ano_modelo})` : '']
      .filter(Boolean)
      .join(' '),
    nonce: Date.now(),
  };
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('fipe');
  const [listingsSearch, setListingsSearch] = useState<FipeListingSearchIntent | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fipex_knolling_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('fipex_knolling_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSearchVehicleListings = (vehicle: Vehicle) => {
    setListingsSearch(buildListingSearchIntent(vehicle));
    setActiveSection('joinville');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col knolling-split-bg text-[#2D2D2D] dark:text-[#F5F2F3] transition-colors duration-200">
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        activeSection={activeSection}
        onChangeSection={setActiveSection}
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-8 sm:py-12">
        {activeSection === 'fipe' ? (
          <BudgetFinderView onSearchListings={handleSearchVehicleListings} />
        ) : (
          <JoinvilleCarsView initialSearch={listingsSearch} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FFFDFB]/90 dark:bg-[#2D2D2D]/90 backdrop-blur-xs py-8 mt-14 transition-colors duration-200">
        <div className="max-w-[1280px] mx-auto px-6 text-center text-xs text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 space-y-1.5">
          <p className="font-mono font-medium text-[#2D2D2D] dark:text-[#F5F2F3]">
            SPEC. 90° // fipex.parquet • DuckDB SQL Engine
          </p>
          <p className="text-[#2D2D2D]/65 dark:text-[#F5F2F3]/65 tabular-nums">
            9,42M registros históricos FIPE processados em milissegundos
          </p>
          <p className="pt-2 text-[11px] flex items-center justify-center gap-1 flex-wrap">
            <span>Agradecimento ao</span>
            <a
              href="https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#2D2D2D] dark:text-[#F5F2F3] bg-[#CBE4F0]/55 hover:bg-[#CBE4F0] dark:bg-[#3B3948] dark:hover:bg-[#CBE4F0] dark:hover:text-[#2D2D2D] px-2 py-0.5 rounded-[8px] font-mono font-medium border border-[#2D2D2D]/15 transition-colors"
            >
              <span>alanwgt/fipex-veiculos-brasil</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            <span>pelo dataset</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
