import PocketBase from 'pocketbase';
import {
  buildTokenizedSearchClauses,
  mapCarRecord,
  PB_CAR_COLLECTIONS,
  type CarListingItem,
} from './pocketbase';
import { inferPortalName } from '../lib/formatters';

export interface AdminDashboardStats {
  totalCarros: number;
  activeCarros: number;
  inactiveCarros: number;
  belowFipeCount: number;
  missingFipeCount: number;
  totalHistorySnapshots: number;
  totalUsers: number;
  adminUsers: number;
  activeAlerts: number;
  totalAlerts: number;
  totalNotifications: number;
  totalSources: number;
  activeSources: number;
  recentErrorsCount: number;
}

export interface AdminSourceItem {
  id: string;
  name: string;
  active: boolean;
  lastPage: number;
  url: string;
  maxPages: number;
  delayMs: number;
  updated: string;
}

export interface AdminCrawlerRunItem {
  id: string;
  siteName: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  pagesCrawled: number;
  listingsScraped: number;
  errors: number;
  errorMsg: string;
}

export interface AdminCrawlerLogItem {
  id: string;
  level: string;
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | string;
  alertsEnabled: boolean;
  verified: boolean;
  created: string;
  updated: string;
}

export interface AdminAlertOverviewItem {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  name: string;
  active: boolean;
  searchQuery: string;
  maxPrice: number;
  minYear: number;
  maxYear: number;
  onlyBelowFipe: boolean;
  matchesCount: number;
  lastCheckedAt: string;
  lastMatchedAt: string;
}

function toStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function toNum(val: unknown): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : 0;
}

async function safeCount(
  pb: PocketBase,
  collection: string,
  filter?: string,
): Promise<number> {
  try {
    const res = await pb.collection(collection).getList(1, 1, {
      ...(filter ? { filter } : {}),
      fields: 'id',
    });
    return res.totalItems;
  } catch {
    return 0;
  }
}

export async function fetchAdminDashboardStats(
  pb: PocketBase,
): Promise<AdminDashboardStats> {
  const [
    totalCarros,
    inactiveCarros,
    belowFipeCount,
    missingFipeCount,
    totalHistorySnapshots,
    totalUsers,
    adminUsers,
    totalAlerts,
    activeAlerts,
    totalNotifications,
    totalSources,
    activeSources,
    recentErrorsCount,
  ] = await Promise.all([
    safeCount(pb, PB_CAR_COLLECTIONS.CARROS),
    safeCount(pb, PB_CAR_COLLECTIONS.CARROS, 'listing_status != "" && listing_status != "active"'),
    safeCount(pb, PB_CAR_COLLECTIONS.CARROS, 'fipe_price > 0 && fipe_diff_pct <= 0'),
    safeCount(pb, PB_CAR_COLLECTIONS.CARROS, 'fipe_code = "" || fipe_code = "N/A"'),
    safeCount(pb, PB_CAR_COLLECTIONS.CARROS_HISTORY),
    safeCount(pb, 'users'),
    safeCount(pb, 'users', 'role = "admin"'),
    safeCount(pb, PB_CAR_COLLECTIONS.ALERTS),
    safeCount(pb, PB_CAR_COLLECTIONS.ALERTS, 'active = true'),
    safeCount(pb, PB_CAR_COLLECTIONS.ALERT_NOTIFICATIONS),
    safeCount(pb, PB_CAR_COLLECTIONS.LISTINGS),
    safeCount(pb, PB_CAR_COLLECTIONS.LISTINGS, 'active = true'),
    safeCount(pb, PB_CAR_COLLECTIONS.CRAWLER_LOGS, 'level = "error"'),
  ]);

  return {
    totalCarros,
    activeCarros: Math.max(0, totalCarros - inactiveCarros),
    inactiveCarros,
    belowFipeCount,
    missingFipeCount,
    totalHistorySnapshots,
    totalUsers,
    adminUsers,
    activeAlerts,
    totalAlerts,
    totalNotifications,
    totalSources,
    activeSources,
    recentErrorsCount,
  };
}

export async function fetchAdminSources(pb: PocketBase): Promise<AdminSourceItem[]> {
  const records = await pb
    .collection(PB_CAR_COLLECTIONS.LISTINGS)
    .getFullList<Record<string, unknown>>({ sort: 'name' });
  return records.map((r) => ({
    id: String(r.id),
    name: toStr(r.name),
    active: Boolean(r.active),
    lastPage: toNum(r.last_page) || 1,
    url: toStr(r.url),
    maxPages: toNum(r.max_pages) || 50,
    delayMs: toNum(r.delay_ms) || 2500,
    updated: toStr(r.updated),
  }));
}

