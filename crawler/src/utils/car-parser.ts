import { parseMileageToKm, parseYearPair } from "./number";

const BRAND_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\b(volkswagen|vw)\b/i, canonical: "Volkswagen" },
  { pattern: /\b(chevrolet|gm)\b/i, canonical: "Chevrolet" },
  { pattern: /\bfiat\b/i, canonical: "Fiat" },
  { pattern: /\btoyota\b/i, canonical: "Toyota" },
  { pattern: /\bhonda\b/i, canonical: "Honda" },
  { pattern: /\bhyundai\b/i, canonical: "Hyundai" },
  { pattern: /\bjeep\b/i, canonical: "Jeep" },
  { pattern: /\brenault\b/i, canonical: "Renault" },
  { pattern: /\bnissan\b/i, canonical: "Nissan" },
  { pattern: /\bford\b/i, canonical: "Ford" },
  { pattern: /\bpeugeot\b/i, canonical: "Peugeot" },
  { pattern: /\bcitro[eë]n\b/i, canonical: "Citroën" },
  { pattern: /\bbyd\b/i, canonical: "BYD" },
  { pattern: /\bgwm\b/i, canonical: "GWM" },
  { pattern: /\b(caoa\s*chery|chery)\b/i, canonical: "Caoa Chery" },
  { pattern: /\bmitsubishi\b/i, canonical: "Mitsubishi" },
  { pattern: /\bbmw\b/i, canonical: "BMW" },
  { pattern: /\bmercedes(?:-benz)?\b/i, canonical: "Mercedes-Benz" },
  { pattern: /\baudi\b/i, canonical: "Audi" },
  { pattern: /\bkia\b/i, canonical: "Kia" },
  { pattern: /\bvolvo\b/i, canonical: "Volvo" },
  { pattern: /\bsuzuki\b/i, canonical: "Suzuki" },
  { pattern: /\bland\s*rover\b/i, canonical: "Land Rover" },
  { pattern: /\bporsche\b/i, canonical: "Porsche" },
  { pattern: /\bmini\b/i, canonical: "MINI" },
  { pattern: /\bram\b/i, canonical: "RAM" },
  { pattern: /\bjac\b/i, canonical: "JAC" },
  { pattern: /\bsubaru\b/i, canonical: "Subaru" },
  { pattern: /\btroller\b/i, canonical: "Troller" },
];

export function normalizeBrand(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  for (const { pattern, canonical } of BRAND_ALIASES) {
    if (pattern.test(trimmed)) return canonical;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function inferTransmission(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(?:e-?cvt|ecvt|cvt)\b/.test(lower)) return "CVT";
  if (
    /\b(?:autom[aá]tic[oac]?s?|aut|autoshift|tiptronic|tiptr|dsg|s-?tronic|s\.tr|g-?tronic|steptronic|powershift|pdk|multitronic|geartronic|at\d?)\b/.test(
      lower,
    )
  ) {
    return "Automático";
  }
  if (/\b(?:automatizado|imotion|i-motion|dualogic|easytronic)\b/.test(lower)) {
    return "Automatizado";
  }
  if (/\b(?:manual|mec[aâ]nico|mec|mt\d?)\b/.test(lower)) {
    return "Manual";
  }
  return undefined;
}

export function inferFuel(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(?:el[eé]trico|ev|bev)\b/.test(lower)) return "Elétrico";
  if (/\b(?:h[ií]br[ií]do|hybrid|hib|phev|hev|mhev)\b/.test(lower)) return "Híbrido";
  if (/\bflex\b/.test(lower)) return "Flex";
  if (/\bdiesel\b/.test(lower)) return "Diesel";
  if (/\b(?:gasolina|gas)\b/.test(lower)) return "Gasolina";
  if (/\b(?:[aá]lcool|etanol)\b/.test(lower)) return "Etanol";
  if (/\bgnv\b/.test(lower)) return "GNV";
  return undefined;
}

export function inferBodyType(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(suv|utilit[aá]rio esportivo)\b/.test(lower)) return "SUV";
  if (/\b(sedan|sed[aã])\b/.test(lower)) return "Sedan";
  if (/\bhatch(?:back)?\b/.test(lower)) return "Hatch";
  if (/\b(picape|pick-?up|cabine dupla|cabine simples)\b/.test(lower)) return "Picape";
  if (/\b(perua|wagon|sw)\b/.test(lower)) return "Perua";
  if (/\b(minivan|van|furg[aã]o|utilit[aá]rio)\b/.test(lower)) return "Utilitário";
  if (/\b(cup[eê]|coup[eé])\b/.test(lower)) return "Cupê";
  return undefined;
}

