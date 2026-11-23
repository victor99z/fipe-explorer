import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  BellPlus,
  Check,
  CheckCheck,
  ExternalLink,
  History,
  Loader2,
  LogIn,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCambioLabel } from '../../services/pocketbase';
import {
  createUserAlert,
  deleteNotification,
  deleteUserAlert,
  evaluateAlertAgainstCatalog,
  evaluateAllUserAlerts,
  fetchUserAlerts,
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateUserAlert,
  type CarAlertInput,
  type CarAlertItem,
  type CarAlertNotificationItem,
} from '../../services/alerts';
import {
  mapCarRecord,
  PB_CAR_COLLECTIONS,
  updateCarCuration,
  type CarListingItem,
} from '../../services/pocketbase';
import {
  formatBRL,
  formatDateTimeBR,
  formatMileageKm,
  formatPct,
} from '../../lib/formatters';
import {
  buildAlertsUrlParams,
  parseAlertsUnreadFromUrl,
  parseSectionFromUrl,
  syncUrlSearchParams,
} from '../../lib/urlState';
import { AlertFormModal } from './AlertFormModal';
import { CarListingModal } from '../joinville/CarListingModal';

export interface AlertsViewProps {
  onOpenAuth: (reason?: string) => void;
  onInspectModelHistory: (query: string) => void;
}

