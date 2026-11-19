import axios from "axios";
import { Logger } from "../config/logger";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

function parseValidHttpUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveFilename(parsedUrl: URL, contentType: string): string {
  const segment = parsedUrl.pathname.split("/").filter(Boolean).pop() || "image";
  if (/\.[a-z0-9]{2,5}$/i.test(segment)) {
    return segment;
  }
  const baseType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const ext = MIME_EXTENSIONS[baseType] ?? ".jpg";
  return `${segment}${ext}`;
}

export async function DownloadImageAndCreateFile(
  url: string,
): Promise<File | null> {
  const parsedUrl = parseValidHttpUrl(url);
  if (!parsedUrl) {
    Logger.warn({ url }, "Invalid or unsupported image URL skipped");
    return null;
  }

  try {
    const response = await axios.get(parsedUrl.toString(), {
      responseType: "arraybuffer",
      timeout: 15000,
    });

    const contentType =
      String(response.headers["content-type"] || "image/jpeg").split(";")[0]?.trim() ||
      "image/jpeg";
    const blob = new Blob([response.data], { type: contentType });
    const filename = resolveFilename(parsedUrl, contentType);

    return new File([blob], filename, { type: contentType });
  } catch (err) {
    Logger.warn(
      {
        url: parsedUrl.toString(),
        err: err instanceof Error ? err.message : String(err),
      },
      "Failed to download image",
    );
    return null;
  }
}
