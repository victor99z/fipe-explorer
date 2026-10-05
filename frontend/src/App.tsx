import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import Navbar from './components/Navbar';
import BudgetFinderView from './components/BudgetFinderView';

export default function App() {
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

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed] transition-colors">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <BudgetFinderView />
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
