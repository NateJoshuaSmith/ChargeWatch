import { frankfurterBaseUrl } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

const REQUEST_TIMEOUT_MS = 5000;
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CURRENCY_CODE = /^[A-Za-z]{3}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type ExchangeRates = {
  base: string;
  rates: Record<string, { rate: number; date: string }>;
  source: "frankfurter";
};

export type ConversionRate = {
  rate: Prisma.Decimal; // units of `quote` per 1 unit of `base`
  date: string; // YYYY-MM-DD, Frankfurter's date for this pair
  source: "live" | "cache";
};

type StoredRate = {
  quote: string;
  rate: Prisma.Decimal;
  date: Date;
  updatedAt: Date;
};

export class ExchangeRateUnavailableError extends Error {
  readonly statusCode = 502;

  constructor(cause?: unknown) {
    super(
      "Could not fetch exchange rates. Try again later.",
      cause === undefined ? undefined : { cause },
    );
    this.name = "ExchangeRateUnavailableError";
  }
}

export class UnknownCurrencyError extends Error {
  readonly statusCode = 400;

  constructor() {
    super("Unknown currency code.");
    this.name = "UnknownCurrencyError";
  }
}

type RateQuery = {
  base: string;
  symbols: string[];
};

type FrankfurterRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

export async function getLatestExchangeRates(
  query: RateQuery,
): Promise<ExchangeRates> {
  const url = new URL("/v2/rates", `${frankfurterBaseUrl}/`);
  url.searchParams.set("base", query.base);

  if (query.symbols.length > 0) {
    url.searchParams.set("quotes", query.symbols.join(","));
  }

  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw new ExchangeRateUnavailableError(error);
  }

  if (response.status === 422) {
    throw new UnknownCurrencyError();
  }

  if (!response.ok) {
    throw new ExchangeRateUnavailableError(
      new Error(`Frankfurter responded with status ${response.status}`),
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new ExchangeRateUnavailableError(error);
  }

  const rows = parseRates(body);
  if (rows === undefined) {
    throw new ExchangeRateUnavailableError(
      new Error("Frankfurter returned an unexpected response."),
    );
  }

  return toExchangeRates(query.base, rows);
}

export async function getConversionRates(
  base: string,
  quotes: string[],
): Promise<Map<string, ConversionRate>> {
  if (quotes.length === 0) {
    return new Map();
  }

  const cached = await prisma.exchangeRate.findMany({
    where: { base, quote: { in: quotes } },
    orderBy: [{ quote: "asc" }, { date: "desc" }],
    distinct: ["quote"],
  });

  const now = new Date();
  if (isFreshCache(cached, quotes, now)) {
    return toRateMap(cached, "cache");
  }

  let live: ExchangeRates;
  try {
    live = await getLatestExchangeRates({ base, symbols: quotes });
  } catch (error: unknown) {
    if (!(error instanceof ExchangeRateUnavailableError)) {
      throw error;
    }

    console.warn(
      "Frankfurter unavailable, using cached exchange rates.",
      error,
    );
    if (hasEveryQuote(cached, quotes)) {
      return toRateMap(cached, "cache");
    }
    throw error;
  }

  const saved = await saveLiveRates(base, live.rates);
  if (!hasEveryQuote(saved, quotes)) {
    throw new ExchangeRateUnavailableError();
  }
  return toRateMap(saved, "live");
}

function isFreshCache(
  rows: readonly StoredRate[],
  quotes: readonly string[],
  now: Date,
): boolean {
  if (!hasEveryQuote(rows, quotes)) {
    return false;
  }

  const cutoff = now.getTime() - CACHE_MAX_AGE_MS;
  return rows.every((row) => row.updatedAt.getTime() > cutoff);
}

function hasEveryQuote(
  rows: readonly { quote: string }[],
  quotes: readonly string[],
): boolean {
  const found = new Set(rows.map((row) => row.quote));
  return quotes.every((quote) => found.has(quote));
}

function toRateMap(
  rows: readonly StoredRate[],
  source: ConversionRate["source"],
): Map<string, ConversionRate> {
  const rates = new Map<string, ConversionRate>();
  for (const row of rows) {
    rates.set(row.quote, toConversionRate(row, source));
  }
  return rates;
}

function toConversionRate(
  row: StoredRate,
  source: ConversionRate["source"],
): ConversionRate {
  return {
    rate: row.rate,
    date: row.date.toISOString().slice(0, 10),
    source,
  };
}

async function saveLiveRates(
  base: string,
  rates: ExchangeRates["rates"],
): Promise<StoredRate[]> {
  const entries = Object.entries(rates);
  return prisma.$transaction(
    entries.map(([quote, entry]) =>
      prisma.exchangeRate.upsert({
        where: {
          base_quote_date: {
            base,
            quote,
            date: new Date(entry.date),
          },
        },
        create: {
          base,
          quote,
          rate: new Prisma.Decimal(String(entry.rate)),
          date: new Date(entry.date),
        },
        update: {
          rate: new Prisma.Decimal(String(entry.rate)),
        },
      }),
    ),
  );
}

function parseRates(body: unknown): FrankfurterRate[] | undefined {
  if (!Array.isArray(body) || body.length === 0) {
    return undefined;
  }

  const rows: FrankfurterRate[] = [];

  for (const item of body) {
    const row = parseRate(item);
    if (row === undefined) {
      return undefined;
    }
    rows.push(row);
  }

  return rows;
}

function parseRate(value: unknown): FrankfurterRate | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const date = record.date;
  const base = record.base;
  const quote = record.quote;
  const rate = record.rate;

  if (
    typeof date !== "string" ||
    !DATE_ONLY.test(date) ||
    typeof base !== "string" ||
    !CURRENCY_CODE.test(base) ||
    typeof quote !== "string" ||
    !CURRENCY_CODE.test(quote) ||
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return undefined;
  }

  return {
    date,
    base: base.toUpperCase(),
    quote: quote.toUpperCase(),
    rate,
  };
}

function toExchangeRates(base: string, rows: FrankfurterRate[]): ExchangeRates {
  const rates: Record<string, { rate: number; date: string }> = {};

  for (const row of rows) {
    rates[row.quote] = { rate: row.rate, date: row.date };
  }

  return {
    base,
    rates,
    source: "frankfurter",
  };
}
