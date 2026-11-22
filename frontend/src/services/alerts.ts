import PocketBase, { ClientResponseError } from 'pocketbase';
import {
  buildTokenizedSearchClauses,
  PB_CAR_COLLECTIONS,
  mapCarRecord,
  type CarListingItem,
} from './pocketbase';
import { inferPortalName, normalizeSearchText } from '../lib/formatters';

export interface CarAlertItem {
  id: string;
  userId: string;
  name: string;
  active: boolean;
  searchQuery: string;
  brand: string;
  model: string;
  version: string;
  fipeCode: string;
  city: string;
  portal: string;
  motorizacao: string;
  transmission: string;
  fuel: string;
  minYear: number;
  maxYear: number;
  minPrice: number;
  maxPrice: number;
  maxKm: number;
  onlyBelowFipe: boolean;
  minFipeDiscountPct: number;
  notifyOnNew: boolean;
  notifyOnPriceDrop: boolean;
  lastCheckedAt: string;
  lastMatchedAt: string;
  matchesCount: number;
  created: string;
  updated: string;
}

export interface CarAlertInput {
  name: string;
  active?: boolean;
  searchQuery?: string;
  brand?: string;
  model?: string;
  version?: string;
  fipeCode?: string;
  city?: string;
  portal?: string;
  motorizacao?: string;
  transmission?: string;
  fuel?: string;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxKm?: number;
  onlyBelowFipe?: boolean;
  minFipeDiscountPct?: number;
  notifyOnNew?: boolean;
  notifyOnPriceDrop?: boolean;
}

export interface CarAlertNotificationItem {
  id: string;
  userId: string;
  alertId: string;
  carroId: string;
  carRef: string;
  carTitle: string;
  brand: string;
  model: string;
  year: number | null;
  mileageKm: number | null;
  price: number;
  previousPrice: number | null;
  fipePrice: number | null;
  fipeDiffPct: number | null;
  portal: string;
  city: string;
  triggerType: 'new_listing' | 'price_drop' | 'below_fipe' | 'manual_scan' | string;
  dedupKey: string;
  isRead: boolean;
  readAt: string;
  triggeredAt: string;
}

function toStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function toNum(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : 0;
}

