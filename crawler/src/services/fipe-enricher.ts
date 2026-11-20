import axios from "axios";
import { getAdapter } from "../clients/db";
import { Logger } from "../config/logger";
import type { ExtractedCarListing } from "../pages/base-scraper";
import {
  inferEngineSize,
  inferFuel,
  inferTransmission,
} from "../utils/car-parser";

function inferCombinedCarSpecs(
  base: {
    title?: string | null;
    version?: string | null;
    engineSize?: string | null;
    isTurbo?: boolean | null;
    transmission?: string | null;
    fuel?: string | null;
  },
  match?: FipeMatchApiItem,
): {
  engineSize?: string;
  isTurbo: boolean;
  transmission?: string;
  fuel?: string;
} {
  const combined = `${base.title ?? ""} ${base.version ?? ""} ${match?.nome_modelo ?? ""} ${match?.nome_combustivel ?? ""}`.trim();
  const inferredEngine = inferEngineSize(combined);
  return {
    engineSize: base.engineSize || inferredEngine.engineSize,
    isTurbo: Boolean(base.isTurbo) || Boolean(inferredEngine.isTurbo),
    transmission: base.transmission || inferTransmission(combined),
    fuel:
      base.fuel ||
      inferFuel(combined) ||
      (match?.nome_combustivel?.trim() || undefined),
  };
}

export interface FipeMatchApiItem {
  codigo_fipe: string;
  nome_marca: string;
  nome_modelo: string;
  ano_modelo: number;
  nome_combustivel?: string | null;
  valor: number;
  valor_formatado: string;
  periodo_referencia: string;
  confidence: number;
}

interface FipeMatchApiResponse {
  dataset_available: boolean;
  matches: Record<string, FipeMatchApiItem>;
}

interface MatchCandidateInput {
  id: string;
  brand?: string;
  model?: string;
  version?: string;
  year?: number | null;
  fuel?: string;
  transmission?: string;
  title?: string;
}

function getBackendCandidates(): string[] {
  const configured = process.env.FIPEX_BACKEND_URL?.trim().replace(/\/+$/, "");
  if (configured) return [configured];
  return ["http://backend:8000", "http://127.0.0.1:8000"];
}

export function computeFipeDiffPct(
  askingPrice: number | undefined | null,
  fipePrice: number | undefined | null,
): number | undefined {
  if (
    typeof askingPrice !== "number" ||
    !Number.isFinite(askingPrice) ||
    askingPrice <= 0 ||
    typeof fipePrice !== "number" ||
    !Number.isFinite(fipePrice) ||
    fipePrice <= 0
  ) {
    return undefined;
  }
  return Math.round(((askingPrice - fipePrice) / fipePrice) * 1000) / 10;
}

export async function requestFipeMatches(
  items: MatchCandidateInput[],
): Promise<FipeMatchApiResponse> {
  if (items.length === 0) {
    return { dataset_available: true, matches: {} };
  }

  for (const baseUrl of getBackendCandidates()) {
    try {
      const res = await axios.post<FipeMatchApiResponse>(
        `${baseUrl}/api/search/fipe-match`,
        { items },
        { timeout: 15000 },
      );
      if (res.data && typeof res.data === "object") {
        return res.data;
      }
    } catch {
      // Try next candidate URL
    }
  }

  return { dataset_available: false, matches: {} };
}

