import { user_agent } from "../config/puppeteer_conf";
import { isValidOlxCarUrl } from "../pages/olx-carros";
import { isValidWebmotorsCarUrl } from "../pages/webmotors-carros";

export type ListingAvailabilityStatus = "active" | "inactive" | "unknown";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  status: number;
  url: string;
  text(): Promise<string>;
}>;

const UNAVAILABLE_HTML_PATTERNS: RegExp[] = [
  /an[uú]ncio\s+n[aã]o\s+encontrado/i,
  /este\s+an[uú]ncio\s+(?:foi\s+)?(?:removido|vendido|desativado|expirado|encerrado)/i,
  /an[uú]ncio\s+(?:encerrado|expirado|indispon[ií]vel)/i,
  /ops[!,.]?\s*(?:este\s+an[uú]ncio\s+)?n[aã]o\s+est[aá]\s+mais\s+dispon[ií]vel/i,
  /ops[!,.]?\s*n[aã]o\s+encontramos/i,
  /ve[ií]culo\s+(?:j[aá]\s+foi\s+)?vendido/i,
  /"(?:listing_?status|ad_?status|status)"\s*:\s*"(?:inactive|deleted|expired|sold|removed)"/i,
  /"sold"\s*:\s*true/i,
];

const CHALLENGE_HTML_PATTERNS: RegExp[] = [
  /cf-browser-verification/i,
  /cf-challenge/i,
  /just a moment/i,
  /enable cookies/i,
  /attention required!\s*\|\s*cloudflare/i,
  /g-recaptcha/i,
  /hcaptcha/i,
  /azion/i,
];

function matchesPortalListingUrl(url: string): boolean {
  if (!url) return false;
  if (/olx\.com\.br/i.test(url)) {
    if (!isValidOlxCarUrl(url)) return false;
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "");
      return /\/d\/|-\d{5,}$/i.test(path);
    } catch {
      return false;
    }
  }
  if (/webmotors\.com\.br/i.test(url)) return isValidWebmotorsCarUrl(url);
  return true;
}

/**
 * Checks whether an existing scraped car URL (`ref`) is still live.
 * Conservative on HTTP 403/429/5xx or anti-bot challenges (returns `"unknown"`
 * so temporary blocks never deactivate valid ads).
 */
export async function checkListingUrlAvailability(
  ref: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 10000,
): Promise<ListingAvailabilityStatus> {
  if (!ref) return "unknown";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(ref, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": user_agent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if (res.status === 404 || res.status === 410) {
      return "inactive";
    }

    if (res.status === 403 || res.status === 429 || res.status >= 500 || res.status < 200) {
      return "unknown";
    }

    const finalUrl = res.url || ref;
    if (!matchesPortalListingUrl(finalUrl)) {
      return "inactive";
    }

    const body = await res.text();
    if (!body || body.trim().length < 200) {
      return "unknown";
    }

    if (CHALLENGE_HTML_PATTERNS.some((re) => re.test(body))) {
      return "unknown";
    }

    if (UNAVAILABLE_HTML_PATTERNS.some((re) => re.test(body))) {
      return "inactive";
    }

    return "active";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}