function getStatus(err: unknown): number | undefined {
  if (err instanceof ClientResponseError) return err.status;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const s = (err as { status?: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

function mapAlertRecord(rec: Record<string, unknown>): CarAlertItem {
  const userRaw = rec.user;
  const userId = Array.isArray(userRaw) ? toStr(userRaw[0]) : toStr(userRaw);
  return {
    id: String(rec.id ?? ''),
    userId,
    name: toStr(rec.name) || 'Alerta sem nome',
    active: rec.active !== false,
    searchQuery: toStr(rec.search_query),
    brand: toStr(rec.brand),
    model: toStr(rec.model),
    version: toStr(rec.version),
    fipeCode: toStr(rec.fipe_code),
    city: toStr(rec.city),
    portal: toStr(rec.portal),
    motorizacao: toStr(rec.motorizacao),
    transmission: toStr(rec.transmission),
    fuel: toStr(rec.fuel),
    minYear: toNum(rec.min_year),
    maxYear: toNum(rec.max_year),
    minPrice: toNum(rec.min_price),
    maxPrice: toNum(rec.max_price),
    maxKm: toNum(rec.max_km),
    onlyBelowFipe: Boolean(rec.only_below_fipe),
    minFipeDiscountPct: toNum(rec.min_fipe_discount_pct),
    notifyOnNew: rec.notify_on_new !== false,
    notifyOnPriceDrop: rec.notify_on_price_drop !== false,
    lastCheckedAt: toStr(rec.last_checked_at),
    lastMatchedAt: toStr(rec.last_matched_at),
    matchesCount: toNum(rec.matches_count),
    created: toStr(rec.created),
    updated: toStr(rec.updated),
  };
}

function mapNotificationRecord(rec: Record<string, unknown>): CarAlertNotificationItem {
  const userRaw = rec.user;
  const alertRaw = rec.alert;
  return {
    id: String(rec.id ?? ''),
    userId: Array.isArray(userRaw) ? toStr(userRaw[0]) : toStr(userRaw),
    alertId: Array.isArray(alertRaw) ? toStr(alertRaw[0]) : toStr(alertRaw),
    carroId: toStr(rec.carro_id),
    carRef: toStr(rec.car_ref),
    carTitle: toStr(rec.car_title) || 'Veículo encontrado',
    brand: toStr(rec.brand),
    model: toStr(rec.model),
    year: toNum(rec.year) || null,
    mileageKm: typeof rec.mileage_km === 'number' && rec.mileage_km >= 0 ? rec.mileage_km : null,
    price: toNum(rec.price),
    previousPrice: toNum(rec.previous_price) || null,
    fipePrice: toNum(rec.fipe_price) || null,
    fipeDiffPct:
      typeof rec.fipe_diff_pct === 'number' && Number.isFinite(rec.fipe_diff_pct)
        ? rec.fipe_diff_pct
        : null,
    portal: toStr(rec.portal) || inferPortalName(toStr(rec.car_ref)),
    city: toStr(rec.city),
    triggerType: toStr(rec.trigger_type) || 'new_listing',
    dedupKey: toStr(rec.dedup_key),
    isRead: Boolean(rec.is_read),
    readAt: toStr(rec.read_at),
    triggeredAt: toStr(rec.triggered_at) || toStr(rec.created),
  };
}

export async function fetchUserAlerts(
  pb: PocketBase,
  userId: string,
): Promise<CarAlertItem[]> {
  if (!userId) return [];
  try {
    const items = await pb
      .collection(PB_CAR_COLLECTIONS.ALERTS)
      .getFullList<Record<string, unknown>>({
        filter: pb.filter('user = {:uid}', { uid: userId }),
        sort: '-updated',
      });
    return items.map(mapAlertRecord);
  } catch (err) {
    if (getStatus(err) === 404) return [];
    throw err;
  }
}

export async function createUserAlert(
  pb: PocketBase,
  userId: string,
  input: CarAlertInput,
): Promise<CarAlertItem> {
  const payload = {
    user: userId,
    name: input.name.trim(),
    active: input.active ?? true,
    search_query: input.searchQuery?.trim() ?? '',
    brand: input.brand?.trim() ?? '',
    model: input.model?.trim() ?? '',
    version: input.version?.trim() ?? '',
    fipe_code: input.fipeCode?.trim() ?? '',
    city: input.city?.trim() ?? '',
    portal: input.portal?.trim() ?? '',
    motorizacao: input.motorizacao?.trim() ?? '',
    transmission: input.transmission?.trim() ?? '',
    fuel: input.fuel?.trim() ?? '',
    min_year: input.minYear ?? 0,
    max_year: input.maxYear ?? 0,
    min_price: input.minPrice ?? 0,
    max_price: input.maxPrice ?? 0,
    max_km: input.maxKm ?? 0,
    only_below_fipe: Boolean(input.onlyBelowFipe),
    min_fipe_discount_pct: input.minFipeDiscountPct ?? 0,
    notify_on_new: input.notifyOnNew ?? true,
    notify_on_price_drop: input.notifyOnPriceDrop ?? true,
    matches_count: 0,
  };
  const rec = await pb
    .collection(PB_CAR_COLLECTIONS.ALERTS)
    .create<Record<string, unknown>>(payload);
  return mapAlertRecord(rec);
}

export async function updateUserAlert(
  pb: PocketBase,
  alertId: string,
  patch: Partial<CarAlertInput> & {
    lastCheckedAt?: string;
    lastMatchedAt?: string;
    matchesCount?: number;
  },
): Promise<CarAlertItem> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.active !== undefined) body.active = patch.active;
  if (patch.searchQuery !== undefined) body.search_query = patch.searchQuery.trim();
  if (patch.brand !== undefined) body.brand = patch.brand.trim();
  if (patch.model !== undefined) body.model = patch.model.trim();
  if (patch.version !== undefined) body.version = patch.version.trim();
  if (patch.fipeCode !== undefined) body.fipe_code = patch.fipeCode.trim();
  if (patch.city !== undefined) body.city = patch.city.trim();
  if (patch.portal !== undefined) body.portal = patch.portal.trim();
  if (patch.motorizacao !== undefined) body.motorizacao = patch.motorizacao.trim();
  if (patch.transmission !== undefined) body.transmission = patch.transmission.trim();
  if (patch.fuel !== undefined) body.fuel = patch.fuel.trim();
  if (patch.minYear !== undefined) body.min_year = patch.minYear;
  if (patch.maxYear !== undefined) body.max_year = patch.maxYear;
  if (patch.minPrice !== undefined) body.min_price = patch.minPrice;
  if (patch.maxPrice !== undefined) body.max_price = patch.maxPrice;
  if (patch.maxKm !== undefined) body.max_km = patch.maxKm;
  if (patch.onlyBelowFipe !== undefined) body.only_below_fipe = patch.onlyBelowFipe;
  if (patch.minFipeDiscountPct !== undefined) body.min_fipe_discount_pct = patch.minFipeDiscountPct;
  if (patch.notifyOnNew !== undefined) body.notify_on_new = patch.notifyOnNew;
  if (patch.notifyOnPriceDrop !== undefined) body.notify_on_price_drop = patch.notifyOnPriceDrop;
  if (patch.lastCheckedAt !== undefined) body.last_checked_at = patch.lastCheckedAt;
  if (patch.lastMatchedAt !== undefined) body.last_matched_at = patch.lastMatchedAt;
  if (patch.matchesCount !== undefined) body.matches_count = patch.matchesCount;

  const rec = await pb
    .collection(PB_CAR_COLLECTIONS.ALERTS)
    .update<Record<string, unknown>>(alertId, body);
  return mapAlertRecord(rec);
}

export async function deleteUserAlert(pb: PocketBase, alertId: string): Promise<void> {
  await pb.collection(PB_CAR_COLLECTIONS.ALERTS).delete(alertId);
}

export async function fetchUserNotifications(
  pb: PocketBase,
  userId: string,
  limit = 100,
): Promise<CarAlertNotificationItem[]> {
  if (!userId) return [];
  try {
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS)
      .getList<Record<string, unknown>>(1, limit, {
        filter: pb.filter('user = {:uid}', { uid: userId }),
        sort: '-triggered_at,-created',
      });
    return res.items.map(mapNotificationRecord);
  } catch (err) {
    if (getStatus(err) === 404) return [];
    throw err;
  }
}