export async function enrichListingsWithFipe(
  listings: ExtractedCarListing[],
): Promise<ExtractedCarListing[]> {
  if (listings.length === 0) return listings;

  const candidates: MatchCandidateInput[] = listings.map((item, idx) => ({
    id: String(idx),
    brand: item.features.brand,
    model: item.features.model,
    version: item.features.version,
    year: item.features.year ?? null,
    fuel: item.features.fuel,
    transmission: item.features.transmission,
    title: item.features.title ?? item.text_description,
  }));

  const res = await requestFipeMatches(candidates);
  if (!res.dataset_available) {
    return listings;
  }

  return listings.map((item, idx) => {
    const match = res.matches[String(idx)];
    const fipePrice = match?.valor ?? item.features.fipe_price;
    const fipeDiffPct = computeFipeDiffPct(item.features.price, fipePrice);
    const specs = inferCombinedCarSpecs(
      {
        title: item.features.title ?? item.text_description,
        version: item.features.version,
        engineSize: item.features.engine_size,
        isTurbo: item.features.is_turbo,
        transmission: item.features.transmission,
        fuel: item.features.fuel,
      },
      match,
    );

    if (!match) {
      return {
        ...item,
        features: {
          ...item.features,
          engine_size: specs.engineSize,
          is_turbo: specs.isTurbo || item.features.is_turbo,
          transmission: specs.transmission,
          fuel: specs.fuel,
          ...(fipePrice && fipeDiffPct !== undefined
            ? { fipe_price: fipePrice, fipe_diff_pct: fipeDiffPct }
            : {}),
        },
      };
    }

    return {
      ...item,
      features: {
        ...item.features,
        engine_size: specs.engineSize,
        is_turbo: specs.isTurbo || item.features.is_turbo,
        transmission: specs.transmission,
        fuel: specs.fuel,
        fipe_price: match.valor,
        fipe_code: match.codigo_fipe,
        fipe_brand: match.nome_marca,
        fipe_model: match.nome_modelo,
        fipe_year: match.ano_modelo,
        fipe_ref_period: match.periodo_referencia,
        fipe_diff_pct: fipeDiffPct,
      },
    };
  });
}

export async function backfillUnmatchedCarros(
  batchSize = 150,
  maxBatches = 100,
): Promise<{ processed: number; matched: number }> {
  const db = getAdapter();
  let processed = 0;
  let matched = 0;
  const skippedIds = new Set<string>();

  for (let round = 0; round < maxBatches; round++) {
    const rows = await db.getCarrosMissingFipe(batchSize);
    const pending = rows.filter((r) => !skippedIds.has(r.id));
    if (pending.length === 0) break;

    const candidates: MatchCandidateInput[] = pending.map((r) => ({
      id: r.id,
      brand: r.brand ?? undefined,
      model: r.model ?? undefined,
      version: r.version ?? undefined,
      year: r.year ?? undefined,
      fuel: r.fuel ?? undefined,
      transmission: r.transmission ?? undefined,
      title: r.textDescription ?? undefined,
    }));

    const res = await requestFipeMatches(candidates);
    if (!res.dataset_available) {
      Logger.warn("FIPE dataset unavailable during backfill; skipping");
      break;
    }

    for (const row of pending) {
      processed++;
      const match = res.matches[row.id];
      const specs = inferCombinedCarSpecs(
        {
          title: row.textDescription,
          version: row.version,
          engineSize: row.engineSize,
          isTurbo: row.isTurbo,
          transmission: row.transmission,
          fuel: row.fuel,
        },
        match,
      );

      if (match) {
        const fipeDiffPct = computeFipeDiffPct(row.price, match.valor) ?? 0;
        await db.updateCarroFipe(row.id, {
          engineSize: specs.engineSize,
          isTurbo: specs.isTurbo,
          transmission: specs.transmission,
          fuel: specs.fuel,
          fipePrice: match.valor,
          fipeCode: match.codigo_fipe,
          fipeBrand: match.nome_marca,
          fipeModel: match.nome_modelo,
          fipeYear: match.ano_modelo,
          fipeRefPeriod: match.periodo_referencia,
          fipeDiffPct,
        });
        matched++;
      } else {
        // Mark as checked ("UNMATCHED") so subsequent loops don't re-scan the same unmatched record forever
        await db.updateCarroFipe(row.id, {
          engineSize: specs.engineSize,
          isTurbo: specs.isTurbo,
          transmission: specs.transmission,
          fuel: specs.fuel,
          fipePrice: row.fipePrice ?? 0,
          fipeCode: "N/A",
          fipeBrand: "",
          fipeModel: "",
          fipeYear: 0,
          fipeRefPeriod: "",
          fipeDiffPct:
            computeFipeDiffPct(row.price, row.fipePrice) ?? 0,
        });
        skippedIds.add(row.id);
      }
    }

    if (rows.length < batchSize) break;
  }

  Logger.info({ processed, matched }, "FIPE backfill finished");
  return { processed, matched };
}
