import type { CarAlertRow } from "../clients/db-adapter";

export interface AlertCandidateCar {
  id: string;
  ref: string;
  title: string;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  year?: number | null;
  price: number;
  mileageKm?: number | null;
  transmission?: string | null;
  fuel?: string | null;
  isTurbo?: boolean | null;
  city?: string | null;
  neighborhood?: string | null;
  fipeCode?: string | null;
  fipeBrand?: string | null;
  fipeModel?: string | null;
  fipePrice?: number | null;
  fipeDiffPct?: number | null;
}

export function inferPortalName(ref: string): string {
  const lower = (ref || "").toLowerCase();
  if (lower.includes("olx.com.br")) return "OLX Carros";
  if (lower.includes("webmotors.com.br")) return "Webmotors";
  return "Outro portal";
}

export function normalizeTextForMatch(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function tokenizeMatchQuery(query: string | null | undefined): string[] {
  const norm = normalizeTextForMatch(query);
  if (!norm) return [];
  return norm.split(/\s+/).filter(Boolean);
}

export function doesCarMatchAlert(
  car: AlertCandidateCar,
  alert: CarAlertRow,
): boolean {
  if (!alert.active) return false;
  if (!car.price || car.price <= 0) return false;

  const portal = inferPortalName(car.ref);
  if (alert.portal && alert.portal !== "todos" && portal !== alert.portal) {
    return false;
  }

  if (alert.city && alert.city !== "todas") {
    const cityNorm = normalizeTextForMatch(car.city);
    const alertCityNorm = normalizeTextForMatch(alert.city);
    if (!cityNorm.includes(alertCityNorm)) return false;
  }

  if (alert.brand) {
    const brandNorm = normalizeTextForMatch(alert.brand);
    const carBrand = normalizeTextForMatch(car.brand);
    const carFipeBrand = normalizeTextForMatch(car.fipeBrand);
    if (carBrand !== brandNorm && !carFipeBrand.includes(brandNorm)) {
      return false;
    }
  }

  if (alert.fipeCode) {
    if ((car.fipeCode ?? "").trim() !== alert.fipeCode.trim()) return false;
  }

  if (alert.model) {
    const modelNorm = normalizeTextForMatch(alert.model);
    const haystack = normalizeTextForMatch(
      `${car.model ?? ""} ${car.fipeModel ?? ""} ${car.title}`,
    );
    if (!haystack.includes(modelNorm)) return false;
  }

  if (alert.version) {
    const versionTokens = tokenizeMatchQuery(alert.version);
    const haystack = normalizeTextForMatch(
      `${car.version ?? ""} ${car.fipeModel ?? ""} ${car.title}`,
    );
    if (!versionTokens.every((tok) => haystack.includes(tok))) return false;
  }

  if (alert.motorizacao === "turbo" && !car.isTurbo) return false;
  if (alert.motorizacao === "aspirado" && car.isTurbo) return false;

  if (alert.transmission && alert.transmission !== "todos") {
    const trAlert = normalizeTextForMatch(alert.transmission);
    const trCar = normalizeTextForMatch(car.transmission);
    const titleFallback = trCar
      ? ""
      : normalizeTextForMatch(`${car.title ?? ""} ${car.fipeModel ?? ""}`);
    const isAutoCar =
      trCar.includes("automat") ||
      trCar.includes("dsg") ||
      trCar.includes("tiptr") ||
      /\baut\b/.test(titleFallback) ||
      titleFallback.includes("tiptr") ||
      titleFallback.includes("dsg") ||
      titleFallback.includes("s-tronic");
    const isCvtCar = trCar.includes("cvt") || /\be?-?cvt\b/.test(titleFallback);

    if (trAlert === "automatico_cvt" || trAlert === "automatico") {
      if (!isAutoCar && !isCvtCar) {
        return false;
      }
    } else if (trAlert === "cvt") {
      if (!isCvtCar) {
        return false;
      }
    } else if (!trCar.includes(trAlert) && !titleFallback.includes(trAlert)) {
      return false;
    }
  }

  if (alert.fuel && alert.fuel !== "todos") {
    const fuelAlert = normalizeTextForMatch(alert.fuel);
    const fuelCar = normalizeTextForMatch(car.fuel);
    if (!fuelCar.includes(fuelAlert)) return false;
  }

  const yr = car.year ?? 0;
  if (alert.minYear > 0 && (yr <= 0 || yr < alert.minYear)) return false;
  if (alert.maxYear > 0 && (yr <= 0 || yr > alert.maxYear)) return false;

  if (alert.minPrice > 0 && car.price < alert.minPrice) return false;
  if (alert.maxPrice > 0 && car.price > alert.maxPrice) return false;

  if (alert.maxKm > 0) {
    if (car.mileageKm == null || car.mileageKm > alert.maxKm) return false;
  }

  if (alert.onlyBelowFipe) {
    if (!car.fipePrice || car.fipePrice <= 0) return false;
    if (car.fipeDiffPct == null || car.fipeDiffPct > 0) return false;
  }

  if (alert.minFipeDiscountPct > 0) {
    if (!car.fipePrice || car.fipePrice <= 0) return false;
    if (car.fipeDiffPct == null || car.fipeDiffPct > -alert.minFipeDiscountPct) {
      return false;
    }
  }

  const queryTokens = tokenizeMatchQuery(alert.searchQuery);
  if (queryTokens.length > 0) {
    const searchable = normalizeTextForMatch(
      [
        car.title,
        car.brand,
        car.model,
        car.version,
        car.year ? String(car.year) : "",
        car.neighborhood,
        car.city,
        car.fipeCode,
        car.fipeBrand,
        car.fipeModel,
        car.transmission,
        car.fuel,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (!queryTokens.every((tok) => searchable.includes(tok))) {
      return false;
    }
  }

  return true;
}