export async function fetchUnreadAlertNotificationsCount(
  pb: PocketBase,
  userId: string,
): Promise<number> {
  if (!userId) return 0;
  try {
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS)
      .getList(1, 1, {
        filter: pb.filter('user = {:uid} && is_read = false', { uid: userId }),
        fields: 'id',
      });
    return res.totalItems;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(
  pb: PocketBase,
  notificationId: string,
  isRead = true,
): Promise<void> {
  await pb.collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS).update(notificationId, {
    is_read: isRead,
    read_at: isRead ? new Date().toISOString() : '',
  });
}

export async function markAllNotificationsRead(
  pb: PocketBase,
  userId: string,
): Promise<number> {
  const unread = await pb
    .collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS)
    .getFullList<{ id: string }>({
      filter: pb.filter('user = {:uid} && is_read = false', { uid: userId }),
      fields: 'id',
    })
    .catch(() => []);

  const now = new Date().toISOString();
  await Promise.all(
    unread.map((item) =>
      pb
        .collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS)
        .update(item.id, { is_read: true, read_at: now })
        .catch(() => undefined),
    ),
  );
  return unread.length;
}

export async function deleteNotification(
  pb: PocketBase,
  notificationId: string,
): Promise<void> {
  await pb.collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS).delete(notificationId);
}