export async function updateAdminSource(
  pb: PocketBase,
  id: string,
  patch: Partial<Omit<AdminSourceItem, 'id' | 'updated'>>,
): Promise<AdminSourceItem> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.active !== undefined) body.active = patch.active;
  if (patch.lastPage !== undefined) body.last_page = patch.lastPage;
  if (patch.url !== undefined) body.url = patch.url.trim();
  if (patch.maxPages !== undefined) body.max_pages = patch.maxPages;
  if (patch.delayMs !== undefined) body.delay_ms = patch.delayMs;

  const r = await pb
    .collection(PB_CAR_COLLECTIONS.LISTINGS)
    .update<Record<string, unknown>>(id, body);
  return {
    id: String(r.id),
    name: toStr(r.name),
    active: Boolean(r.active),
    lastPage: toNum(r.last_page) || 1,
    url: toStr(r.url),
    maxPages: toNum(r.max_pages) || 50,
    delayMs: toNum(r.delay_ms) || 2500,
    updated: toStr(r.updated),
  };
}

export async function createAdminSource(
  pb: PocketBase,
  input: Omit<AdminSourceItem, 'id' | 'updated'>,
): Promise<AdminSourceItem> {
  const r = await pb
    .collection(PB_CAR_COLLECTIONS.LISTINGS)
    .create<Record<string, unknown>>({
      name: input.name.trim(),
      active: input.active,
      last_page: input.lastPage,
      url: input.url.trim(),
      max_pages: input.maxPages,
      delay_ms: input.delayMs,
    });
  return {
    id: String(r.id),
    name: toStr(r.name),
    active: Boolean(r.active),
    lastPage: toNum(r.last_page) || 1,
    url: toStr(r.url),
    maxPages: toNum(r.max_pages) || 50,
    delayMs: toNum(r.delay_ms) || 2500,
    updated: toStr(r.updated),
  };
}

export async function deleteAdminSource(pb: PocketBase, id: string): Promise<void> {
  await pb.collection(PB_CAR_COLLECTIONS.LISTINGS).delete(id);
}

export async function fetchCrawlerRuns(
  pb: PocketBase,
  limit = 25,
): Promise<AdminCrawlerRunItem[]> {
  try {
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.CRAWLER_RUNS)
      .getList<Record<string, unknown>>(1, limit, { sort: '-started_at,-created' });
    return res.items.map((r) => ({
      id: String(r.id),
      siteName: toStr(r.site_name),
      startedAt: toStr(r.started_at) || toStr(r.created),
      finishedAt: toStr(r.finished_at),
      status: toStr(r.status) || 'running',
      pagesCrawled: toNum(r.pages_crawled),
      listingsScraped: toNum(r.listings_scraped),
      errors: toNum(r.errors),
      errorMsg: toStr(r.error_msg),
    }));
  } catch {
    return [];
  }
}

export async function fetchCrawlerLogs(
  pb: PocketBase,
  limit = 60,
  levelFilter?: string,
): Promise<AdminCrawlerLogItem[]> {
  try {
    const filter =
      levelFilter && levelFilter !== 'all'
        ? pb.filter('level = {:lvl}', { lvl: levelFilter })
        : '';
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.CRAWLER_LOGS)
      .getList<Record<string, unknown>>(1, limit, {
        ...(filter ? { filter } : {}),
        sort: '-created_at,-created',
      });
    return res.items.map((r) => ({
      id: String(r.id),
      level: toStr(r.level) || 'info',
      message: toStr(r.message),
      context:
        r.context && typeof r.context === 'object'
          ? (r.context as Record<string, unknown>)
          : null,
      createdAt: toStr(r.created_at) || toStr(r.created),
    }));
  } catch {
    return [];
  }
}

export async function fetchAdminCarros(
  pb: PocketBase,
  params: { page: number; perPage?: number; search?: string; status?: string },
): Promise<{ items: CarListingItem[]; totalItems: number; totalPages: number }> {
  const clauses: string[] = [];
  if (params.status && params.status !== 'all') {
    if (params.status === 'active') {
      clauses.push('(listing_status = "" || listing_status = "active")');
    } else {
      clauses.push(pb.filter('listing_status = {:st}', { st: params.status }));
    }
  }
  clauses.push(...buildTokenizedSearchClauses(pb, params.search));

  const res = await pb
    .collection(PB_CAR_COLLECTIONS.CARROS)
    .getList<Record<string, unknown>>(params.page, params.perPage ?? 20, {
      ...(clauses.length > 0 ? { filter: clauses.join(' && ') } : {}),
      sort: '-updated',
    });

  return {
    items: res.items.map((r) => mapCarRecord(pb, r, {})),
    totalItems: res.totalItems,
    totalPages: Math.max(1, res.totalPages),
  };
}

export async function updateAdminCarro(
  pb: PocketBase,
  id: string,
  patch: {
    price?: number;
    mileage_km?: number;
    listing_status?: string;
    fipe_price?: number;
    fipe_code?: string;
    fipe_diff_pct?: number;
    notes?: string;
    brand?: string;
    model?: string;
    version?: string;
    year?: number;
  },
): Promise<void> {
  await pb.collection(PB_CAR_COLLECTIONS.CARROS).update(id, patch);
}

