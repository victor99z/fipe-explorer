import { getAdapter } from "./clients/db";
import { Logger } from "./config/logger";
import { SCRAPER_REGISTRY } from "./pages";
import type { ExtractedCarListing } from "./pages/base-scraper";
import { CarrosRepository } from "./repository/carros-repository";
import { CrawlerRunsRepository } from "./repository/crawler-runs-repository";

interface CliOptions {
  pageStartOverride: number | null;
  shouldDelete: boolean;
  cleanOlx: boolean;
  seedOnly: boolean;
  sampleLimit: number | null;
  allSites: boolean;
  siteFilter: string | null;
  daemon: boolean;
}

function parsePositiveIntArg(argv: string[], prefix: string): number | null {
  const arg = argv.find((a) => a.startsWith(prefix));
  if (!arg) return null;
  const parsed = parseInt(arg.slice(prefix.length) || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCliArgs(argv: string[]): CliOptions {
  const pageStartOverride = parsePositiveIntArg(argv, "--page-start=");
  const sampleLimit =
    parsePositiveIntArg(argv, "--sample=") ??
    parsePositiveIntArg(argv, "--limit=");

  const deleteArg = argv.find((arg) => arg.startsWith("--delete="));
  const shouldDelete = deleteArg ? deleteArg.split("=")[1] === "true" : false;
  const cleanOlx = argv.includes("--clean-olx");
  const seedOnly = argv.includes("--seed-only");
  const allSites = argv.includes("--all-sites");
  const daemon = argv.includes("--daemon");
  const siteArg = argv.find((arg) => arg.startsWith("--site="));
  const siteFilter = siteArg ? siteArg.slice("--site=".length).trim() : null;

  return {
    pageStartOverride,
    shouldDelete,
    cleanOlx,
    seedOnly,
    sampleLimit,
    allSites,
    siteFilter,
    daemon,
  };
}

function resolveIntervalMs(): number {
  const raw = parseFloat(process.env.CRAWLER_INTERVAL_HOURS ?? "6");
  const hours = Number.isFinite(raw) && raw >= 0.1 ? raw : 6;
  return Math.round(hours * 3_600_000);
}

function hasPocketBaseCredentials(): boolean {
  const dbType = (process.env.DB_TYPE ?? "pocketbase").toLowerCase();
  if (dbType !== "pocketbase") return true;
  return Boolean(
    process.env.POCKETBASE_TOKEN?.trim() ||
      (process.env.POCKETBASE_EMAIL?.trim() &&
        process.env.POCKETBASE_PASSWORD?.trim()),
  );
}

async function runSingleCrawlCycle(options: CliOptions): Promise<void> {
  const {
    pageStartOverride,
    shouldDelete,
    cleanOlx,
    seedOnly,
    sampleLimit,
    allSites,
    siteFilter,
  } = options;

  await getAdapter().ensureSchema();
  await CrawlerRunsRepository.init();

  Logger.info(
    {
      pageStartOverride,
      shouldDelete,
      cleanOlx,
      seedOnly,
      sampleLimit,
      allSites,
      siteFilter,
      daemon: options.daemon,
    },
    "Car crawler initialized",
  );

  if (seedOnly) {
    const listings = await CarrosRepository.getAllListings();
    Logger.info(
      { count: listings.length, sites: listings.map((l) => l.name) },
      "Schema & seed ensured",
    );
    await CrawlerRunsRepository.flushLogs();
    return;
  }

  if (shouldDelete) {
    const res = await CarrosRepository.deleteAllInBatch();
    Logger.info(res, "Deleted all listings from carros_temp");
    await CrawlerRunsRepository.flushLogs();
    return;
  }

  if (cleanOlx) {
    const res = await CarrosRepository.deleteInvalidOlxInBatch();
    Logger.info(res, "Deleted invalid OLX listings from carros_temp");
    await CrawlerRunsRepository.flushLogs();
    return;
  }

  try {
    const cleaned = await CarrosRepository.deleteInvalidOlxInBatch();
    if (cleaned.deleted > 0) {
      Logger.info(cleaned, "Cleaned invalid OLX listings from carros_temp");
    }
  } catch (err) {
    Logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to clean invalid OLX listings before crawl",
    );
  }

  const listings = await CarrosRepository.getAllListings();
  const sampleResults: Record<string, ExtractedCarListing[]> = {};

  for (const item of listings) {
    if (siteFilter && item.name !== siteFilter) continue;
    if (!siteFilter && !allSites && !item.active) continue;

    const runner = SCRAPER_REGISTRY[item.name];
    if (!runner) {
      Logger.warn({ site: item.name }, `No scraper registered for ${item.name}`);
      continue;
    }

    const maxPages = item.maxPages ?? 50;
    const resumedPage =
      item.lastPage >= 1 && item.lastPage < maxPages ? item.lastPage : 1;
    const startPage = pageStartOverride ?? resumedPage;
    let runId: { id: number } | null = null;

    try {
      runId = await CrawlerRunsRepository.create(item.name);
      Logger.info(
        { site: item.name, runId: runId.id, startPage },
        `[${item.name}] Starting car crawler (run #${runId.id})...`,
      );

      const stats = await runner(item.id, runId.id, startPage, {
        maxPages: sampleLimit ? startPage : maxPages,
        maxListings: sampleLimit ?? undefined,
        delayMs: item.delayMs,
        siteUrl: item.url ?? undefined,
      });

      if (sampleLimit !== null && stats.samples) {
        sampleResults[item.name] = stats.samples;
      }

      await CrawlerRunsRepository.finish(runId.id, {
        finishedAt: new Date().toISOString(),
        status: "completed",
        pagesCrawled: stats.pagesCrawled,
        listingsScraped: stats.listingsScraped,
        errors: stats.errors,
      });
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      Logger.error({ site: item.name, err: errStr }, `[${item.name}] Failed`);

      if (runId) {
        await CrawlerRunsRepository.finish(runId.id, {
          finishedAt: new Date().toISOString(),
          status: "error",
          errorMsg: errStr,
        });
      }
    }
  }

  if (sampleLimit !== null) {
    console.log("\n=== SAMPLE RESULTS ===");
    console.log(JSON.stringify(sampleResults, null, 2));
    await CrawlerRunsRepository.flushLogs();
    process.exit(0);
  }

  Logger.info("Car crawl complete.");
  await CrawlerRunsRepository.flushLogs();
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));

  if (!options.daemon) {
    await runSingleCrawlCycle(options);
    return;
  }

  let shuttingDown = false;
  const handleSignal = () => {
    shuttingDown = true;
    Logger.info("Crawler daemon shutting down...");
    process.exit(0);
  };
  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  const intervalMs = resolveIntervalMs();
  const intervalHours = (intervalMs / 3_600_000).toFixed(1);
  Logger.info({ intervalHours }, "Car crawler daemon started");

  while (!shuttingDown) {
    if (!hasPocketBaseCredentials()) {
      Logger.warn(
        "Crawler daemon waiting: configure POCKETBASE_EMAIL/POCKETBASE_PASSWORD or POCKETBASE_TOKEN",
      );
    } else {
      try {
        await runSingleCrawlCycle(options);
      } catch (err) {
        Logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          "Crawler daemon cycle failed",
        );
      }
    }

    if (shuttingDown) break;
    Logger.info({ intervalHours }, `Sleeping ${intervalHours}h until next crawl`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main();