export default function AlertsView({
  onOpenAuth,
  onInspectModelHistory,
}: AlertsViewProps) {
  const {
    pb,
    user,
    isAuthenticated,
    curationMap,
    setCurationMap,
    refreshUnreadCount,
  } = useAuth();

  const [alerts, setAlerts] = useState<CarAlertItem[]>([]);
  const [notifications, setNotifications] = useState<CarAlertNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(() => parseAlertsUnreadFromUrl());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (parseSectionFromUrl() !== 'alerts') return;
    syncUrlSearchParams(buildAlertsUrlParams(unreadOnly), 'replace');
  }, [unreadOnly]);

  useEffect(() => {
    const handlePop = () => {
      if (parseSectionFromUrl() !== 'alerts') return;
      setUnreadOnly(parseAlertsUnreadFromUrl());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<CarAlertItem | null>(null);
  const [selectedCar, setSelectedCar] = useState<CarListingItem | null>(null);

  const userId = user?.profileUserId ?? '';

  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const [aList, nList] = await Promise.all([
        fetchUserAlerts(pb, userId),
        fetchUserNotifications(pb, userId, 120),
      ]);
      setAlerts(aList);
      setNotifications(nList);
      await refreshUnreadCount();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível carregar seus alertas.',
      );
    } finally {
      setLoading(false);
    }
  }, [pb, userId, refreshUnreadCount]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      void loadData();
    } else {
      setAlerts([]);
      setNotifications([]);
    }
  }, [isAuthenticated, userId, loadData]);

  async function handleSaveAlert(input: CarAlertInput, editingId?: string) {
    if (!userId) return;
    if (editingId) {
      await updateUserAlert(pb, editingId, input);
      showToast('Alerta atualizado.');
    } else {
      const created = await createUserAlert(pb, userId, input);
      const scan = await evaluateAlertAgainstCatalog(pb, created, userId).catch(() => ({
        checked: 0,
        newNotifications: 0,
      }));
      showToast(
        scan.newNotifications > 0
          ? `Alerta criado! ${scan.newNotifications} anúncio(s) compatível(eis) encontrado(s).`
          : 'Alerta criado e monitorando novas oportunidades.',
      );
    }
    await loadData();
  }

  async function handleToggleActive(alert: CarAlertItem) {
    await updateUserAlert(pb, alert.id, { active: !alert.active });
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, active: !a.active } : a)),
    );
  }

  async function handleDeleteAlert(alert: CarAlertItem) {
    await deleteUserAlert(pb, alert.id);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    setNotifications((prev) => prev.filter((n) => n.alertId !== alert.id));
    await refreshUnreadCount();
    showToast(`Alerta "${alert.name}" excluído.`);
  }

  async function handleScanSingle(alert: CarAlertItem) {
    if (!userId) return;
    setScanning(true);
    try {
      const res = await evaluateAlertAgainstCatalog(pb, alert, userId);
      await loadData();
      showToast(
        res.newNotifications > 0
          ? `${res.newNotifications} nova(s) notificação(ões) para "${alert.name}".`
          : `Verificação concluída (${res.checked} compatível(eis) já notificados).`,
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleScanAll() {
    if (!userId) return;
    setScanning(true);
    try {
      const res = await evaluateAllUserAlerts(pb, userId);
      await loadData();
      showToast(
        `${res.alertsChecked} alerta(s) verificado(s): ${res.newNotifications} nova(s) oportunidade(s).`,
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleMarkRead(notif: CarAlertNotificationItem) {
    const nextRead = !notif.isRead;
    await markNotificationRead(pb, notif.id, nextRead);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: nextRead } : n)),
    );
    await refreshUnreadCount();
  }

  async function handleMarkAllRead() {
    if (!userId) return;
    await markAllNotificationsRead(pb, userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await refreshUnreadCount();
    showToast('Todas as notificações foram marcadas como lidas.');
  }

  async function handleDeleteNotif(notifId: string) {
    await deleteNotification(pb, notifId);
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    await refreshUnreadCount();
  }

  async function handleOpenCarDetails(notif: CarAlertNotificationItem) {
    try {
      let rec: Record<string, unknown> | null = null;
      if (notif.carroId) {
        rec = await pb
          .collection(PB_CAR_COLLECTIONS.CARROS)
          .getOne<Record<string, unknown>>(notif.carroId)
          .catch(() => null);
      }
      if (!rec && notif.carRef) {
        rec = await pb
          .collection(PB_CAR_COLLECTIONS.CARROS)
          .getFirstListItem<Record<string, unknown>>(
            pb.filter('ref = {:ref}', { ref: notif.carRef }),
          )
          .catch(() => null);
      }
      if (rec) {
        setSelectedCar(mapCarRecord(pb, rec, curationMap));
      } else {
        window.open(notif.carRef, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(notif.carRef, '_blank', 'noopener,noreferrer');
    }
  }

  if (!isAuthenticated) {
    return (
      <section className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] p-8 sm:p-10 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#3ecf8e]/15 border border-[#3ecf8e]/40 flex items-center justify-center">
          <Bell className="w-6 h-6 text-[#3ecf8e]" aria-hidden="true" />
        </div>
        <div className="space-y-1.5 max-w-lg mx-auto">
          <h1 className="text-xl font-semibold text-[#171717] dark:text-[#ededed]">
            Alertas Personalizados de Preço e Oportunidades
          </h1>
          <p className="text-xs sm:text-sm text-[#707070] dark:text-[#a1a1aa]">
            Entre com sua conta no PocketBase para configurar alertas por modelo, ano, faixa de preço, quilometragem e desconto vs. Tabela FIPE — com aviso automático de novos anúncios e quedas de preço.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() =>
              onOpenAuth(
                'Faça login com sua conta para criar alertas de preço e acompanhar quedas em tempo real.',
              )
            }
            className="h-9 inline-flex items-center gap-2 px-4 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold cursor-pointer"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>Entrar na conta</span>
          </button>
        </div>
      </section>
    );
  }

  if (!userId) {
    return (
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-xs text-amber-800 dark:text-amber-300 space-y-2">
        <p className="font-semibold">Perfil de usuário vinculado não encontrado</p>
        <p>
          Você autenticou como superusuário interno do PocketBase sem um registro correspondente na coleção <code>users</code>. Crie uma conta em <code>users</code> ou reinicie o PocketBase com <code>POCKETBASE_EMAIL</code> configurado.
        </p>
      </section>
    );
  }

  const visibleNotifs = unreadOnly
    ? notifications.filter((n) => !n.isRead)
    : notifications;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#171717] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803d] dark:text-[#3ecf8e]">
            <Bell className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Monitoramento Automático ({user?.name})</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#171717] dark:text-[#ededed]">
            Meus Alertas &amp; Notificações
          </h1>
          <p className="text-xs sm:text-sm text-[#707070] dark:text-[#a1a1aa]">
            Receba avisos sempre que surgir um veículo dentro do seu critério ou quando um anúncio cair de preço.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={scanning || alerts.length === 0}
            onClick={() => void handleScanAll()}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-[6px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-xs font-medium text-[#171717] dark:text-[#ededed] hover:border-[#3ecf8e]/50 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3ecf8e] ${scanning ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Verificar agora</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAlert(null);
              setFormOpen(true);
            }}
            className="h-8 inline-flex items-center gap-1.5 px-3.5 rounded-[6px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-xs font-semibold cursor-pointer"
          >
            <BellPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Novo alerta</span>
          </button>
        </div>
      </section>

      {statusMessage && (
        <div
          role="status"
          className="rounded-lg border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 px-4 py-2.5 text-xs font-medium text-[#15803d] dark:text-[#3ecf8e]"
        >
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-700 dark:text-rose-300"
        >
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved alerts */}
        <section className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#171717] dark:text-[#ededed]">
              Alertas Configurados ({alerts.length.toLocaleString('pt-BR')})
            </h2>
          </div>

          {loading && alerts.length === 0 ? (
            <div className="rounded-xl border border-[#ededed] dark:border-[#27272a] p-8 text-center">
              <Loader2 className="w-5 h-5 text-[#3ecf8e] animate-spin mx-auto" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dfdfdf] dark:border-[#27272a] p-8 text-center space-y-2.5">
              <BellOff className="w-7 h-7 text-[#9a9a9a] mx-auto" aria-hidden="true" />
              <p className="text-xs font-medium text-[#171717] dark:text-[#ededed]">
                Você ainda não tem alertas cadastrados
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa]">
                Crie um alerta como &ldquo;HB20 2021 Diamond Plus abaixo da FIPE&rdquo; para ser avisado automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${
                    alert.active
                      ? 'border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b]'
                      : 'border-[#ededed] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#141416] opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium border ${
                            alert.active
                              ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                              : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                          }`}
                        >
                          {alert.active ? 'Ativo' : 'Pausado'}
                        </span>
                        <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                          {alert.matchesCount.toLocaleString('pt-BR')} disparo(s)
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#171717] dark:text-[#ededed] truncate">
                        {alert.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleToggleActive(alert)}
                      className="h-7 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-[11px] font-medium hover:border-[#3ecf8e]/50 cursor-pointer"
                    >
                      {alert.active ? 'Pausar' : 'Ativar'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {alert.searchQuery && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                        Busca: <strong>{alert.searchQuery}</strong>
                      </span>
                    )}
                    {alert.brand && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                        {alert.brand}
                      </span>
                    )}
                    {alert.transmission && alert.transmission !== 'todos' && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                        {formatCambioLabel(alert.transmission)}
                      </span>
                    )}
                    {(alert.minYear > 0 || alert.maxYear > 0) && (
                      <span className="px-2 py-0.5 rounded-[4px] tabular-nums bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                        Ano: {alert.minYear || '—'}–{alert.maxYear || '—'}
                      </span>
                    )}
                    {alert.maxPrice > 0 && (
                      <span className="px-2 py-0.5 rounded-[4px] tabular-nums bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                        Até {formatBRL(alert.maxPrice)}
                      </span>
                    )}
                    {alert.maxKm > 0 && (
                      <span className="px-2 py-0.5 rounded-[4px] tabular-nums bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                        ≤ {alert.maxKm.toLocaleString('pt-BR')} km
                      </span>
                    )}
                    {alert.onlyBelowFipe && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border border-[#3ecf8e]/40">
                        Abaixo da FIPE
                      </span>
                    )}
                    {alert.minFipeDiscountPct > 0 && (
                      <span className="px-2 py-0.5 rounded-[4px] tabular-nums bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border border-[#3ecf8e]/40">
                        ≥ {alert.minFipeDiscountPct}% desc. FIPE
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#ededed] dark:border-[#27272a] text-[11px] text-[#707070] dark:text-[#a1a1aa]">
                    <span className="tabular-nums">
                      Checado: {alert.lastCheckedAt ? formatDateTimeBR(alert.lastCheckedAt) : 'Ainda não'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={scanning}
                        onClick={() => void handleScanSingle(alert)}
                        title="Verificar anúncios compatíveis agora"
                        className="h-7 inline-flex items-center gap-1 px-2 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] hover:border-[#3ecf8e]/50 text-[#171717] dark:text-[#ededed] cursor-pointer"
                      >
                        <Play className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                        <span>Verificar</span>
                      </button>
                      {alert.searchQuery && (
                        <button
                          type="button"
                          onClick={() => onInspectModelHistory(alert.searchQuery)}
                          title="Ver histórico de anúncios desse modelo"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] hover:border-[#3ecf8e]/50 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-[#3ecf8e]" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAlert(alert);
                          setFormOpen(true);
                        }}
                        aria-label={`Editar alerta ${alert.name}`}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] hover:border-[#3ecf8e]/50 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAlert(alert)}
                        aria-label={`Excluir alerta ${alert.name}`}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] hover:border-rose-500/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Notifications inbox */}
        <section className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#171717] dark:text-[#ededed]">
              Notificações Recebidas ({visibleNotifs.length.toLocaleString('pt-BR')})
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly((v) => !v)}
                className={`h-7 px-2.5 rounded-[5px] border text-[11px] font-medium cursor-pointer ${
                  unreadOnly
                    ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                    : 'bg-[#fafafa] dark:bg-[#121212] text-[#707070] dark:text-[#a1a1aa] border-[#dfdfdf] dark:border-[#27272a]'
                }`}
              >
                Não lidas ({unreadCount})
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[11px] font-medium hover:border-[#3ecf8e]/50 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-[#3ecf8e]" aria-hidden="true" />
                  <span>Marcar todas lidas</span>
                </button>
              )}
            </div>
          </div>

          {visibleNotifs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dfdfdf] dark:border-[#27272a] p-8 text-center space-y-2">
              <Bell className="w-7 h-7 text-[#9a9a9a] mx-auto" aria-hidden="true" />
              <p className="text-xs font-medium text-[#171717] dark:text-[#ededed]">
                {unreadOnly ? 'Nenhuma notificação não lida' : 'Nenhuma notificação disparada ainda'}
              </p>
              <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa]">
                Clique em &ldquo;Verificar agora&rdquo; para varrer os anúncios atuais ou aguarde a próxima coleta do crawler.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleNotifs.map((notif) => {
                const isPriceDrop = notif.triggerType === 'price_drop';
                const triggerLabel = isPriceDrop
                  ? 'Queda de preço'
                  : notif.triggerType === 'below_fipe'
                    ? 'Abaixo da FIPE'
                    : 'Novo anúncio';

                return (
                  <article
                    key={notif.id}
                    className={`rounded-xl border p-4 space-y-2.5 transition-colors ${
                      notif.isRead
                        ? 'border-[#ededed] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#18181b]'
                        : 'border-[#3ecf8e]/50 bg-[#3ecf8e]/5 dark:bg-[#3ecf8e]/10'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#3ecf8e]" aria-label="Não lida" />
                        )}
                        <span
                          className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-[4px] text-[10px] font-semibold border ${
                            isPriceDrop
                              ? 'bg-[#3ecf8e]/15 text-[#15803d] dark:text-[#3ecf8e] border-[#3ecf8e]/40'
                              : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30'
                          }`}
                        >
                          {isPriceDrop && <TrendingDown className="w-3 h-3" aria-hidden="true" />}
                          {triggerLabel}
                        </span>
                        <span className="inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] font-medium bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                          {notif.portal}
                        </span>
                        {notif.year && (
                          <span className="inline-flex items-center h-5 px-1.5 rounded-[4px] text-[10px] tabular-nums bg-[#fafafa] dark:bg-[#121212] border border-[#ededed] dark:border-[#27272a]">
                            {notif.year}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                        {formatDateTimeBR(notif.triggeredAt)}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#171717] dark:text-[#ededed] truncate">
                          {notif.carTitle}
                        </h3>
                        <p className="text-[11px] text-[#707070] dark:text-[#a1a1aa] tabular-nums">
                          {formatMileageKm(notif.mileageKm)}
                          {notif.city ? ` • ${notif.city}` : ''}
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0 tabular-nums">
                        <div className="flex items-baseline sm:justify-end gap-2">
                          {notif.previousPrice && notif.previousPrice > notif.price && (
                            <span className="text-xs line-through text-[#9a9a9a]">
                              {formatBRL(notif.previousPrice)}
                            </span>
                          )}
                          <span className="text-base font-bold text-[#171717] dark:text-[#ededed]">
                            {formatBRL(notif.price)}
                          </span>
                        </div>
                        {notif.fipeDiffPct !== null && notif.fipePrice && (
                          <p
                            className={`text-[11px] font-medium ${
                              notif.fipeDiffPct <= 0
                                ? 'text-[#15803d] dark:text-[#3ecf8e]'
                                : 'text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {formatPct(notif.fipeDiffPct)} vs FIPE ({formatBRL(notif.fipePrice)})
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#ededed] dark:border-[#27272a]">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleMarkRead(notif)}
                          className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#ffffff] dark:bg-[#121212] text-[11px] font-medium hover:border-[#3ecf8e]/50 cursor-pointer"
                        >
                          <Check className="w-3 h-3 text-[#3ecf8e]" aria-hidden="true" />
                          <span>{notif.isRead ? 'Marcar não lida' : 'Marcar lida'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteNotif(notif.id)}
                          aria-label="Remover notificação"
                          className="h-7 w-7 inline-flex items-center justify-center rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] text-[#707070] hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleOpenCarDetails(notif)}
                          className="h-7 px-2.5 rounded-[5px] border border-[#dfdfdf] dark:border-[#27272a] bg-[#fafafa] dark:bg-[#121212] text-[11px] font-medium hover:border-[#3ecf8e]/50 cursor-pointer"
                        >
                          Detalhes do carro
                        </button>
                        <a
                          href={notif.carRef}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[5px] bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] text-[11px] font-semibold"
                        >
                          <span>Ver anúncio</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AlertFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingAlert(null);
        }}
        onSubmit={handleSaveAlert}
        editingAlert={editingAlert}
      />

      <CarListingModal
        car={selectedCar}
        onClose={() => setSelectedCar(null)}
        onToggleFavorite={async (car) => {
          const next = await updateCarCuration(pb, car, { favorite: !car.favorite }, userId);
          setCurationMap((prev) => ({ ...prev, [car.id]: next }));
          setSelectedCar((cur) => (cur?.id === car.id ? { ...cur, favorite: !car.favorite } : cur));
        }}
        onToggleHidden={async (car) => {
          const next = await updateCarCuration(pb, car, { hidden: !car.hidden }, userId);
          setCurationMap((prev) => ({ ...prev, [car.id]: next }));
          setSelectedCar((cur) => (cur?.id === car.id ? { ...cur, hidden: !car.hidden } : cur));
        }}
        onSaveNotes={async (car, notes) => {
          const next = await updateCarCuration(pb, car, { notes }, userId);
          setCurationMap((prev) => ({ ...prev, [car.id]: next }));
          setSelectedCar((cur) => (cur?.id === car.id ? { ...cur, notes } : cur));
        }}
        onInspectModelHistory={onInspectModelHistory}
      />
    </div>
  );
}
