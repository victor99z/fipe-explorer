import "dotenv/config";
import { existsSync } from "fs";

function resolveBrowserExecutablePath(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv) return fromEnv;

  const candidates = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return undefined;
}

const headlessEnv = process.env.PUPPETEER_HEADLESS?.trim().toLowerCase();
const headless = headlessEnv === "false" ? false : true;

export const user_agent =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const init_conf = {
  headless,
  executablePath: resolveBrowserExecutablePath(),
  defaultViewport: {
    width: 1366,
    height: 900,
  },
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--lang=pt-BR,pt",
  ],
};
