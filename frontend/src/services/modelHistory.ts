import PocketBase, { ClientResponseError } from 'pocketbase';
import {
  buildCambioFilterClause,
  buildTokenizedSearchClauses,
  DEFAULT_REGIONAL_CITIES,
  mergeAndSortRegionalCities,
  PB_CAR_COLLECTIONS,
} from './pocketbase';
import { inferPortalName, normalizeSearchText } from '../lib/formatters';

export interface ModelHistoryQuery {
  search: string;
  brand?: string;
  minYear?: string;
  maxYear?: string;
  minPrice?: string;
  maxPrice?: string;
  maxKm?: string;
  cambio?: string;
  fuel?: string;
  city?: string;
  portal?: string;
  fipeCode?: string;
  status?: 'all' | 'active' | 'inactive';
}

export interface ModelHistoryFacets {
  brands: string[];
  cities: string[];
  modelChips: Array<{ query: string; label: string; count: number }>;
}

export interface ModelHistorySnapshot {
  id: string;
  carroId: string;
  ref: string;
  portal: string;
  title: string;
  brand: string;
  model: string;
  version: string;
  year: number | null;
  price: number;
  previousPrice: number | null;
  priceDelta: number | null;
  mileageKm: number | null;
  previousMileageKm: number | null;
  transmission: string;
  fuel: string;
  engineSize: string;
  isTurbo: boolean;
  sellerType: string;
  neighborhood: string;
  city: string;
  state: string;
  fipePrice: number | null;
  fipeCode: string;
  fipeModel: string;
  fipeDiffPct: number | null;
  eventType: string;
  recordedAt: string;
  source: 'history' | 'current';
}

export interface GroupedAdHistory {
  ref: string;
  carroId: string;
  title: string;
  portal: string;
  brand: string;
  model: string;
  version: string;
  year: number | null;
  currentPrice: number;
  initialPrice: number;
  lowestPrice: number;
  highestPrice: number;
  priceChangeBrl: number;
  priceChangePct: number | null;
  mileageKm: number | null;
  fipePrice: number | null;
  fipeCode: string;
  fipeModel: string;
  fipeDiffPct: number | null;
  transmission: string;
  fuel: string;
  engineSize: string;
  isTurbo: boolean;
  sellerType: string;
  neighborhood: string;
  city: string;
  state: string;
  firstSeenAt: string;
  lastSeenAt: string;
  listingStatus: string;
  snapshots: ModelHistorySnapshot[];
}

export interface NumericSummaryStats {
  count: number;
  min: number | null;
  p25: number | null;
  median: number | null;
  avg: number | null;
  p75: number | null;
  max: number | null;
}

export interface ModelHistoryTimeBucket {
  dateKey: string;
  label: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgFipePrice: number | null;
  sampleCount: number;
}

export interface ModelHistoryScatterPoint {
  ref: string;
  carroId: string;
  title: string;
  year: number | null;
  price: number;
  mileageKm: number;
  fipePrice: number | null;
  fipeDiffPct: number | null;
  portal: string;
  sellerType: string;
  city: string;
  neighborhood: string;
  status: string;
  lastSeenAt: string;
}

export interface ModelHistoryBreakdownRow {
  label: string;
  count: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgKm: number | null;
  avgFipeDiffPct: number | null;
}

export interface ModelHistoryResult {
  uniqueAdsCount: number;
  activeAdsCount: number;
  inactiveAdsCount: number;
  totalSnapshotsCount: number;
  priceStats: NumericSummaryStats;
  mileageStats: NumericSummaryStats;
  fipeMatchedCount: number;
  avgFipePrice: number | null;
  avgFipeDiffPct: number | null;
  belowFipeCount: number;
  aboveFipeCount: number;
  adsWithPriceDropCount: number;
  adsWithPriceIncreaseCount: number;
  avgDropPct: number | null;
  avgDropBrl: number | null;
  timeSeries: ModelHistoryTimeBucket[];
  scatterPoints: ModelHistoryScatterPoint[];
  portalBreakdown: ModelHistoryBreakdownRow[];
  sellerBreakdown: ModelHistoryBreakdownRow[];
  yearBreakdown: ModelHistoryBreakdownRow[];
  groupedAds: GroupedAdHistory[];
  timelineEvents: ModelHistorySnapshot[];
  historyCollectionAvailable: boolean;
}