export function inferSellerType(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(profissional|loja|concession[aá]ria|revenda|multimarcas|dealer)\b/.test(lower)) {
    return "Loja";
  }
  if (/\b(particular|propriet[aá]rio|privado)\b/.test(lower)) {
    return "Particular";
  }
  return undefined;
}

export function inferEngineSize(text: string): {
  engineSize?: string;
  isTurbo?: boolean;
} {
  const lower = text.toLowerCase();
  const isTurbo = /\b(?:tb|(?:\d+)?tsi|(?:\d+)?tce|tgdi|t-?gdi|thp|tfsie?|t270|t200|ecoboost|turbo|biturbo|bi-tb|twinpower|tdi|cgi|kompressor)\b/i.test(
    lower,
  );
  const engineMatch = text.match(/\b([1-6]\.[0-9])\b/);
  return {
    engineSize: engineMatch?.[1],
    isTurbo: isTurbo || undefined,
  };
}

const NON_CAR_URL_PATTERN =
  /\/(motos|pecas-e-acessorios|caminhoes|onibus|barcos-e-aeronaves|quadriciclos|triciclos)(\/|$)/i;

const NON_CAR_TITLE_PATTERN =
  /\b(motos?|motocicleta|scooter|biz\s*\d*|cg\s*\d*|titan\s*\d*|fan\s*\d*|start\s*160|nxr|bros\s*\d*|xre\s*\d*|cb\s*(?:250|300|500|650|1000)|twister|hornet|pop\s*110|pcx\s*\d*|adv\s*150|nmax|xmax|fazer\s*\d*|factor\s*\d*|lander\s*\d*|tenere|xtz|mt-?0[379]|ninja\s*\d*|z400|versys|yamaha|kawasaki|ducati|harley(?:-davidson)?|dafra|shineray|royal\s*enfield|ktm|burgman|gsx|hayabusa|v-strom|capacete|bauleto|para-?choque|sucata|som\s*automotivo|quadriciclo|triciclo)\b/i;

export function isNonCarListing(
  title: string | undefined | null,
  url?: string | null,
  brand?: string | null,
): boolean {
  if (url && NON_CAR_URL_PATTERN.test(url)) {
    return true;
  }
  const combined = `${brand ?? ""} ${title ?? ""}`.trim();
  if (!combined) return false;
  return NON_CAR_TITLE_PATTERN.test(combined);
}

export interface ParsedCarText {
  brand?: string;
  model?: string;
  version?: string;
  year?: number;
  manufacture_year?: number;
  mileage_km?: number;
  transmission?: string;
  fuel?: string;
  engine_size?: string;
  is_turbo?: boolean;
  body_type?: string;
  seller_type?: string;
}

export function parseCarText(title: string, details = ""): ParsedCarText {
  const combined = `${title} ${details}`.trim();
  const brand = normalizeBrand(title) ?? normalizeBrand(combined);
  const { manufactureYear, modelYear } = parseYearPair(combined);
  const mileage_km = parseMileageToKm(combined);
  const transmission = inferTransmission(combined);
  const fuel = inferFuel(combined);
  const body_type = inferBodyType(combined);
  const seller_type = inferSellerType(combined);
  const { engineSize, isTurbo } = inferEngineSize(combined);

  let model: string | undefined;
  let version: string | undefined;

  if (title.trim()) {
    let cleaned = title.trim();
    if (brand) {
      cleaned = cleaned.replace(
        new RegExp(`^(${brand}(?:\\s+motors)?|vw|gm|volkswagen|chevrolet|citroen)\\s+`, "i"),
        "",
      );
    }
    cleaned = cleaned.replace(/\b(19[6-9]\d|20[0-3]\d)(?:\s*[/\-]\s*(?:19[6-9]\d|20[0-3]\d))?\b/g, "").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      model = parts[0];
      if (parts.length > 1) {
        version = parts.slice(1).join(" ");
      }
    }
  }

  return {
    brand,
    model,
    version,
    year: modelYear,
    manufacture_year: manufactureYear,
    mileage_km,
    transmission,
    fuel,
    engine_size: engineSize,
    is_turbo: isTurbo,
    body_type,
    seller_type,
  };
}
