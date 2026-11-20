import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Page } from "puppeteer";
import { init_conf, user_agent } from "../config/puppeteer_conf";
import { Logger } from "../config/logger";
import { CrawlerRunsRepository } from "../repository/crawler-runs-repository";
import { CarrosRepository } from "../repository/carros-repository";
import type { CarFeatures } from "../models/carro";
import { enrichListingsWithFipe } from "../services/fipe-enricher";
import { detectAntiBotChallenge } from "./extractors";

puppeteer.use(StealthPlugin());

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const EMPTY_PAGE_THRESHOLD = 4;
const DEFAULT_DELAY_MS = 2500;

export interface ExtractedCarListing {
  ref: string;
  text_description: string;
  features: CarFeatures;
  images?: string[];
}

export interface ScraperOptions {
  maxPages?: number;
  maxListings?: number;
  delayMs?: number;
  siteUrl?: string;
}

export type ScraperRunner = (
  idListing: string,
  runId: number,
  startPage?: number,
  opts?: ScraperOptions,
) => Promise<ScraperStats>;

export interface ScraperConfig {
  siteName: string;
  siteUrl: string;
  delayMs?: number;
  buildPageUrl(base: string, page: number): string;
  extract(page: Page): Promise<ExtractedCarListing[]>;
}

export interface ScraperStats {
  pagesCrawled: number;
  listingsScraped: number;
  errors: number;
  samples?: ExtractedCarListing[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageWithRetry(pg: Page, url: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await pg.goto(url, { waitUntil: "networkidle2", timeout: 35000 });
      return;
    } catch (err) {
      lastErr = err;
      Logger.warn({ attempt, url }, `Navigation attempt ${attempt} failed`);
      if (attempt < MAX_RETRIES) await delay(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}

export async function runScraper(
  config: ScraperConfig,
  id_listing: string,
  runId: number,
  startPage = 1,
  opts?: ScraperOptions,
): Promise<ScraperStats> {
  const pageDelayMs = config.delayMs ?? opts?.delayMs ?? DEFAULT_DELAY_MS;
  const maxPages = opts?.maxPages ?? 50;
  const maxListings = opts?.maxListings;

  let pageCounter = 0;
  let scrapedCounter = 0;
  let errorCounter = 0;
  let consecutiveEmpty = 0;
  let completedCycle = false;
  const savedSamples: ExtractedCarListing[] = [];

  async function persistProgress() {
    await CrawlerRunsRepository.finish(runId, {
      finishedAt: new Date().toISOString(),
      status: "running",
      pagesCrawled: pageCounter,
      listingsScraped: scrapedCounter,
      errors: errorCounter,
    });
  }

  Logger.info(`Starting crawl for ${config.siteName}...`);
  const listing = await CarrosRepository.getListingById(id_listing);

  const browser = await puppeteer.launch({ ...init_conf });
  const page: Page = await browser.newPage();
  await page.setUserAgent(user_agent);
  await page.setExtraHTTPHeaders({
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  });

  try {
    for (let pageNum = startPage; pageNum <= maxPages; pageNum++) {
      if (maxListings !== undefined && scrapedCounter >= maxListings) break;

      const pageUrl = config.buildPageUrl(config.siteUrl, pageNum);
      if (pageNum > startPage) await delay(pageDelayMs);

      try {
        Logger.info(`Navigating to page ${pageNum}: ${pageUrl}`);
        await fetchPageWithRetry(page, pageUrl);
      } catch (navErr) {
        Logger.error(
          { navErr: navErr instanceof Error ? navErr.message : String(navErr) },
          `Navigation error at page ${pageNum}, skipping.`,
        );
        errorCounter++;
        await persistProgress();
        continue;
      }

      const challenge = await detectAntiBotChallenge(page);
      if (challenge) {
        Logger.warn(
          { site: config.siteName, pageNum, challenge },
          `[${config.siteName}] Anti-bot / challenge detected on page ${pageNum}: ${challenge}`,
        );
        errorCounter++;
        await persistProgress();
        break;
      }

      let extracted: ExtractedCarListing[] = [];
      try {
        extracted = (await config.extract(page)).filter(
          (item) => typeof item.ref === "string" && item.ref.trim().length > 0,
        );

        if (maxListings !== undefined) {
          const remaining = maxListings - scrapedCounter;
          if (remaining <= 0) break;
          extracted = extracted.slice(0, remaining);
        }

        if (extracted.length === 0) {
          Logger.warn(`Page ${pageNum} - no car listings found`);
          consecutiveEmpty++;
          if (consecutiveEmpty >= EMPTY_PAGE_THRESHOLD) {
            Logger.info(
              `Stopping: ${consecutiveEmpty}+ consecutive empty pages`,
            );
            completedCycle = true;
            break;
          }
        } else {
          Logger.info(`Page ${pageNum} - found ${extracted.length} cars`);
          consecutiveEmpty = 0;
          pageCounter++;
        }
      } catch (extractErr) {
        Logger.error(
          {
            extractErr:
              extractErr instanceof Error
                ? extractErr.message
                : String(extractErr),
          },
          `Extraction error at page ${pageNum}, skipping.`,
        );
        errorCounter++;
        await persistProgress();
        continue;
      }

      for (const item of await enrichListingsWithFipe(extracted)) {
        try {
          await CarrosRepository.create({
            ref: item.ref,
            text_description: item.text_description,
            features: item.features,
            id_listing,
            images: item.images ?? [],
          });
          scrapedCounter++;
          if (maxListings !== undefined) {
            savedSamples.push(item);
          }
        } catch (err) {
          Logger.error(
            { err: err instanceof Error ? err.message : String(err), ref: item.ref },
            "Error saving car listing",
          );
          errorCounter++;
        }
      }

      await persistProgress();

      if (maxListings === undefined && pageNum >= maxPages) {
        completedCycle = true;
      }

      if (extracted.length > 0 && !completedCycle) {
        await CarrosRepository.updateListing(id_listing, {
          ...listing,
          lastPage: pageNum,
        });
      }

      if (maxListings !== undefined && scrapedCounter >= maxListings) {
        break;
      }
    }

    if (completedCycle) {
      await CarrosRepository.updateListing(id_listing, {
        ...listing,
        lastPage: 1,
      });
    }
  } catch (err) {
    Logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      `Unhandled error in ${config.siteName}`,
    );
  } finally {
    await persistProgress();
    await browser.close();
  }

  return {
    pagesCrawled: pageCounter,
    listingsScraped: scrapedCounter,
    errors: errorCounter,
    ...(maxListings !== undefined ? { samples: savedSamples } : {}),
  };
}
