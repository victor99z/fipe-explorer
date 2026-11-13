import React from 'react';
import { Database, Sun, Moon, BookOpen, ExternalLink } from 'lucide-react';

export interface NavbarProps {
  theme: 'light' | 'dark' | string;
  onToggleTheme: () => void;
}

export default function Navbar({ theme, onToggleTheme }: NavbarProps) {
  return (
    <header className="border-b border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          {/* Supabase-style emerald geometric mark */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M13.4 2L3 14.5H11.5L10.6 22L21 9.5H12.5L13.4 2Z" fill="#3ecf8e" stroke="#24b47e" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          <span className="font-medium text-lg text-[#171717] dark:text-[#ededed] tracking-tight">
            fipe<span className="text-[#3ecf8e]">x</span>
          </span>
        </div>

        {/* Right side: API Docs link + Database records badge + Dark mode toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            title="Documentação interativa da API (Swagger UI)"
            className="h-8 inline-flex items-center gap-1.5 text-xs font-medium leading-none text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] bg-[#fafafa] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] hover:border-[#dfdfdf] dark:hover:border-[#3f3f46] px-2.5 sm:px-3 rounded-[6px] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#3ecf8e] shrink-0" aria-hidden="true" />
            <span>API Docs</span>
            <ExternalLink className="w-3 h-3 opacity-60 hidden sm:inline-block shrink-0" aria-hidden="true" />
          </a>

          <div className="h-8 inline-flex items-center gap-1.5 text-xs font-medium leading-none tabular-nums text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] px-2.5 sm:px-3 rounded-[6px]">
            <Database className="w-3.5 h-3.5 text-[#3ecf8e] shrink-0" aria-hidden="true" />
            <span>9,42M<span className="hidden sm:inline"> registros</span></span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Alternar modo claro / escuro"
            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            className="h-8 w-8 inline-flex items-center justify-center rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] hover:bg-[#fafafa] dark:hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#3ecf8e]" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-[#707070]" aria-hidden="true" />
            )}
          </button>
        </div>

      </div>
    </header>
  );
}
