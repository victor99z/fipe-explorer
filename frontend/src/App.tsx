import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import Navbar, { type AppSection } from './components/Navbar';
import BudgetFinderView from './components/BudgetFinderView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/auth/AuthModal';
import { AlertFormModal } from './components/alerts/AlertFormModal';
import {
  createUserAlert,
  evaluateAlertAgainstCatalog,
  type CarAlertInput,
} from './services/alerts';
import type { FipeListingSearchIntent } from './components/joinville/JoinvilleCarsView';
import type { ModelHistoryIntent } from './components/history/ModelHistoryView';
import type { Vehicle } from './types/vehicle';
import {
  getTabParamForSection,
  parseSectionFromUrl,
  syncUrlSearchParams,
} from './lib/urlState';

const JoinvilleCarsView = lazy(
  () => import('./components/joinville/JoinvilleCarsView'),
);
const ModelHistoryView = lazy(
  () => import('./components/history/ModelHistoryView'),
);
const AlertsView = lazy(() => import('./components/alerts/AlertsView'));
const AdminView = lazy(() => import('./components/admin/AdminView'));

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
    ? 'Automático & CVT'
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

function SectionLoader() {
  return (
    <div className="py-20 flex flex-col items-center justify-center gap-2">
      <Loader2 className="w-6 h-6 text-[#3ecf8e] animate-spin" />
      <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">Carregando seção...</p>
    </div>
  );
}

