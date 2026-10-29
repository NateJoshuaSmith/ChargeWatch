import { frankfurterBaseUrl } from "../config/env.js";

const REQUEST_TIMEOUT_MS = 5000;
const CURRENCY_CODE = /^[A-Za-z]{3}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type ExchangeRates = {
  base: string;
  rates: Record<string, { rate: number; date: string }>;
  source: "frankfurter";
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