function matchesAlertInClient(car: CarListingItem, alert: CarAlertItem): boolean {
  if (!car.price || car.price <= 0) return false;
  if (alert.portal && alert.portal !== 'todos' && car.portalName !== alert.portal) {
    return false;
  }
  if (alert.city && alert.city !== 'todas') {
    if (!normalizeSearchText(car.city).includes(normalizeSearchText(alert.city))) {
      return false;
    }
  }
  if (alert.brand) {
    const ab = normalizeSearchText(alert.brand);
    if (
      normalizeSearchText(car.brand) !== ab &&
      !normalizeSearchText(car.fipeMatch?.nome_marca).includes(ab)
    ) {
      return false;
    }
  }
  if (alert.fipeCode && car.fipeMatch?.codigo_fipe !== alert.fipeCode) {
    return false;
  }
  if (alert.motorizacao === 'turbo' && !car.isTurbo) return false;
  if (alert.motorizacao === 'aspirado' && car.isTurbo) return false;

  if (alert.transmission && alert.transmission !== 'todos') {
    const ta = normalizeSearchText(alert.transmission);
    const tc = normalizeSearchText(car.transmission);
    const titleFallback = tc
      ? ''
      : normalizeSearchText(`${car.title} ${car.fipeMatch?.nome_modelo ?? ''}`);
    const isAutoCar =
      tc.includes('automat') ||
      tc.includes('dsg') ||
      tc.includes('tiptr') ||
      /\baut\b/.test(titleFallback) ||
      titleFallback.includes('tiptr') ||
      titleFallback.includes('dsg') ||
      titleFallback.includes('s-tronic');
    const isCvtCar = tc.includes('cvt') || /\be?-?cvt\b/.test(titleFallback);

    if (ta === 'automatico_cvt' || ta === 'automatico') {
      if (!isAutoCar && !isCvtCar) return false;
    } else if (ta === 'cvt') {
      if (!isCvtCar) return false;
    } else if (!tc.includes(ta) && !titleFallback.includes(ta)) {
      return false;
    }
  }

  if (alert.fuel && alert.fuel !== 'todos') {
    if (!normalizeSearchText(car.fuel).includes(normalizeSearchText(alert.fuel))) {
      return false;
    }
  }

  if (alert.minYear > 0 && (!car.year || car.year < alert.minYear)) return false;
  if (alert.maxYear > 0 && (!car.year || car.year > alert.maxYear)) return false;
  if (alert.minPrice > 0 && car.price < alert.minPrice) return false;
  if (alert.maxPrice > 0 && car.price > alert.maxPrice) return false;
  if (alert.maxKm > 0 && (car.mileageKm === null || car.mileageKm > alert.maxKm)) {
    return false;
  }

  if (alert.onlyBelowFipe) {
    if (!car.fipeReferenceValue || car.fipeDiffPct === null || car.fipeDiffPct > 0) {
      return false;
    }
  }
  if (alert.minFipeDiscountPct > 0) {
    if (
      !car.fipeReferenceValue ||
      car.fipeDiffPct === null ||
      car.fipeDiffPct > -alert.minFipeDiscountPct
    ) {
      return false;
    }
  }

  const tokens = normalizeSearchText(alert.searchQuery).split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const haystack = normalizeSearchText(
      [
        car.title,
        car.brand,
        car.model,
        car.version,
        car.year ? String(car.year) : '',
        car.neighborhood,
        car.city,
        car.fipeMatch?.codigo_fipe,
        car.fipeMatch?.nome_modelo,
        car.transmission,
        car.fuel,
      ]
        .filter(Boolean)
        .join(' '),
    );
    if (!tokens.every((t) => haystack.includes(t))) return false;
  }

  return true;
}