export async function deleteAdminCarro(pb: PocketBase, id: string): Promise<void> {
  await pb.collection(PB_CAR_COLLECTIONS.CARROS).delete(id);
}

export async function fetchAdminUsers(
  pb: PocketBase,
  page = 1,
  search = '',
): Promise<{ items: AdminUserItem[]; totalItems: number; totalPages: number }> {
  const filter = search.trim()
    ? pb.filter('(email ~ {:q} || name ~ {:q})', { q: search.trim() })
    : '';
  const res = await pb
    .collection('users')
    .getList<Record<string, unknown>>(page, 30, {
      ...(filter ? { filter } : {}),
      sort: '-created',
    });

  return {
    items: res.items.map((r) => ({
      id: String(r.id),
      email: toStr(r.email),
      name: toStr(r.name),
      role: toStr(r.role) || 'user',
      alertsEnabled: Boolean(r.alerts_enabled),
      verified: Boolean(r.verified),
      created: toStr(r.created),
      updated: toStr(r.updated),
    })),
    totalItems: res.totalItems,
    totalPages: Math.max(1, res.totalPages),
  };
}

export async function updateAdminUser(
  pb: PocketBase,
  id: string,
  patch: { role?: 'user' | 'admin'; alerts_enabled?: boolean; name?: string },
): Promise<void> {
  await pb.collection('users').update(id, patch);
}

export async function fetchAdminAlerts(
  pb: PocketBase,
): Promise<AdminAlertOverviewItem[]> {
  try {
    const records = await pb
      .collection(PB_CAR_COLLECTIONS.ALERTS)
      .getFullList<Record<string, unknown>>({
        sort: '-updated',
        expand: 'user',
      });
    return records.map((r) => {
      const expand = r.expand as Record<string, Record<string, unknown>> | undefined;
      const expandedUser = expand?.user;
      return {
        id: String(r.id),
        userId: toStr(r.user),
        userEmail: toStr(expandedUser?.email),
        userName: toStr(expandedUser?.name),
        name: toStr(r.name),
        active: Boolean(r.active),
        searchQuery: toStr(r.search_query),
        maxPrice: toNum(r.max_price),
        minYear: toNum(r.min_year),
        maxYear: toNum(r.max_year),
        onlyBelowFipe: Boolean(r.only_below_fipe),
        matchesCount: toNum(r.matches_count),
        lastCheckedAt: toStr(r.last_checked_at),
        lastMatchedAt: toStr(r.last_matched_at),
      };
    });
  } catch {
    return [];
  }
}

export async function backfillHistorySnapshotsFromCarros(
  pb: PocketBase,
  maxItems = 500,
): Promise<{ scanned: number; created: number }> {
  let scanned = 0;
  let created = 0;
  let page = 1;

  while (scanned < maxItems) {
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(page, 100, {
        filter: 'price > 0',
        sort: '-updated',
      });

    if (res.items.length === 0) break;

    for (const raw of res.items) {
      if (scanned >= maxItems) break;
      scanned++;
      const ref = toStr(raw.ref);
      if (!ref) continue;

      const existing = await pb
        .collection(PB_CAR_COLLECTIONS.CARROS_HISTORY)
        .getList(1, 1, {
          filter: pb.filter('ref = {:ref}', { ref }),
          fields: 'id',
        })
        .catch(() => ({ totalItems: 0 }));

      if (existing.totalItems > 0) continue;

      await pb.collection(PB_CAR_COLLECTIONS.CARROS_HISTORY).create({
        carro_id: String(raw.id),
        ref,
        id_listing: toStr(raw.id_listing),
        portal: inferPortalName(ref),
        text_description: toStr(raw.text_description),
        brand: toStr(raw.brand),
        model: toStr(raw.model),
        version: toStr(raw.version),
        year: toNum(raw.year),
        manufacture_year: 0,
        price: toNum(raw.price),
        previous_price: 0,
        price_delta: 0,
        mileage_km: toNum(raw.mileage_km),
        previous_mileage_km: 0,
        transmission: toStr(raw.transmission),
        fuel: toStr(raw.fuel),
        engine_size: toStr(raw.engine_size),
        is_turbo: Boolean(raw.is_turbo),
        seller_type: toStr(raw.seller_type),
        neighborhood: toStr(raw.neighborhood),
        city: toStr(raw.city),
        state: toStr(raw.state) || 'SC',
        fipe_price: toNum(raw.fipe_price),
        fipe_code: toStr(raw.fipe_code),
        fipe_brand: toStr(raw.fipe_brand),
        fipe_model: toStr(raw.fipe_model),
        fipe_year: toNum(raw.fipe_year),
        fipe_ref_period: toStr(raw.fipe_ref_period),
        fipe_diff_pct: toNum(raw.fipe_diff_pct),
        event_type: 'first_seen',
        recorded_at: toStr(raw.first_seen_at) || toStr(raw.created) || toStr(raw.updated) || new Date().toISOString(),
      });
      created++;
    }

    if (page >= res.totalPages) break;
    page++;
  }

  return { scanned, created };
}