function AppContent() {
  const { pb, user, isAuthenticated, isAdmin, refreshUnreadCount } = useAuth();

  const [activeSection, setActiveSection] = useState<AppSection>(() => {
    const fromUrl = parseSectionFromUrl();
    if ((fromUrl === 'history' || fromUrl === 'alerts') && !pb.authStore.isValid) {
      return 'fipe';
    }
    if (fromUrl === 'admin') {
      const rec = pb.authStore.record as Record<string, unknown> | null;
      const col = String(rec?.collectionName ?? '');
      const role = String(rec?.role ?? '').toLowerCase();
      const canAdmin =
        pb.authStore.isValid &&
        (col === '_superusers' || col === '_admins' || role === 'admin');
      return canAdmin ? 'admin' : 'fipe';
    }
    return fromUrl;
  });
  const [listingsSearch, setListingsSearch] = useState<FipeListingSearchIntent | null>(null);
  const [historyIntent, setHistoryIntent] = useState<ModelHistoryIntent | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);

  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertPrefill, setAlertPrefill] = useState<Partial<CarAlertInput> | null>(null);
  const [pendingAlertAfterAuth, setPendingAlertAfterAuth] =
    useState<Partial<CarAlertInput> | null>(null);
  const [pendingHistoryAfterAuth, setPendingHistoryAfterAuth] =
    useState<ModelHistoryIntent | null>(null);

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

  useEffect(() => {
    const pushSectionToUrl = (section: AppSection, mode: 'replace' | 'push' = 'replace') => {
      const params = new URLSearchParams();
      const tabParam = getTabParamForSection(section);
      if (tabParam) params.set('tab', tabParam);
      syncUrlSearchParams(params, mode);
    };

    if (!isAuthenticated && (activeSection === 'history' || activeSection === 'alerts' || activeSection === 'admin')) {
      pushSectionToUrl('fipe', 'replace');
      setActiveSection('fipe');
    } else if (activeSection === 'admin' && !isAdmin) {
      pushSectionToUrl('fipe', 'replace');
      setActiveSection('fipe');
    }
  }, [isAuthenticated, isAdmin, activeSection]);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseSectionFromUrl();
      if ((next === 'history' || next === 'alerts') && !isAuthenticated) {
        syncUrlSearchParams(new URLSearchParams(), 'replace');
        setActiveSection('fipe');
        return;
      }
      if (next === 'admin' && (!isAuthenticated || !isAdmin)) {
        syncUrlSearchParams(new URLSearchParams(), 'replace');
        setActiveSection('fipe');
        return;
      }
      setListingsSearch(null);
      setHistoryIntent(null);
      setActiveSection(next);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    if (isAuthenticated && user?.profileUserId && pendingAlertAfterAuth) {
      setAlertPrefill(pendingAlertAfterAuth);
      setPendingAlertAfterAuth(null);
      setAlertModalOpen(true);
    }
  }, [isAuthenticated, user?.profileUserId, pendingAlertAfterAuth]);

  useEffect(() => {
    if (isAuthenticated && pendingHistoryAfterAuth) {
      const tabParams = new URLSearchParams();
      tabParams.set('tab', 'historico');
      syncUrlSearchParams(tabParams, 'push');
      setHistoryIntent(pendingHistoryAfterAuth);
      setPendingHistoryAfterAuth(null);
      setActiveSection('history');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isAuthenticated, pendingHistoryAfterAuth]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleOpenAuth = (reason?: string) => {
    setAuthReason(reason);
    setAuthModalOpen(true);
  };

  const handleChangeSection = (section: AppSection) => {
    if ((section === 'history' || section === 'alerts') && !isAuthenticated) {
      handleOpenAuth(
        section === 'history'
          ? 'Entre com sua conta para consultar o histórico de anúncios, preços praticados e quilometragem.'
          : 'Entre com sua conta para configurar alertas de preço e receber avisos em tempo real.',
      );
      return;
    }
    if (section === 'admin' && (!isAuthenticated || !isAdmin)) {
      return;
    }
    setListingsSearch(null);
    setHistoryIntent(null);
    const params = new URLSearchParams();
    const tabParam = getTabParamForSection(section);
    if (tabParam) params.set('tab', tabParam);
    syncUrlSearchParams(params, 'push');
    setActiveSection(section);
  };

  const handleSearchVehicleListings = (vehicle: Vehicle) => {
    syncUrlSearchParams(new URLSearchParams({ tab: 'anuncios' }), 'push');
    setListingsSearch(buildListingSearchIntent(vehicle));
    setActiveSection('joinville');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInspectModelHistoryFromVehicle = (vehicle: Vehicle) => {
    const brand = normalizeFipeBrand(vehicle.nome_marca || '');
    const modelFirst = (vehicle.nome_modelo || '').trim().split(/\s+/)[0] || '';
    const search = [brand, modelFirst, vehicle.ano_modelo ? String(vehicle.ano_modelo) : '']
      .filter(Boolean)
      .join(' ');
    const nextIntent: ModelHistoryIntent = {
      search,
      brand: brand || undefined,
      year: vehicle.ano_modelo ?? undefined,
      fipeCode: vehicle.codigo_fipe || undefined,
      nonce: Date.now(),
    };

    if (!isAuthenticated) {
      setPendingAlertAfterAuth(null);
      setPendingHistoryAfterAuth(nextIntent);
      handleOpenAuth(
        'Entre com sua conta para consultar o histórico completo de anúncios, preços praticados e quilometragem deste modelo.',
      );
      return;
    }

    syncUrlSearchParams(new URLSearchParams({ tab: 'historico' }), 'push');
    setHistoryIntent(nextIntent);
    setActiveSection('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInspectModelHistoryQuery = (query: string) => {
    const nextIntent: ModelHistoryIntent = {
      search: query,
      nonce: Date.now(),
    };

    if (!isAuthenticated) {
      setPendingAlertAfterAuth(null);
      setPendingHistoryAfterAuth(nextIntent);
      handleOpenAuth(
        'Entre com sua conta para consultar o histórico completo de anúncios, preços praticados e quilometragem deste modelo.',
      );
      return;
    }

    syncUrlSearchParams(new URLSearchParams({ tab: 'historico' }), 'push');
    setHistoryIntent(nextIntent);
    setActiveSection('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestCreateAlert = (prefill: Partial<CarAlertInput>) => {
    if (!isAuthenticated || !user?.profileUserId) {
      setPendingHistoryAfterAuth(null);
      setPendingAlertAfterAuth(prefill);
      handleOpenAuth(
        'Entre com sua conta para salvar este alerta e receber avisos de novos anúncios e quedas de preço.',
      );
      return;
    }
    setAlertPrefill(prefill);
    setAlertModalOpen(true);
  };

  const handleSubmitQuickAlert = async (input: CarAlertInput) => {
    const uid = user?.profileUserId;
    if (!uid) return;
    const created = await createUserAlert(pb, uid, input);
    await evaluateAlertAgainstCatalog(pb, created, uid).catch(() => undefined);
    await refreshUnreadCount();
    syncUrlSearchParams(new URLSearchParams({ tab: 'alertas' }), 'push');
    setActiveSection('alerts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip bg-[#ffffff] dark:bg-[#121212] text-[#171717] dark:text-[#ededed] transition-colors">
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        activeSection={activeSection}
        onChangeSection={handleChangeSection}
        onOpenAuth={handleOpenAuth}
      />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {activeSection === 'fipe' && (
          <BudgetFinderView
            onSearchListings={handleSearchVehicleListings}
            onInspectModelHistory={handleInspectModelHistoryFromVehicle}
          />
        )}

        {activeSection === 'joinville' && (
          <Suspense fallback={<SectionLoader />}>
            <JoinvilleCarsView
              initialSearch={listingsSearch}
              onCreateAlert={handleRequestCreateAlert}
              onInspectModelHistory={handleInspectModelHistoryQuery}
            />
          </Suspense>
        )}

        {activeSection === 'history' && isAuthenticated && (
          <Suspense fallback={<SectionLoader />}>
            <ModelHistoryView
              initialIntent={historyIntent}
              onCreateAlert={handleRequestCreateAlert}
            />
          </Suspense>
        )}

        {activeSection === 'alerts' && isAuthenticated && (
          <Suspense fallback={<SectionLoader />}>
            <AlertsView
              onOpenAuth={handleOpenAuth}
              onInspectModelHistory={handleInspectModelHistoryQuery}
            />
          </Suspense>
        )}

        {activeSection === 'admin' && isAuthenticated && isAdmin && (
          <Suspense fallback={<SectionLoader />}>
            <AdminView onInspectModelHistory={handleInspectModelHistoryQuery} />
          </Suspense>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] py-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-[#707070] dark:text-[#a1a1aa] space-y-1.5">
          <p className="font-mono">fipex.parquet • DuckDB SQL Engine • PocketBase Auth &amp; History</p>
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

      <AuthModal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          if (!pb.authStore.isValid) {
            setPendingAlertAfterAuth(null);
            setPendingHistoryAfterAuth(null);
          }
        }}
        contextMessage={authReason}
      />

      <AlertFormModal
        open={alertModalOpen}
        onClose={() => {
          setAlertModalOpen(false);
          setAlertPrefill(null);
        }}
        onSubmit={handleSubmitQuickAlert}
        prefill={alertPrefill}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