function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof ClientResponseError) return err.status;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const s = (err as { status?: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

function toStr(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function toPosNum(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : null;
}

function toMileageNum(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : null;
}

function toSignedNum(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const weight = idx - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

function computeStats(values: number[]): NumericSummaryStats {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) {
    return { count: 0, min: null, p25: null, median: null, avg: null, p75: null, max: null };
  }
  const sum = clean.reduce((acc, v) => acc + v, 0);
  return {
    count: clean.length,
    min: clean[0]!,
    p25: percentile(clean, 0.25),
    median: percentile(clean, 0.5),
    avg: sum / clean.length,
    p75: percentile(clean, 0.75),
    max: clean[clean.length - 1]!,
  };
}

function buildQueryClauses(pb: PocketBase, query: ModelHistoryQuery): string[] {
  const clauses: string[] = ['price > 0'];

  if (query.brand) {
    clauses.push(pb.filter('(brand = {:br} || fipe_brand ~ {:br})', { br: query.brand }));
  }
  if (query.city && query.city !== 'todas') {
    clauses.push(pb.filter('city ~ {:city}', { city: query.city }));
  }
  if (query.portal === 'OLX Carros') {
    clauses.push('ref ~ "olx.com.br"');
  } else if (query.portal === 'Webmotors') {
    clauses.push('ref ~ "webmotors.com.br"');
  }
  if (query.fipeCode) {
    clauses.push(pb.filter('fipe_code = {:fc}', { fc: query.fipeCode }));
  }
  const minY = Number(query.minYear) || 0;
  const maxY = Number(query.maxYear) || 0;
  if (minY > 0) clauses.push(pb.filter('year >= {:miny}', { miny: minY }));
  if (maxY > 0) clauses.push(pb.filter('year > 0 && year <= {:maxy}', { maxy: maxY }));

  const minP = Number((query.minPrice ?? '').replace(/[^\d]/g, '')) || 0;
  const maxP = Number((query.maxPrice ?? '').replace(/[^\d]/g, '')) || 0;
  if (minP > 0) clauses.push(pb.filter('price >= {:minp}', { minp: minP }));
  if (maxP > 0) clauses.push(pb.filter('price <= {:maxp}', { maxp: maxP }));

  const maxK = Number((query.maxKm ?? '').replace(/[^\d]/g, '')) || 0;
  if (maxK > 0) clauses.push(pb.filter('mileage_km <= {:maxk}', { maxk: maxK }));

  const cambioClause = buildCambioFilterClause(pb, query.cambio, false);
  if (cambioClause) {
    clauses.push(cambioClause);
  }

  if (query.fuel && query.fuel !== 'todos') {
    clauses.push(
      pb.filter('(fuel ~ {:fuel} || text_description ~ {:fuel})', { fuel: query.fuel }),
    );
  }

  clauses.push(...buildTokenizedSearchClauses(pb, query.search));
  return clauses;
}

function mapHistoryRecord(rec: Record<string, unknown>): ModelHistorySnapshot {
  const ref = toStr(rec.ref);
  const price = toPosNum(rec.price) ?? 0;
  const fipePrice = toPosNum(rec.fipe_price);
  const storedDiff = toSignedNum(rec.fipe_diff_pct);
  const fipeDiffPct =
    fipePrice && price > 0
      ? storedDiff !== null && (storedDiff !== 0 || price === fipePrice)
        ? storedDiff
        : Math.round(((price - fipePrice) / fipePrice) * 1000) / 10
      : null;

  return {
    id: String(rec.id ?? ''),
    carroId: toStr(rec.carro_id),
    ref,
    portal: toStr(rec.portal) || inferPortalName(ref),
    title:
      toStr(rec.text_description) ||
      [toStr(rec.brand), toStr(rec.model), toStr(rec.version)].filter(Boolean).join(' ') ||
      'Veículo',
    brand: toStr(rec.brand),
    model: toStr(rec.model),
    version: toStr(rec.version),
    year: toPosNum(rec.year),
    price,
    previousPrice: toPosNum(rec.previous_price),
    priceDelta: toSignedNum(rec.price_delta),
    mileageKm: toMileageNum(rec.mileage_km),
    previousMileageKm: toMileageNum(rec.previous_mileage_km),
    transmission: toStr(rec.transmission),
    fuel: toStr(rec.fuel),
    engineSize: toStr(rec.engine_size),
    isTurbo: Boolean(rec.is_turbo),
    sellerType: toStr(rec.seller_type),
    neighborhood: toStr(rec.neighborhood),
    city: toStr(rec.city),
    state: toStr(rec.state) || 'SC',
    fipePrice,
    fipeCode: toStr(rec.fipe_code) === 'N/A' ? '' : toStr(rec.fipe_code),
    fipeModel: toStr(rec.fipe_model),
    fipeDiffPct,
    eventType: toStr(rec.event_type) || 'snapshot',
    recordedAt: toStr(rec.recorded_at) || toStr(rec.created) || toStr(rec.updated),
    source: 'history',
  };
}

function buildBreakdown(
  ads: GroupedAdHistory[],
  keyFn: (ad: GroupedAdHistory) => string,
): ModelHistoryBreakdownRow[] {
  const buckets = new Map<string, GroupedAdHistory[]>();
  for (const ad of ads) {
    const key = keyFn(ad);
    const arr = buckets.get(key) ?? [];
    arr.push(ad);
    buckets.set(key, arr);
  }

  return [...buckets.entries()]
    .map(([label, list]) => {
      const prices = list.map((a) => a.currentPrice).filter((p) => p > 0);
      const kms = list
        .map((a) => a.mileageKm)
        .filter((k): k is number => typeof k === 'number' && k >= 0);
      const diffs = list
        .map((a) => a.fipeDiffPct)
        .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));

      return {
        label,
        count: list.length,
        avgPrice: prices.length > 0 ? prices.reduce((s, v) => s + v, 0) / prices.length : null,
        minPrice: prices.length > 0 ? Math.min(...prices) : null,
        maxPrice: prices.length > 0 ? Math.max(...prices) : null,
        avgKm: kms.length > 0 ? kms.reduce((s, v) => s + v, 0) / kms.length : null,
        avgFipeDiffPct:
          diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : null,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export async function fetchSingleCarSnapshots(
  pb: PocketBase,
  ref: string,
): Promise<ModelHistorySnapshot[]> {
  if (!ref) return [];
  try {
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.CARROS_HISTORY)
      .getList<Record<string, unknown>>(1, 50, {
        filter: pb.filter('ref = {:ref}', { ref }),
        sort: '-recorded_at,-created',
      });
    return res.items.map(mapHistoryRecord);
  } catch {
    return [];
  }
}

export async function fetchHistoryFacets(
  pb: PocketBase,
): Promise<ModelHistoryFacets> {
  try {
    const res = await pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(1, 250, {
        filter: 'price > 0',
        sort: '-updated',
        fields: 'brand,model,city',
      });

    const brands = new Set<string>();
    const observedCities: string[] = [];
    const modelCounts = new Map<string, { query: string; label: string; count: number }>();

    for (const r of res.items) {
      const b = toStr(r.brand);
      const m = toStr(r.model);
      const c = toStr(r.city);
      if (b) brands.add(b);
      if (c) observedCities.push(c);
      if (b && m) {
        const key = `${b.toLowerCase()}::${m.toLowerCase()}`;
        const existing = modelCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          modelCounts.set(key, {
            query: `${b} ${m}`,
            label: `${b} ${m}`,
            count: 1,
          });
        }
      }
    }

    const modelChips = [...modelCounts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 8);

    return {
      brands: [...brands].sort((a, b) => a.localeCompare(b)),
      cities: mergeAndSortRegionalCities(observedCities),
      modelChips,
    };
  } catch {
    return { brands: [], cities: [...DEFAULT_REGIONAL_CITIES], modelChips: [] };
  }
}

export async function fetchModelListingHistory(
  pb: PocketBase,
  query: ModelHistoryQuery,
): Promise<ModelHistoryResult> {
  const filter = buildQueryClauses(pb, query).join(' && ');

  let historyCollectionAvailable = true;
  const [historyItems, currentItems] = await Promise.all([
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS_HISTORY)
      .getList<Record<string, unknown>>(1, 500, {
        filter,
        sort: '-recorded_at,-created',
      })
      .then((r) => r.items)
      .catch((err) => {
        if (getHttpStatus(err) === 404) {
          historyCollectionAvailable = false;
        }
        return [] as Record<string, unknown>[];
      }),
    pb
      .collection(PB_CAR_COLLECTIONS.CARROS)
      .getList<Record<string, unknown>>(1, 300, {
        filter,
        sort: '-updated',
      })
      .then((r) => r.items)
      .catch(() => [] as Record<string, unknown>[]),
  ]);

  const currentByRef = new Map<string, Record<string, unknown>>();
  for (const raw of currentItems) {
    const ref = toStr(raw.ref);
    if (ref) currentByRef.set(ref, raw);
  }

  const snapshotsByRef = new Map<string, ModelHistorySnapshot[]>();

  for (const raw of historyItems) {
    const snap = mapHistoryRecord(raw);
    if (!snap.ref || snap.price <= 0) continue;
    const list = snapshotsByRef.get(snap.ref) ?? [];
    list.push(snap);
    snapshotsByRef.set(snap.ref, list);
  }

  // Merge current ads from carros_temp so even ads scraped before carros_history was introduced
  // show complete price/km baselines immediately
  for (const [ref, raw] of currentByRef.entries()) {
    const existing = snapshotsByRef.get(ref) ?? [];
    const currentPrice = toPosNum(raw.price) ?? 0;
    if (currentPrice <= 0) continue;

    const firstSeenAt = toStr(raw.first_seen_at) || toStr(raw.created) || toStr(raw.updated);
    const lastSeenAt = toStr(raw.last_seen_at) || toStr(raw.updated) || toStr(raw.created);
    const initialPrice = toPosNum(raw.initial_price);
    const fipePrice = toPosNum(raw.fipe_price);
    const fipeCode = toStr(raw.fipe_code) === 'N/A' ? '' : toStr(raw.fipe_code);
    const storedDiff = toSignedNum(raw.fipe_diff_pct);
    const fipeDiffPct =
      fipePrice && currentPrice > 0
        ? storedDiff !== null && (storedDiff !== 0 || currentPrice === fipePrice)
          ? storedDiff
          : Math.round(((currentPrice - fipePrice) / fipePrice) * 1000) / 10
        : null;

    const baseFields = {
      carroId: String(raw.id ?? ''),
      ref,
      portal: inferPortalName(ref),
      title:
        toStr(raw.text_description) ||
        [toStr(raw.brand), toStr(raw.model), toStr(raw.version)].filter(Boolean).join(' ') ||
        'Veículo',
      brand: toStr(raw.brand),
      model: toStr(raw.model),
      version: toStr(raw.version),
      year: toPosNum(raw.year),
      mileageKm: toMileageNum(raw.mileage_km),
      previousMileageKm: null,
      transmission: toStr(raw.transmission),
      fuel: toStr(raw.fuel),
      engineSize: toStr(raw.engine_size),
      isTurbo: Boolean(raw.is_turbo),
      sellerType: toStr(raw.seller_type),
      neighborhood: toStr(raw.neighborhood),
      city: toStr(raw.city),
      state: toStr(raw.state) || 'SC',
      fipePrice,
      fipeCode,
      fipeModel: toStr(raw.fipe_model),
    };

    if (existing.length === 0) {
      if (initialPrice && initialPrice !== currentPrice && firstSeenAt !== lastSeenAt) {
        existing.push({
          ...baseFields,
          id: `synth-init-${baseFields.carroId}`,
          price: initialPrice,
          previousPrice: null,
          priceDelta: null,
          fipeDiffPct:
            fipePrice ? Math.round(((initialPrice - fipePrice) / fipePrice) * 1000) / 10 : null,
          eventType: 'first_seen',
          recordedAt: firstSeenAt,
          source: 'current',
        });
        existing.push({
          ...baseFields,
          id: `synth-cur-${baseFields.carroId}`,
          price: currentPrice,
          previousPrice: initialPrice,
          priceDelta: currentPrice - initialPrice,
          fipeDiffPct,
          eventType: 'price_change',
          recordedAt: lastSeenAt,
          source: 'current',
        });
      } else {
        existing.push({
          ...baseFields,
          id: `synth-cur-${baseFields.carroId}`,
          price: currentPrice,
          previousPrice: null,
          priceDelta: null,
          fipeDiffPct,
          eventType: 'first_seen',
          recordedAt: lastSeenAt || firstSeenAt,
          source: 'current',
        });
      }
      snapshotsByRef.set(ref, existing);
    } else {
      const sorted = [...existing].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
      const newestSnap = sorted[0];
      if (newestSnap && newestSnap.price !== currentPrice) {
        existing.push({
          ...baseFields,
          id: `synth-cur-${baseFields.carroId}`,
          price: currentPrice,
          previousPrice: newestSnap.price,
          priceDelta: currentPrice - newestSnap.price,
          fipeDiffPct,
          eventType: 'price_change',
          recordedAt: lastSeenAt,
          source: 'current',
        });
        snapshotsByRef.set(ref, existing);
      }
    }
  }

  // Group into per-ad histories & apply client-side status/portal verification
  const groupedAds: GroupedAdHistory[] = [];
  const allSnapshots: ModelHistorySnapshot[] = [];

  for (const [ref, snapsRaw] of snapshotsByRef.entries()) {
    const snaps = [...snapsRaw].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
    if (snaps.length === 0) continue;

    const firstSnap = snaps[0]!;
    const lastSnap = snaps[snaps.length - 1]!;
    const currentRaw = currentByRef.get(ref);
    const listingStatus = currentRaw
      ? toStr(currentRaw.listing_status) || 'active'
      : 'inactive';

    if (query.status === 'active' && listingStatus !== 'active') continue;
    if (query.status === 'inactive' && listingStatus === 'active') continue;

    // Optional normalized query verification if query contains multiple tokens
    const queryTokens = normalizeSearchText(query.search).split(/\s+/).filter(Boolean);
    if (queryTokens.length > 0) {
      const hay = normalizeSearchText(
        [
          lastSnap.title,
          lastSnap.brand,
          lastSnap.model,
          lastSnap.version,
          lastSnap.year ? String(lastSnap.year) : '',
          lastSnap.fipeModel,
          lastSnap.fipeCode,
          lastSnap.city,
          lastSnap.neighborhood,
        ]
          .filter(Boolean)
          .join(' '),
      );
      if (!queryTokens.every((t) => hay.includes(t))) continue;
    }

    const snapPrices = snaps.map((s) => s.price).filter((p) => p > 0);
    const currentPrice = lastSnap.price;
    const initialPrice =
      (currentRaw ? toPosNum(currentRaw.initial_price) : null) ?? firstSnap.price;
    const lowestPrice = Math.min(
      ...snapPrices,
      ...(currentRaw && toPosNum(currentRaw.lowest_price)
        ? [toPosNum(currentRaw.lowest_price)!]
        : []),
    );
    const highestPrice = Math.max(
      ...snapPrices,
      ...(currentRaw && toPosNum(currentRaw.highest_price)
        ? [toPosNum(currentRaw.highest_price)!]
        : []),
    );

    const priceChangeBrl = initialPrice > 0 ? currentPrice - initialPrice : 0;
    const priceChangePct =
      initialPrice > 0 && priceChangeBrl !== 0
        ? Math.round((priceChangeBrl / initialPrice) * 1000) / 10
        : null;

    groupedAds.push({
      ref,
      carroId: lastSnap.carroId,
      title: lastSnap.title,
      portal: lastSnap.portal,
      brand: lastSnap.brand,
      model: lastSnap.model,
      version: lastSnap.version,
      year: lastSnap.year,
      currentPrice,
      initialPrice,
      lowestPrice,
      highestPrice,
      priceChangeBrl,
      priceChangePct,
      mileageKm: lastSnap.mileageKm,
      fipePrice: lastSnap.fipePrice,
      fipeCode: lastSnap.fipeCode,
      fipeModel: lastSnap.fipeModel,
      fipeDiffPct: lastSnap.fipeDiffPct,
      transmission: lastSnap.transmission,
      fuel: lastSnap.fuel,
      engineSize: lastSnap.engineSize,
      isTurbo: lastSnap.isTurbo,
      sellerType: lastSnap.sellerType,
      neighborhood: lastSnap.neighborhood,
      city: lastSnap.city,
      state: lastSnap.state,
      firstSeenAt:
        (currentRaw ? toStr(currentRaw.first_seen_at) : '') || firstSnap.recordedAt,
      lastSeenAt:
        (currentRaw ? toStr(currentRaw.last_seen_at) : '') || lastSnap.recordedAt,
      listingStatus,
      snapshots: [...snaps].reverse(),
    });

    allSnapshots.push(...snaps);
  }

  groupedAds.sort(
    (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
  allSnapshots.sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  // Aggregate stats over unique observed ads (practiced prices & mileages)
  const adPrices = groupedAds.map((a) => a.currentPrice).filter((p) => p > 0);
  const adMileages = groupedAds
    .map((a) => a.mileageKm)
    .filter((k): k is number => typeof k === 'number' && k >= 0);

  const priceStats = computeStats(adPrices);
  const mileageStats = computeStats(adMileages);

  const fipeAds = groupedAds.filter((a) => a.fipePrice && a.fipePrice > 0);
  const fipePrices = fipeAds.map((a) => a.fipePrice!);
  const fipeDiffs = fipeAds
    .map((a) => a.fipeDiffPct)
    .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));

  const dropAds = groupedAds.filter((a) => a.priceChangeBrl < 0);
  const incAds = groupedAds.filter((a) => a.priceChangeBrl > 0);

  // Build daily time-series buckets from snapshots
  const dayBuckets = new Map<
    string,
    { prices: number[]; fipes: number[] }
  >();
  for (const snap of allSnapshots) {
    if (!snap.recordedAt || snap.price <= 0) continue;
    const d = new Date(snap.recordedAt);
    if (Number.isNaN(d.getTime())) continue;
    const dateKey = d.toISOString().slice(0, 10);
    const b = dayBuckets.get(dateKey) ?? { prices: [], fipes: [] };
    b.prices.push(snap.price);
    if (snap.fipePrice && snap.fipePrice > 0) b.fipes.push(snap.fipePrice);
    dayBuckets.set(dateKey, b);
  }

  const timeSeries: ModelHistoryTimeBucket[] = [...dayBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, b]) => {
      const [y, m, day] = dateKey.split('-');
      return {
        dateKey,
        label: `${day}/${m}/${y?.slice(2)}`,
        avgPrice: Math.round(b.prices.reduce((s, v) => s + v, 0) / b.prices.length),
        minPrice: Math.min(...b.prices),
        maxPrice: Math.max(...b.prices),
        avgFipePrice:
          b.fipes.length > 0
            ? Math.round(b.fipes.reduce((s, v) => s + v, 0) / b.fipes.length)
            : null,
        sampleCount: b.prices.length,
      };
    });

  const scatterPoints: ModelHistoryScatterPoint[] = groupedAds
    .filter((a) => a.mileageKm !== null && a.currentPrice > 0)
    .map((a) => ({
      ref: a.ref,
      carroId: a.carroId,
      title: a.title,
      year: a.year,
      price: a.currentPrice,
      mileageKm: a.mileageKm!,
      fipePrice: a.fipePrice,
      fipeDiffPct: a.fipeDiffPct,
      portal: a.portal,
      sellerType: a.sellerType,
      city: a.city,
      neighborhood: a.neighborhood,
      status: a.listingStatus,
      lastSeenAt: a.lastSeenAt,
    }));

  return {
    uniqueAdsCount: groupedAds.length,
    activeAdsCount: groupedAds.filter((a) => a.listingStatus === 'active').length,
    inactiveAdsCount: groupedAds.filter((a) => a.listingStatus !== 'active').length,
    totalSnapshotsCount: allSnapshots.length,
    priceStats,
    mileageStats,
    fipeMatchedCount: fipeAds.length,
    avgFipePrice:
      fipePrices.length > 0
        ? fipePrices.reduce((s, v) => s + v, 0) / fipePrices.length
        : null,
    avgFipeDiffPct:
      fipeDiffs.length > 0
        ? fipeDiffs.reduce((s, v) => s + v, 0) / fipeDiffs.length
        : null,
    belowFipeCount: fipeDiffs.filter((d) => d <= 0).length,
    aboveFipeCount: fipeDiffs.filter((d) => d > 0).length,
    adsWithPriceDropCount: dropAds.length,
    adsWithPriceIncreaseCount: incAds.length,
    avgDropPct:
      dropAds.length > 0
        ? dropAds.reduce((s, a) => s + (a.priceChangePct ?? 0), 0) / dropAds.length
        : null,
    avgDropBrl:
      dropAds.length > 0
        ? dropAds.reduce((s, a) => s + a.priceChangeBrl, 0) / dropAds.length
        : null,
    timeSeries,
    scatterPoints,
    portalBreakdown: buildBreakdown(groupedAds, (a) => a.portal || 'Outro portal'),
    sellerBreakdown: buildBreakdown(groupedAds, (a) => a.sellerType || 'Não informado'),
    yearBreakdown: buildBreakdown(groupedAds, (a) => (a.year ? String(a.year) : 'Sem ano')),
    groupedAds,
    timelineEvents: allSnapshots,
    historyCollectionAvailable,
  };
}
