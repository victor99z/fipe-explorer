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
      const saved = localStorage.getItem('fipex_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('fipex_theme', theme);
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
    <div className="min-h-screen flex flex-col bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed] transition-colors">
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        activeSection={activeSection}
        onChangeSection={setActiveSection}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {activeSection === 'fipe' ? (
          <BudgetFinderView onSearchListings={handleSearchVehicleListings} />
        ) : (
          <JoinvilleCarsView initialSearch={listingsSearch} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] py-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-[#707070] dark:text-[#a1a1aa] space-y-1.5">
          <p className="font-mono">fipex.parquet • DuckDB SQL Engine</p>
          <p className="text-[#9a9a9a] dark:text-[#71717a]">9.42M registros históricos FIPE processados em milissegundos</p>
          <p className="pt-2 text-[11px] text-[#707070] dark:text-[#a1a1aa] flex items-center justify-center gap-1 flex-wrap">
            <span>Agradecimento ao</span>
            <a
              href="https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#171717] dark:text-[#ededed] hover:text-[#3ecf8e] dark:hover:text-[#3ecf8e] font-mono font-medium underline underline-offset-2 transition-colors"
            >
              alanwgt/fipex-veiculos-brasil
              <ExternalLink className="w-3 h-3 text-[#3ecf8e]" />
            </a>
            <span>pelo dataset</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