export async function evaluateAlertAgainstCatalog(
  pb: PocketBase,
  alert: CarAlertItem,
  userId: string,
): Promise<{ checked: number; newNotifications: number }> {
  const clauses: string[] = ['price > 0'];

  if (alert.city && alert.city !== 'todas') {
    clauses.push(pb.filter('city ~ {:city}', { city: alert.city }));
  }
  if (alert.brand) {
    clauses.push(pb.filter('(brand = {:br} || fipe_brand ~ {:br})', { br: alert.brand }));
  }
  if (alert.fipeCode) {
    clauses.push(pb.filter('fipe_code = {:fc}', { fc: alert.fipeCode }));
  }
  if (alert.minYear > 0) clauses.push(pb.filter('year >= {:miny}', { miny: alert.minYear }));
  if (alert.maxYear > 0) clauses.push(pb.filter('year > 0 && year <= {:maxy}', { maxy: alert.maxYear }));
  if (alert.minPrice > 0) clauses.push(pb.filter('price >= {:minp}', { minp: alert.minPrice }));
  if (alert.maxPrice > 0) clauses.push(pb.filter('price <= {:maxp}', { maxp: alert.maxPrice }));
  if (alert.maxKm > 0) clauses.push(pb.filter('mileage_km <= {:maxk}', { maxk: alert.maxKm }));
  if (alert.onlyBelowFipe) clauses.push('fipe_price > 0 && fipe_diff_pct <= 0');
  if (alert.minFipeDiscountPct > 0) {
    clauses.push(
      pb.filter('fipe_price > 0 && fipe_diff_pct <= {:disc}', {
        disc: -alert.minFipeDiscountPct,
      }),
    );
  }
  clauses.push(...buildTokenizedSearchClauses(pb, alert.searchQuery));

  const res = await pb
    .collection(PB_CAR_COLLECTIONS.CARROS)
    .getList<Record<string, unknown>>(1, 80, {
      filter: clauses.join(' && '),
      sort: '-updated',
    });

  const mapped = res.items.map((r) => mapCarRecord(pb, r, {}));
  const matches = mapped.filter((car) => matchesAlertInClient(car, alert));

  const nowIso = new Date().toISOString();
  let inserted = 0;

  for (const car of matches.slice(0, 30)) {
    const triggerType =
      car.initialPrice && car.price < car.initialPrice
        ? 'price_drop'
        : alert.onlyBelowFipe
          ? 'below_fipe'
          : 'new_listing';
    const dedupKey = `${alert.id}::${car.ref}::${triggerType}::${Math.round(car.price)}`;

    try {
      await pb.collection(PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS).create({
        user: userId,
        alert: alert.id,
        carro_id: car.id,
        car_ref: car.ref,
        car_title: car.title,
        brand: car.brand,
        model: car.model,
        year: car.year ?? 0,
        mileage_km: car.mileageKm ?? 0,
        price: car.price,
        previous_price:
          car.initialPrice && car.price < car.initialPrice ? car.initialPrice : 0,
        fipe_price: car.fipeReferenceValue ?? 0,
        fipe_diff_pct: car.fipeDiffPct ?? 0,
        portal: car.portalName,
        city: car.city,
        trigger_type: triggerType,
        dedup_key: dedupKey,
        is_read: false,
        read_at: '',
        triggered_at: nowIso,
      });
      inserted++;
    } catch (err) {
      if (getStatus(err) !== 400) {
        throw err;
      }
    }
  }

  await updateUserAlert(pb, alert.id, {
    lastCheckedAt: nowIso,
    ...(inserted > 0
      ? {
          lastMatchedAt: nowIso,
          matchesCount: alert.matchesCount + inserted,
        }
      : {}),
  }).catch(() => undefined);

  return { checked: matches.length, newNotifications: inserted };
}

export async function evaluateAllUserAlerts(
  pb: PocketBase,
  userId: string,
): Promise<{ alertsChecked: number; totalMatches: number; newNotifications: number }> {
  const alerts = (await fetchUserAlerts(pb, userId)).filter((a) => a.active);
  let totalMatches = 0;
  let newNotifications = 0;

  for (const alert of alerts) {
    const res = await evaluateAlertAgainstCatalog(pb, alert, userId);
    totalMatches += res.checked;
    newNotifications += res.newNotifications;
  }

  return {
    alertsChecked: alerts.length,
    totalMatches,
    newNotifications,
  };
}
