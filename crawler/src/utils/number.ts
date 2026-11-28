export function parseCurrencyToNumber(
  currency: string | number | undefined | null,
): number {
  if (typeof currency === "number") {
    return Number.isFinite(currency) ? currency : NaN;
  }

  if (!currency) return NaN;

  const cleaned = currency.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return NaN;

  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }

  if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, ""));
  }

  return parseFloat(cleaned);
}

export function parseMileageToKm(
  raw: string | number | undefined | null,
): number | undefined {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : undefined;
  }
  if (!raw) return undefined;

  const text = raw.toLowerCase().trim();
  const milMatch = text.match(/(\d+(?:[.,]\d+)?)\s*mil\s*(?:km)?/i);
  if (milMatch?.[1]) {
    const val = parseFloat(milMatch[1].replace(",", "."));
    return Number.isFinite(val) && val >= 0 ? Math.round(val * 1000) : undefined;
  }

  const kmMatch = text.match(/(\d[\d.]*)\s*km\b/i);
  const target = kmMatch?.[1] ?? text;
  const digits = target.replace(/[^\d]/g, "");
  if (!digits) return undefined;

  const parsed = parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2_000_000) {
    return undefined;
  }
  return parsed;
}

export function parseYearPair(
  raw: string | number | undefined | null,
): { manufactureYear?: number; modelYear?: number } {
  if (typeof raw === "number") {
    const yr = Math.round(raw);
    if (yr >= 1950 && yr <= 2030) return { modelYear: yr };
    return {};
  }
  if (!raw) return {};

  const str = String(raw).trim();
  // Ignore "2008" when it is the Peugeot 2008 model name rather than the vehicle year.
  const withoutModelNumbers = str.replace(/\bpeugeot\s+2008\b/gi, "peugeot ");

  const pairMatch = withoutModelNumbers.match(
    /\b(19[5-9]\d|20[0-3]\d)\s*[/\-]\s*(19[5-9]\d|20[0-3]\d)\b/,
  );
  if (pairMatch?.[1] && pairMatch?.[2]) {
    const y1 = parseInt(pairMatch[1], 10);
    const y2 = parseInt(pairMatch[2], 10);
    return {
      manufactureYear: Math.min(y1, y2),
      modelYear: Math.max(y1, y2),
    };
  }

  const singleMatches = Array.from(
    withoutModelNumbers.matchAll(/\b(19[6-9]\d|20[0-3]\d)\b/g),
  );
  const lastMatch = singleMatches[singleMatches.length - 1];
  if (lastMatch?.[1]) {
    return { modelYear: parseInt(lastMatch[1], 10) };
  }

  return {};
}
