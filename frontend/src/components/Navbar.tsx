import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Car,
  ChevronDown,
  Database,
  ExternalLink,
  History,
  LogIn,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type AppSection = 'fipe' | 'joinville' | 'history' | 'alerts' | 'admin';

export interface NavbarProps {
  theme: 'light' | 'dark' | string;
  onToggleTheme: () => void;
  activeSection: AppSection;
  onChangeSection: (section: AppSection) => void;
  onOpenAuth: (reason?: string) => void;
}

export default function Navbar({
  theme,
  onToggleTheme,
  activeSection,
  onChangeSection,
  onOpenAuth,
}: NavbarProps) {
  const { user, isAuthenticated, isAdmin, unreadAlertsCount, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const navItems: Array<{
    id: AppSection;
    label: string;
    shortLabel?: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'fipe', label: 'Tabela FIPE', shortLabel: 'FIPE', icon: BarChart3 },
    { id: 'joinville', label: 'Anúncios Joinville', shortLabel: 'Anúncios', icon: Car },
    ...(isAuthenticated
      ? [
          {
            id: 'history' as const,
            label: 'Histórico Modelos',
            shortLabel: 'Histórico',
            icon: History,
          },
          {
            id: 'alerts' as const,
            label: 'Alertas',
            icon: Bell,
            badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
          },
        ]
      : []),
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', icon: Shield }] : []),
  ];

  return (
    <header className="border-b border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-2 sm:gap-x-3">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M13.4 2L3 14.5H11.5L10.6 22L21 9.5H12.5L13.4 2Z"
              fill="#3ecf8e"
              stroke="#24b47e"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-medium text-lg text-[#171717] dark:text-[#ededed] tracking-tight">
            fipe<span className="text-[#3ecf8e]">x</span>
          </span>
        </div>

        {/* Primary navigation */}
        <nav
          aria-label="Navegação principal"
          className="order-last w-full md:order-none md:w-auto md:flex-1 flex items-center gap-1 sm:gap-1.5 overflow-x-auto md:overflow-visible no-scrollbar border-t border-[#ededed]/70 dark:border-[#27272a]/70 pt-2 mt-2 md:border-t-0 md:pt-0 md:mt-0 md:ml-3 py-0.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChangeSection(item.id)}
                className={`relative shrink-0 h-8 inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 rounded-[6px] text-[11px] sm:text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/50'
                    : 'bg-[#fafafa] dark:bg-[#18181b] text-[#707070] dark:text-[#a1a1aa] border-[#ededed] dark:border-[#27272a] hover:text-[#171717] dark:hover:text-[#ededed]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {item.shortLabel ? (
                  <>
                    <span className="hidden xl:inline">{item.label}</span>
                    <span className="xl:hidden">{item.shortLabel}</span>
                  </>
                ) : (
                  <span>{item.label}</span>
                )}
                {item.badge !== undefined && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#3ecf8e] text-[#171717] text-[10px] font-bold tabular-nums leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto md:ml-0">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            title="Documentação interativa da API (Swagger UI)"
            className="hidden xl:inline-flex h-8 items-center gap-1.5 text-xs font-medium leading-none text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed] bg-[#fafafa] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] hover:border-[#dfdfdf] dark:hover:border-[#3f3f46] px-2.5 rounded-[6px] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#3ecf8e] shrink-0" aria-hidden="true" />
            <span>API Docs</span>
            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" aria-hidden="true" />
          </a>

          <div className="hidden xl:inline-flex h-8 items-center gap-1.5 text-xs font-medium leading-none tabular-nums text-[#707070] dark:text-[#a1a1aa] bg-[#fafafa] dark:bg-[#18181b] border border-[#ededed] dark:border-[#27272a] px-2.5 rounded-[6px]">
            <Database className="w-3.5 h-3.5 text-[#3ecf8e] shrink-0" aria-hidden="true" />
            <span>9,42M</span>
          </div>

          {isAuthenticated && user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((o) => !o)}
                className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#18181b] hover:border-[#3ecf8e]/50 text-xs font-medium text-[#171717] dark:text-[#ededed] cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-[#3ecf8e] shrink-0" aria-hidden="true" />
                <span className="max-w-[90px] truncate hidden lg:inline">{user.name}</span>
                {isAdmin && (
                  <span className="px-1 py-0.5 rounded-[3px] bg-[#3ecf8e]/20 text-[#15803d] dark:text-[#3ecf8e] text-[9px] font-semibold uppercase leading-none">
                    Admin
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-70" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-56 rounded-lg border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] shadow-xl py-1.5 z-50"
                >
                  <div className="px-3 py-2 border-b border-[#ededed] dark:border-[#27272a]">
                    <p className="text-xs font-semibold text-[#171717] dark:text-[#ededed] truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] truncate">
                      {user.email}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onChangeSection('alerts');
                    }}
                    className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#fafafa] dark:hover:bg-[#27272a] cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-[#3ecf8e]" aria-hidden="true" />
                      Meus Alertas
                    </span>
                    {unreadAlertsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#3ecf8e] text-[#171717] text-[10px] font-bold tabular-nums">
                        {unreadAlertsCount}
                      </span>
                    )}
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onChangeSection('admin');
                      }}
                      className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-[#fafafa] dark:hover:bg-[#27272a] cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#3ecf8e]" aria-hidden="true" />
                      <span>Área Administrativa</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-[#ededed] dark:border-[#27272a]" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      if (
                        activeSection === 'admin' ||
                        activeSection === 'alerts' ||
                        activeSection === 'history'
                      ) {
                        onChangeSection('fipe');
                      }
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 hover:bg-[#fafafa] dark:hover:bg-[#27272a] cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth()}
              className="h-8 inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Entrar</span>
            </button>
          )}

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
