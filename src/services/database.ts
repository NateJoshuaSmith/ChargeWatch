import { databaseUrl } from "../config/env.js";
import { prisma } from "../db/prisma.js";

const CONNECTION_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

const CONNECTION_ERROR_KINDS = new Set([
  "ConnectionClosed",
  "DatabaseNotReachable",
  "SocketTimeout",
  "TlsConnectionError",
]);

export class DatabaseConnectionError extends Error {
  constructor(readonly reason: string) {
    super(
      `Could not connect to the database at ${databaseTarget(databaseUrl)}. Is it running? Try: docker compose up -d`,
    );
    this.name = "DatabaseConnectionError";
  }
}

export async function checkDatabaseConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error: unknown) {
    const reason = connectionFailureReason(error);
    if (reason !== undefined) {
      throw new DatabaseConnectionError(reason);
    }

    throw error;
  }
}

function databaseTarget(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    const port = parsed.port === "" ? "5432" : parsed.port;
    const host = parsed.hostname.includes(":")
      ? `[${parsed.hostname}]`
      : parsed.hostname;

    if (host === "") {
      return "the configured host";
    }

    return `${host}:${port}`;
  } catch {
    return "the configured host";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function connectionFailureReason(error: unknown): string | undefined {
  const code = socketCode(error, new Set());
  if (code !== undefined) {
    return code;
  }

  return adapterReason(error, new Set());
}

function socketCode(error: unknown, seen: Set<unknown>): string | undefined {
  if (!isRecord(error) || seen.has(error)) {
    return undefined;
  }

  seen.add(error);

  if (
    typeof error.code === "string" &&
    CONNECTION_ERROR_CODES.has(error.code)
  ) {
    return error.code;
  }

  const fromCause = socketCode(error.cause, seen);
  if (fromCause !== undefined) {
    return fromCause;
  }

  if (Array.isArray(error.errors)) {
    for (const item of error.errors) {
      const fromItem = socketCode(item, seen);
      if (fromItem !== undefined) {
        return fromItem;
      }
    }
  }

  if (isRecord(error.meta)) {
    return socketCode(error.meta.driverAdapterError, seen);
  }

  return undefined;
}

function adapterReason(error: unknown, seen: Set<unknown>): string | undefined {
  if (!isRecord(error) || seen.has(error)) {
    return undefined;
  }

  seen.add(error);

  if (
    isRecord(error.cause) &&
    typeof error.cause.kind === "string" &&
    CONNECTION_ERROR_KINDS.has(error.cause.kind)
  ) {
    return error.cause.kind;
  }

  if (isRecord(error.meta)) {
    const fromAdapter = adapterReason(error.meta.driverAdapterError, seen);
    if (fromAdapter !== undefined) {
      return fromAdapter;
    }
  }

  const fromCause = adapterReason(error.cause, seen);
  if (fromCause !== undefined) {
    return fromCause;
  }

  if (
    typeof error.message === "string" &&
    error.message.includes("Can't reach database server")
  ) {
    return "DatabaseNotReachable";
  }

  return undefined;
}
