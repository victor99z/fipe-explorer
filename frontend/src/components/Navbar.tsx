import React from 'react';
import { Database, Sun, Moon, BookOpen, ExternalLink, Car, BarChart3 } from 'lucide-react';

export type AppSection = 'fipe' | 'joinville';

export interface NavbarProps {
  theme: 'light' | 'dark' | string;
  onToggleTheme: () => void;
  activeSection: AppSection;
  onChangeSection: (section: AppSection) => void;
}

export default function Navbar({
  theme,
  onToggleTheme,
  activeSection,
  onChangeSection,
}: NavbarProps) {
  return (
    <header className="border-b border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 bg-[#FFFDFB]/95 dark:bg-[#2D2D2D]/95 backdrop-blur-xs sticky top-0 z-[100] transition-colors duration-200">
      <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          {/* Knolling 90° Geometric Tray Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="11" height="11" rx="2.5" fill="#F6D0D6" stroke="#2D2D2D" strokeWidth="1.5" />
              <rect x="15" y="2" width="11" height="11" rx="2.5" fill="#CBE4F0" stroke="#2D2D2D" strokeWidth="1.5" />
              <rect x="2" y="15" width="11" height="11" rx="2.5" fill="#D0F0C0" stroke="#2D2D2D" strokeWidth="1.5" />
              <rect x="15" y="15" width="11" height="11" rx="2.5" fill="#E6E6FA" stroke="#2D2D2D" strokeWidth="1.5" />
            </svg>
            <span className="font-bold text-lg text-[#2D2D2D] dark:text-[#F5F2F3] tracking-tight">
              fipe<span className="font-mono text-sm px-1.5 py-0.5 ml-0.5 rounded-[6px] bg-[#CBE4F0] text-[#2D2D2D] border border-[#2D2D2D]/15">x</span>
            </span>
          </div>

          {/* Primary mode navigation */}
          <nav aria-label="Navegação principal" className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={activeSection === 'fipe'}
              onClick={() => onChangeSection('fipe')}
              className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs border transition-all duration-200 cursor-pointer ${
                activeSection === 'fipe'
                  ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-medium shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'bg-[#FFFDFB] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 hover:bg-[#F6D0D6]/40 hover:text-[#2D2D2D] dark:hover:bg-[#3B3948]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Tabela FIPE</span>
            </button>

            <button
              type="button"
              aria-pressed={activeSection === 'joinville'}
              onClick={() => onChangeSection('joinville')}
              className={`h-8 inline-flex items-center gap-1.5 px-3 rounded-xl text-xs border transition-all duration-200 cursor-pointer ${
                activeSection === 'joinville'
                  ? 'bg-[#CBE4F0] text-[#2D2D2D] border-[#2D2D2D]/25 font-medium shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'bg-[#FFFDFB] dark:bg-[#242226] text-[#2D2D2D]/75 dark:text-[#F5F2F3]/75 border-[#2D2D2D]/15 dark:border-[#F5F2F3]/15 hover:bg-[#E6E6FA]/60 hover:text-[#2D2D2D] dark:hover:bg-[#3B3948]'
              }`}
            >
              <Car className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Anúncios Joinville</span>
            </button>
          </nav>
        </div>

        {/* Right side: API Docs + Records pill + Theme toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            title="Documentação interativa da API (Swagger UI)"
            className="h-8 inline-flex items-center gap-1.5 text-xs font-medium leading-none text-[#2D2D2D] bg-[#E6E6FA]/85 hover:bg-[#E6E6FA] border border-[#2D2D2D]/15 px-3 rounded-xl transition-colors duration-200"
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">API Docs</span>
            <ExternalLink className="w-3 h-3 opacity-70 hidden md:inline-block shrink-0" aria-hidden="true" />
          </a>

          <div className="h-8 inline-flex items-center gap-1.5 text-xs font-medium leading-none tabular-nums text-[#2D2D2D] bg-[#D0F0C0]/85 border border-[#2D2D2D]/15 px-3 rounded-xl">
            <Database className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>9,42M<span className="hidden sm:inline"> registros</span></span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Alternar modo claro / escuro"
            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            className="h-8 w-8 inline-flex items-center justify-center rounded-xl border border-[#2D2D2D]/20 dark:border-[#F5F2F3]/20 bg-[#FFFDFB] dark:bg-[#242226] text-[#2D2D2D] dark:text-[#F5F2F3] hover:bg-[#F6D0D6]/45 dark:hover:bg-[#3B3948] transition-colors duration-200 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#CBE4F0]" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-[#2D2D2D]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
