import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Car,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  backfillHistorySnapshotsFromCarros,
  createAdminSource,
  deleteAdminCarro,
  deleteAdminSource,
  fetchAdminAlerts,
  fetchAdminCarros,
  fetchAdminDashboardStats,
  fetchAdminSources,
  fetchAdminUsers,
  fetchCrawlerLogs,
  fetchCrawlerRuns,
  updateAdminCarro,
  updateAdminSource,
  updateAdminUser,
  type AdminAlertOverviewItem,
  type AdminCrawlerLogItem,
  type AdminCrawlerRunItem,
  type AdminDashboardStats,
  type AdminSourceItem,
  type AdminUserItem,
} from '../../services/admin';
import {
  DEFAULT_POCKETBASE_URL,
  type CarListingItem,
} from '../../services/pocketbase';
import {
  formatBRL,
  formatDateTimeBR,
  formatMileageKm,
  formatPct,
} from '../../lib/formatters';
import { NativeDialog } from '../ui/NativeDialog';

type AdminTab = 'overview' | 'crawler' | 'cars' | 'users' | 'alerts';

export interface AdminViewProps {
  onInspectModelHistory: (query: string) => void;
}

export default function AdminView({ onInspectModelHistory }: AdminViewProps) {
  const { pb, user, isAuthenticated, isAdmin } = useAuth();
  const editCarTitleId = useId();
  const deleteTitleId = useId();
  const newSourceTitleId = useId();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [sources, setSources] = useState<AdminSourceItem[]>([]);
  const [runs, setRuns] = useState<AdminCrawlerRunItem[]>([]);
  const [logs, setLogs] = useState<AdminCrawlerLogItem[]>([]);
  const [logLevel, setLogLevel] = useState('all');

  // Cars moderation
  const [cars, setCars] = useState<CarListingItem[]>([]);
  const [carsPage, setCarsPage] = useState(1);
  const [carsTotalPages, setCarsTotalPages] = useState(1);
  const [carsTotal, setCarsTotal] = useState(0);
  const [carSearch, setCarSearch] = useState('');
  const [carStatusFilter, setCarStatusFilter] = useState('all');
  const [editingCar, setEditingCar] = useState<CarListingItem | null>(null);
  const [carDraft, setCarDraft] = useState({
    price: '',
    mileage_km: '',
    listing_status: 'active',
    brand: '',
    model: '',
    version: '',
    year: '',
    fipe_code: '',
    fipe_price: '',
    notes: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'car' | 'source';
    id: string;
    label: string;
  } | null>(null);

  // Source editing
  const [editingSource, setEditingSource] = useState<AdminSourceItem | null>(null);
  const [newSourceOpen, setNewSourceOpen] = useState(false);
  const [newSourceForm, setNewSourceForm] = useState({
    name: '',
    url: '',
    active: true,
    maxPages: '50',
    delayMs: '2500',
  });

  // Users
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');

  // Alerts
  const [systemAlerts, setSystemAlerts] = useState<AdminAlertOverviewItem[]>([]);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((cur) => (cur === msg ? null : cur));
    }, 4500);
  }, []);

  const loadOverviewAndCrawler = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, src, r, l] = await Promise.all([
        fetchAdminDashboardStats(pb),
        fetchAdminSources(pb).catch(() => []),
        fetchCrawlerRuns(pb, 25),
        fetchCrawlerLogs(pb, 80, logLevel),
      ]);
      setStats(s);
      setSources(src);
      setRuns(r);
      setLogs(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar painel administrativo.');
    } finally {
      setLoading(false);
    }
  }, [pb, logLevel]);

  const loadCars = useCallback(async () => {
    const res = await fetchAdminCarros(pb, {
      page: carsPage,
      perPage: 20,
      search: carSearch,
      status: carStatusFilter,
    });
    setCars(res.items);
    setCarsTotal(res.totalItems);
    setCarsTotalPages(res.totalPages);
  }, [pb, carsPage, carSearch, carStatusFilter]);

  const loadUsers = useCallback(async () => {
    const res = await fetchAdminUsers(pb, usersPage, userSearch);
    setUsers(res.items);
    setUsersTotalPages(res.totalPages);
  }, [pb, usersPage, userSearch]);

  const loadAlerts = useCallback(async () => {
    const list = await fetchAdminAlerts(pb);
    setSystemAlerts(list);
  }, [pb]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    void loadOverviewAndCrawler();
  }, [isAuthenticated, isAdmin, loadOverviewAndCrawler]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    if (activeTab === 'cars') void loadCars();
    if (activeTab === 'users') void loadUsers();
    if (activeTab === 'alerts') void loadAlerts();
  }, [isAuthenticated, isAdmin, activeTab, loadCars, loadUsers, loadAlerts]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-[#171717] dark:text-[#ededed]">
          Área Administrativa Restrita
        </h1>
        <p className="text-xs text-[#707070] dark:text-[#a1a1aa] max-w-md mx-auto">
          Esta seção é exclusiva para usuários administradores autenticados no PocketBase.
        </p>
      </section>
    );
  }

  async function handleBackfillHistory() {
    setBusyAction(true);
    setError(null);
    try {
      const res = await backfillHistorySnapshotsFromCarros(pb, 500);
      showNotice(
        `Histórico sincronizado: ${res.scanned} anúncio(s) verificados, ${res.created} snapshot(s) inicial(is) gravados em carros_history.`,
      );
      await loadOverviewAndCrawler();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao sincronizar snapshots no histórico.',
      );
    } finally {
      setBusyAction(false);
    }
  }

  async function handleSaveCarEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingCar) return;
    setBusyAction(true);
    try {
      const priceNum = Number(carDraft.price) || 0;
      const fipePriceNum = Number(carDraft.fipe_price) || 0;
      const diffPct =
        priceNum > 0 && fipePriceNum > 0
          ? Math.round(((priceNum - fipePriceNum) / fipePriceNum) * 1000) / 10
          : 0;

      await updateAdminCarro(pb, editingCar.id, {
        price: priceNum,
        mileage_km: Number(carDraft.mileage_km) || 0,
        listing_status: carDraft.listing_status,
        brand: carDraft.brand.trim(),
        model: carDraft.model.trim(),
        version: carDraft.version.trim(),
        year: Number(carDraft.year) || 0,
        fipe_code: carDraft.fipe_code.trim(),
        fipe_price: fipePriceNum,
        fipe_diff_pct: diffPct,
        notes: carDraft.notes,
      });

      setEditingCar(null);
      showNotice('Anúncio atualizado no PocketBase.');
      await loadCars();
      await loadOverviewAndCrawler();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar anúncio.');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyAction(true);
    try {
      if (deleteTarget.type === 'car') {
        await deleteAdminCarro(pb, deleteTarget.id);
        showNotice('Anúncio removido.');
        await loadCars();
      } else {
        await deleteAdminSource(pb, deleteTarget.id);
        showNotice('Fonte removida.');
      }
      setDeleteTarget(null);
      await loadOverviewAndCrawler();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir registro.');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleSaveSourceInline(source: AdminSourceItem) {
    setBusyAction(true);
    try {
      await updateAdminSource(pb, source.id, source);
      setEditingSource(null);
      showNotice(`Fonte "${source.name}" atualizada.`);
      await loadOverviewAndCrawler();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar fonte.');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleCreateSource(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusyAction(true);
    try {
      await createAdminSource(pb, {
        name: newSourceForm.name,
        url: newSourceForm.url,
        active: newSourceForm.active,
        lastPage: 1,
        maxPages: Number(newSourceForm.maxPages) || 50,
        delayMs: Number(newSourceForm.delayMs) || 2500,
      });
      setNewSourceOpen(false);
      setNewSourceForm({ name: '', url: '', active: true, maxPages: '50', delayMs: '2500' });
      showNotice('Nova fonte de coleta criada.');
      await loadOverviewAndCrawler();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar fonte.');
    } finally {
      setBusyAction(false);
    }
  }

  async function handleToggleUserRole(target: AdminUserItem) {
    if (target.id === user?.id) return;
    const nextRole = target.role === 'admin' ? 'user' : 'admin';
    await updateAdminUser(pb, target.id, { role: nextRole });
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u)),
    );
    showNotice(`${target.email} agora possui papel "${nextRole}".`);
  }

  async function handleToggleUserAlerts(target: AdminUserItem) {
    const nextVal = !target.alertsEnabled;
    await updateAdminUser(pb, target.id, { alerts_enabled: nextVal });
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, alertsEnabled: nextVal } : u)),
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803d] dark:text-[#3ecf8e]">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Administração PocketBase ({user?.email})</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-[#ededed]">
            Painel Administrativo do Site
          </h1>
          <p className="text-xs sm:text-sm text-[#707070] dark:text-[#a1a1aa]">
            Gerencie fontes do crawler, modere anúncios, sincronize histórico de preços, administre usuários e monitore alertas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`${DEFAULT_POCKETBASE_URL}/_/`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs font-medium text-[#171717] dark:text-[#ededed] hover:border-[#3ecf8e]/50"
          >
            <Database className="w-3.5 h-3.5 text-[#3ecf8e]" aria-hidden="true" />
            <span>PocketBase /_/</span>
            <ExternalLink className="w-3 h-3 opacity-60" aria-hidden="true" />
          </a>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadOverviewAndCrawler()}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs font-medium cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3ecf8e] ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Atualizar</span>
          </button>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 px-4 py-2.5 text-xs font-medium text-[#15803d] dark:text-[#3ecf8e]"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {/* Navigation tabs */}
      <div
        role="tablist"
        aria-label="Seções administrativas"
        className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-[#ededed] dark:border-[#27272a]"
      >
        {(
          [
            { id: 'overview', label: 'Visão Geral', icon: Activity },
            { id: 'crawler', label: 'Fontes & Crawler', icon: ScrollText },
            { id: 'cars', label: 'Anúncios', icon: Car },
            { id: 'users', label: 'Usuários', icon: Users },
            { id: 'alerts', label: 'Alertas', icon: Bell },
          ] as Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }>
        ).map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 h-10 inline-flex items-center gap-1.5 px-3.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selected
                  ? 'text-[#15803d] dark:text-[#3ecf8e] border-b-2 border-[#3ecf8e]'
                  : 'text-[#707070] dark:text-[#a1a1aa] hover:text-[#171717] dark:hover:text-[#ededed]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Anúncios Monitorados
              </span>
              <p className="text-2xl font-bold tabular-nums">
                {(stats?.totalCarros ?? 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                {stats?.activeCarros ?? 0} ativos • {stats?.inactiveCarros ?? 0} encerrados
              </p>
            </div>

            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Snapshots de Histórico
              </span>
              <p className="text-2xl font-bold tabular-nums text-[#15803d] dark:text-[#3ecf8e]">
                {(stats?.totalHistorySnapshots ?? 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                {stats?.belowFipeCount ?? 0} abaixo FIPE • {stats?.missingFipeCount ?? 0} sem FIPE
              </p>
            </div>

            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Usuários &amp; Alertas
              </span>
              <p className="text-2xl font-bold tabular-nums">
                {(stats?.totalUsers ?? 0).toLocaleString('pt-BR')} usuários
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                {stats?.adminUsers ?? 0} admin(s) • {stats?.activeAlerts ?? 0} alertas • {stats?.totalNotifications ?? 0} disparos
              </p>
            </div>

            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Fontes &amp; Saúde do Crawler
              </span>
              <p className="text-2xl font-bold tabular-nums">
                {stats?.activeSources ?? 0} / {stats?.totalSources ?? 0} ativas
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                {stats?.recentErrorsCount ?? 0} log(s) de erro registrados
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#3ecf8e]" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Ferramentas de Manutenção &amp; Sincronização</h2>
            </div>
            <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">
              Gere snapshots iniciais em <code className="font-mono">carros_history</code> para anúncios já existentes em <code className="font-mono">carros_temp</code> que ainda não possuem histórico gravado.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleBackfillHistory()}
                className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {busyAction ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <History className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Sincronizar histórico inicial (carros_history)</span>
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Últimas Execuções do Crawler
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="border-b border-[#ededed] dark:border-[#27272a] text-[10px] uppercase text-[#707070] dark:text-[#a1a1aa]">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Portal</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Início</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Páginas</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Anúncios</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Erros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ededed] dark:divide-[#27272a]">
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-[#707070]">
                        Nenhuma execução registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    runs.slice(0, 10).map((run) => (
                      <tr key={run.id}>
                        <td className="px-4 py-2.5 font-medium">{run.siteName}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium border ${
                              run.status === 'completed'
                                ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                                : run.status === 'error'
                                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                  : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-[#707070] dark:text-[#a1a1aa]">
                          {formatDateTimeBR(run.startedAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{run.pagesCrawled}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{run.listingsScraped}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{run.errors}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Crawler sources & logs */}
      {activeTab === 'crawler' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Fontes de Coleta (`car_listings`)</h2>
            <button
              type="button"
              onClick={() => setNewSourceOpen(true)}
              className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Nova fonte</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sources.map((src) => {
              const isEd = editingSource?.id === src.id;
              const draft = isEd ? editingSource : src;

              return (
                <article
                  key={src.id}
                  className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium border ${
                          draft.active
                            ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                            : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] border-[#dfdfdf] dark:border-[#27272a]'
                        }`}
                      >
                        {draft.active ? 'Ativa' : 'Pausada'}
                      </span>
                      <h3 className="text-sm font-semibold font-mono">{src.name}</h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          void handleSaveSourceInline({ ...src, active: !src.active })
                        }
                        className="h-7 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] text-[11px] font-medium cursor-pointer"
                      >
                        {src.active ? 'Pausar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSource(isEd ? null : { ...src })}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] cursor-pointer"
                        aria-label={`Editar fonte ${src.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ type: 'source', id: src.id, label: src.name })
                        }
                        className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] text-rose-600 cursor-pointer"
                        aria-label={`Excluir fonte ${src.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {isEd ? (
                    <div className="space-y-2.5 pt-2 border-t border-[#ededed] dark:border-[#27272a]">
                      <div className="space-y-1">
                        <label className="block text-[11px] text-[#707070]">URL alvo</label>
                        <input
                          type="url"
                          value={editingSource.url}
                          onChange={(e) =>
                            setEditingSource({ ...editingSource, url: e.target.value })
                          }
                          className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[11px] text-[#707070]">Última pág.</label>
                          <input
                            type="number"
                            min={1}
                            value={editingSource.lastPage}
                            onChange={(e) =>
                              setEditingSource({
                                ...editingSource,
                                lastPage: Number(e.target.value) || 1,
                              })
                            }
                            className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] text-[#707070]">Máx. págs.</label>
                          <input
                            type="number"
                            min={1}
                            value={editingSource.maxPages}
                            onChange={(e) =>
                              setEditingSource({
                                ...editingSource,
                                maxPages: Number(e.target.value) || 50,
                              })
                            }
                            className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] text-[#707070]">Delay (ms)</label>
                          <input
                            type="number"
                            min={500}
                            value={editingSource.delayMs}
                            onChange={(e) =>
                              setEditingSource({
                                ...editingSource,
                                delayMs: Number(e.target.value) || 2500,
                              })
                            }
                            className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingSource(null)}
                          className="h-7 px-3 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSaveSourceInline(editingSource)}
                          className="h-7 px-3 rounded-[5px] bg-[#3ecf8e] text-[#171717] text-xs font-semibold cursor-pointer"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px] text-[#707070] dark:text-[#a1a1aa]">
                      <p className="truncate font-mono">{src.url}</p>
                      <p className="tabular-nums">
                        Pág. atual: {src.lastPage} • Máx.: {src.maxPages} • Delay: {src.delayMs} ms
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <section className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#707070] dark:text-[#a1a1aa]">
                Logs Recentes do Crawler
              </h3>
              <select
                aria-label="Filtrar nível de log"
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="h-7 px-2 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs"
              >
                <option value="all">Todos os níveis</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
                <option value="debug">debug</option>
              </select>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-[#ededed] dark:divide-[#27272a] text-xs">
              {logs.length === 0 ? (
                <p className="p-6 text-center text-[#707070]">Nenhum log encontrado.</p>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center h-4 px-1.5 rounded-[3px] text-[10px] font-mono uppercase ${
                            l.level === 'error'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                              : l.level === 'warn'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070]'
                          }`}
                        >
                          {l.level}
                        </span>
                        <span className="font-medium text-[#171717] dark:text-[#ededed]">
                          {l.message}
                        </span>
                      </div>
                      {l.context && (
                        <pre className="text-[10px] font-mono text-[#707070] dark:text-[#a1a1aa] overflow-x-auto">
                          {JSON.stringify(l.context)}
                        </pre>
                      )}
                    </div>
                    <span className="text-[11px] tabular-nums text-[#9a9a9a] shrink-0">
                      {formatDateTimeBR(l.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: Cars moderation */}
      {activeTab === 'cars' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                aria-label="Buscar anúncios para moderar"
                value={carSearch}
                onChange={(e) => {
                  setCarSearch(e.target.value);
                  setCarsPage(1);
                }}
                placeholder="Buscar anúncio por modelo, código FIPE, cidade..."
                className="w-full h-8 pl-8 pr-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs"
              />
            </div>

            <select
              aria-label="Filtrar status dos anúncios"
              value={carStatusFilter}
              onChange={(e) => {
                setCarStatusFilter(e.target.value);
                setCarsPage(1);
              }}
              className="h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs"
            >
              <option value="all">Todos os status ({carsTotal.toLocaleString('pt-BR')})</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="sold">Vendidos</option>
            </select>
          </div>

          <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs text-left border-collapse">
              <thead className="bg-[#fafafa] dark:bg-[#171717] border-b border-[#ededed] dark:border-[#27272a] text-[10px] uppercase text-[#707070] dark:text-[#a1a1aa]">
                <tr>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Veículo</th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Preço</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Km</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">vs FIPE</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ededed] dark:divide-[#27272a]">
                {cars.map((car) => (
                  <tr key={car.id} className="hover:bg-[#fafafa] dark:hover:bg-[#141416]">
                    <td className="px-3.5 py-2.5 max-w-[300px]">
                      <p className="font-medium truncate">{car.title}</p>
                      <p className="text-[10px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                        {car.portalName} • {car.year ?? '—'} • {car.city || 'Joinville'}
                      </p>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium border ${
                          car.listingStatus === 'active'
                            ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                            : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] border-[#dfdfdf] dark:border-[#27272a]'
                        }`}
                      >
                        {car.listingStatus}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">
                      {formatBRL(car.price)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums text-[#707070] dark:text-[#a1a1aa]">
                      {formatMileageKm(car.mileageKm)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right tabular-nums">
                      {car.fipeDiffPct !== null ? formatPct(car.fipeDiffPct) : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          title="Ver histórico de anúncios deste modelo"
                          onClick={() =>
                            onInspectModelHistory(
                              [car.brand, car.model, car.year ? String(car.year) : '']
                                .filter(Boolean)
                                .join(' ') || car.title,
                            )
                          }
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] hover:border-[#3ecf8e]/50 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-[#3ecf8e]" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Editar anúncio ${car.title}`}
                          onClick={() => {
                            setEditingCar(car);
                            setCarDraft({
                              price: car.price ? String(car.price) : '',
                              mileage_km: car.mileageKm !== null ? String(car.mileageKm) : '',
                              listing_status: car.listingStatus || 'active',
                              brand: car.brand,
                              model: car.model,
                              version: car.version,
                              year: car.year ? String(car.year) : '',
                              fipe_code: car.fipeMatch?.codigo_fipe ?? '',
                              fipe_price: car.fipeReferenceValue
                                ? String(car.fipeReferenceValue)
                                : '',
                              notes: car.notes,
                            });
                          }}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] hover:border-[#3ecf8e]/50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir anúncio ${car.title}`}
                          onClick={() =>
                            setDeleteTarget({ type: 'car', id: car.id, label: car.title })
                          }
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {carsTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={carsPage <= 1}
                onClick={() => setCarsPage((p) => Math.max(1, p - 1))}
                className="h-8 inline-flex items-center gap-1 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] text-xs cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Anterior</span>
              </button>
              <span className="text-xs tabular-nums text-[#707070]">
                Página {carsPage} de {carsTotalPages}
              </span>
              <button
                type="button"
                disabled={carsPage >= carsTotalPages}
                onClick={() => setCarsPage((p) => Math.min(carsTotalPages, p + 1))}
                className="h-8 inline-flex items-center gap-1 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] text-xs cursor-pointer disabled:opacity-50"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="w-3.5 h-3.5 text-[#707070] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar usuários por nome ou e-mail"
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUsersPage(1);
              }}
              placeholder="Filtrar usuários por nome ou e-mail..."
              className="w-full h-8 pl-8 pr-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs"
            />
          </div>

          <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs text-left border-collapse">
              <thead className="bg-[#fafafa] dark:bg-[#171717] border-b border-[#ededed] dark:border-[#27272a] text-[10px] uppercase text-[#707070] dark:text-[#a1a1aa]">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Nome / E-mail</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Papel</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Alertas</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Cadastro</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ededed] dark:divide-[#27272a]">
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-[#171717] dark:text-[#ededed]">
                          {u.name || 'Sem nome'}
                          {isSelf && (
                            <span className="ml-1.5 text-[10px] text-[#3ecf8e]">(você)</span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa]">{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center h-5 px-2 rounded-[4px] text-[10px] font-semibold border ${
                            u.role === 'admin'
                              ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                              : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] border-[#dfdfdf] dark:border-[#27272a]'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => void handleToggleUserAlerts(u)}
                          className={`h-6 px-2 rounded-[4px] border text-[10px] font-medium cursor-pointer ${
                            u.alertsEnabled
                              ? 'bg-[#3ecf8e]/10 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                              : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] border-[#dfdfdf] dark:border-[#27272a]'
                          }`}
                        >
                          {u.alertsEnabled ? 'Habilitados' : 'Desativados'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[#707070] dark:text-[#a1a1aa]">
                        {formatDateTimeBR(u.created)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => void handleToggleUserRole(u)}
                          className="h-7 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-[11px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {u.role === 'admin' ? 'Rebaixar para user' : 'Promover a admin'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {usersTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={usersPage <= 1}
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] text-xs cursor-pointer disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-xs tabular-nums">
                Página {usersPage} de {usersTotalPages}
              </span>
              <button
                type="button"
                disabled={usersPage >= usersTotalPages}
                onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                className="h-8 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] text-xs cursor-pointer disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: System Alerts */}
      {activeTab === 'alerts' && (
        <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] overflow-x-auto">
          <table className="w-full min-w-[740px] text-xs text-left border-collapse text-[#171717] dark:text-[#ededed]">
            <thead className="bg-[#fafafa] dark:bg-[#171717] border-b border-[#ededed] dark:border-[#27272a] text-[10px] uppercase text-[#52525b] dark:text-[#a1a1aa]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Alerta</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Usuário</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Critérios</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Disparos</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ededed] dark:divide-[#27272a] text-[#171717] dark:text-[#ededed]">
              {systemAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#707070] dark:text-[#a1a1aa]">
                    Nenhum alerta cadastrado pelos usuários ainda.
                  </td>
                </tr>
              ) : (
                systemAlerts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 font-medium text-[#171717] dark:text-[#ededed]">{a.name}</td>
                    <td className="px-4 py-2.5 text-[#52525b] dark:text-[#a1a1aa]">
                      {a.userEmail || a.userName || a.userId}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-[#52525b] dark:text-[#d4d4d8]">
                      {[
                        a.searchQuery,
                        a.maxPrice > 0 ? `≤ ${formatBRL(a.maxPrice)}` : '',
                        a.onlyBelowFipe ? 'Abaixo FIPE' : '',
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'Geral'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#171717] dark:text-[#ededed]">{a.matchesCount}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium border ${
                          a.active
                            ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                            : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] border-[#dfdfdf] dark:border-[#27272a]'
                        }`}
                      >
                        {a.active ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Car Modal */}
      <NativeDialog
        open={Boolean(editingCar)}
        onClose={() => setEditingCar(null)}
        ariaLabelledBy={editCarTitleId}
      >
        <div className="w-full sm:w-[540px] rounded-xl border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717]">
            <h2 id={editCarTitleId} className="text-sm font-semibold">
              Editar Anúncio
            </h2>
            <button
              type="button"
              onClick={() => setEditingCar(null)}
              aria-label="Fechar edição"
              className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <form onSubmit={handleSaveCarEdit} className="p-5 space-y-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Status</label>
                <select
                  value={carDraft.listing_status}
                  onChange={(e) =>
                    setCarDraft({ ...carDraft, listing_status: e.target.value })
                  }
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="sold">sold</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Preço (R$)</label>
                <input
                  type="number"
                  value={carDraft.price}
                  onChange={(e) => setCarDraft({ ...carDraft, price: e.target.value })}
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Quilometragem (km)</label>
                <input
                  type="number"
                  value={carDraft.mileage_km}
                  onChange={(e) =>
                    setCarDraft({ ...carDraft, mileage_km: e.target.value })
                  }
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Ano</label>
                <input
                  type="number"
                  value={carDraft.year}
                  onChange={(e) => setCarDraft({ ...carDraft, year: e.target.value })}
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Marca</label>
                <input
                  type="text"
                  value={carDraft.brand}
                  onChange={(e) => setCarDraft({ ...carDraft, brand: e.target.value })}
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Modelo</label>
                <input
                  type="text"
                  value={carDraft.model}
                  onChange={(e) => setCarDraft({ ...carDraft, model: e.target.value })}
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="block text-[11px] text-[#707070]">Versão</label>
                <input
                  type="text"
                  value={carDraft.version}
                  onChange={(e) => setCarDraft({ ...carDraft, version: e.target.value })}
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Código FIPE</label>
                <input
                  type="text"
                  value={carDraft.fipe_code}
                  onChange={(e) =>
                    setCarDraft({ ...carDraft, fipe_code: e.target.value })
                  }
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-[#707070]">Preço FIPE (R$)</label>
                <input
                  type="number"
                  value={carDraft.fipe_price}
                  onChange={(e) =>
                    setCarDraft({ ...carDraft, fipe_price: e.target.value })
                  }
                  className="w-full h-8 px-2 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#ededed] dark:border-[#27272a]">
              <button
                type="button"
                onClick={() => setEditingCar(null)}
                className="h-8 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busyAction}
                className="h-8 px-4 rounded-[6px] bg-[#3ecf8e] text-[#171717] text-xs font-semibold cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      </NativeDialog>

      {/* New Source Modal */}
      <NativeDialog
        open={newSourceOpen}
        onClose={() => setNewSourceOpen(false)}
        ariaLabelledBy={newSourceTitleId}
      >
        <div className="w-full sm:w-[460px] rounded-xl border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717]">
            <h2 id={newSourceTitleId} className="text-sm font-semibold">
              Nova Fonte do Crawler
            </h2>
            <button
              type="button"
              onClick={() => setNewSourceOpen(false)}
              aria-label="Fechar"
              className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <form onSubmit={handleCreateSource} className="p-5 space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium">Identificador (ex.: olx-carros)</label>
              <input
                type="text"
                required
                value={newSourceForm.name}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, name: e.target.value })}
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium">URL inicial</label>
              <input
                type="url"
                required
                value={newSourceForm.url}
                onChange={(e) => setNewSourceForm({ ...newSourceForm, url: e.target.value })}
                className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium">Máx. páginas</label>
                <input
                  type="number"
                  min={1}
                  value={newSourceForm.maxPages}
                  onChange={(e) => setNewSourceForm({ ...newSourceForm, maxPages: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium">Delay (ms)</label>
                <input
                  type="number"
                  min={500}
                  value={newSourceForm.delayMs}
                  onChange={(e) => setNewSourceForm({ ...newSourceForm, delayMs: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-xs tabular-nums"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewSourceOpen(false)}
                className="h-8 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busyAction}
                className="h-8 px-4 rounded-[6px] bg-[#3ecf8e] text-[#171717] text-xs font-semibold cursor-pointer"
              >
                Criar fonte
              </button>
            </div>
          </form>
        </div>
      </NativeDialog>

      {/* Delete confirmation dialog */}
      <NativeDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        ariaLabelledBy={deleteTitleId}
      >
        <div className="w-full sm:w-[400px] rounded-xl border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b] p-5 shadow-2xl space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h2 id={deleteTitleId} className="text-sm font-semibold">
                Confirmar exclusão
              </h2>
              <p className="text-xs text-[#707070] dark:text-[#a1a1aa]">
                Tem certeza que deseja excluir <strong>{deleteTarget?.label}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setDeleteTarget(null)}
              className="h-8 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busyAction}
              onClick={() => void handleConfirmDelete()}
              className="h-8 px-3.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              Excluir definitivamente
            </button>
          </div>
        </div>
      </NativeDialog>
    </div>
  );
}
