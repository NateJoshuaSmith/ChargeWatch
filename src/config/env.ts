import dotenv from "dotenv";

dotenv.config({ quiet: true });

const DEFAULT_PORT = 3000;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_FRANKFURTER_BASE_URL = "https://api.frankfurter.dev";

function parsePort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort.trim() === "") {
    return DEFAULT_PORT;
  }

  const trimmed = rawPort.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid PORT "${rawPort}". PORT must be an integer from ${MIN_PORT} to ${MAX_PORT}.`,
    );
  }

  const port = Number(trimmed);

  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `Invalid PORT "${rawPort}". PORT must be an integer from ${MIN_PORT} to ${MAX_PORT}.`,
    );
  }

  return port;
}

function parseDatabaseUrl(rawUrl: string | undefined): string {
  if (rawUrl === undefined || rawUrl.trim() === "") {
    throw new Error(
      "Invalid DATABASE_URL. DATABASE_URL must be a non-empty Postgres connection string.",
    );
  }

  return rawUrl.trim();
}

function parseFrankfurterBaseUrl(rawUrl: string | undefined): string {
  if (rawUrl === undefined || rawUrl.trim() === "") {
    return DEFAULT_FRANKFURTER_BASE_URL;
  }

  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid FRANKFURTER_BASE_URL "${rawUrl}". It must be an http or https URL.`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Invalid FRANKFURTER_BASE_URL "${rawUrl}". It must be an http or https URL.`,
    );
  }

  return trimmed;
}

function parseJwtSecret(rawSecret: string | undefined): string {
  if (rawSecret === undefined || rawSecret.trim() === "") {
    throw new Error(
      "Invalid JWT_SECRET. JWT_SECRET is required and must be at least 32 characters.",
    );
  }

  const trimmed = rawSecret.trim();

  if (trimmed.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `Invalid JWT_SECRET. JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters.`,
    );
  }

  return trimmed;
}

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  trialTemplate: string | null;
};

function parseTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() ?? "";
  const trialTemplateRaw = process.env.TWILIO_TRIAL_TEMPLATE?.trim() ?? "";
  const trialTemplate = trialTemplateRaw === "" ? null : trialTemplateRaw;

  if (accountSid === "" || authToken === "" || fromNumber === "") {
    return null;
  }

  return { accountSid, authToken, fromNumber, trialTemplate };
}

export const port = parsePort(process.env.PORT);
export const databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
export const jwtSecret = parseJwtSecret(process.env.JWT_SECRET);
export const frankfurterBaseUrl = parseFrankfurterBaseUrl(
  process.env.FRANKFURTER_BASE_URL,
);
export const twilioConfig = parseTwilioConfig();
