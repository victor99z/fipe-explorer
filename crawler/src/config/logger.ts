import pino from "pino";
import type { CrawlerLogInsert } from "../clients/db-adapter";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
    },
  },
});

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSink = (entry: CrawlerLogInsert) => void | Promise<void>;

let logSink: LogSink | null = null;
let isPersisting = false;
const pendingWrites = new Set<Promise<void>>();

export function setLogSink(sink: LogSink | null): void {
  logSink = sink;
}

export async function flushLogs(): Promise<void> {
  if (pendingWrites.size === 0) return;
  await Promise.allSettled([...pendingWrites]);
}

function dispatchToSink(
  level: LogLevel,
  objOrMsg: string | object,
  msg?: string,
  args: unknown[] = [],
): void {
  if (!logSink || isPersisting) return;

  const message =
    typeof objOrMsg === "string"
      ? msg !== undefined
        ? `${objOrMsg} ${msg}`
        : objOrMsg
      : (msg ??
        (typeof (objOrMsg as Record<string, unknown>).message === "string"
          ? String((objOrMsg as Record<string, unknown>).message)
          : JSON.stringify(objOrMsg)));

  const context: Record<string, unknown> | null =
    typeof objOrMsg === "object" && objOrMsg !== null
      ? { ...(objOrMsg as Record<string, unknown>) }
      : args.length > 0
        ? { extra: args }
        : null;

  isPersisting = true;
  try {
    const result = logSink({
      level,
      message,
      context,
      createdAt: new Date(),
    });
    if (result && typeof (result as Promise<void>).then === "function") {
      const tracked = Promise.resolve(result)
        .catch(() => {})
        .finally(() => {
          pendingWrites.delete(tracked);
        });
      pendingWrites.add(tracked);
    }
  } catch {
    // Never let log persistence errors disrupt crawler execution
  } finally {
    isPersisting = false;
  }
}

function log(
  level: LogLevel,
  objOrMsg: string | object,
  msg?: string,
  ...args: unknown[]
): void {
  if (typeof objOrMsg === "string") {
    if (msg !== undefined) {
      logger[level](
        args.length > 0 ? { extra: args } : {},
        `${objOrMsg} ${msg}`,
      );
    } else {
      logger[level](objOrMsg);
    }
  } else if (msg !== undefined) {
    logger[level](objOrMsg, msg, ...args);
  } else {
    logger[level](objOrMsg);
  }

  dispatchToSink(level, objOrMsg, msg, args);
}

export const Logger = {
  debug: (objOrMsg: string | object, msg?: string, ...args: unknown[]) =>
    log("debug", objOrMsg, msg, ...args),
  info: (objOrMsg: string | object, msg?: string, ...args: unknown[]) =>
    log("info", objOrMsg, msg, ...args),
  warn: (objOrMsg: string | object, msg?: string, ...args: unknown[]) =>
    log("warn", objOrMsg, msg, ...args),
  error: (objOrMsg: string | object, msg?: string, ...args: unknown[]) =>
    log("error", objOrMsg, msg, ...args),
};
