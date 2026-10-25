import type { Request, Response } from "express";
import { getLatestExchangeRates } from "../services/exchangeRate.service.js";

const CURRENCY_CODE = /^[A-Za-z]{3}$/;

export async function getExchangeRates(
  req: Request,
  res: Response,
): Promise<void> {
  const base = parseBase(req.query.base);
  const symbols = parseSymbols(req.query.symbols);
  const rates = await getLatestExchangeRates({ base, symbols });
  res.status(200).json(rates);
}

function parseBase(value: unknown): string {
  if (value === undefined) {
    return "USD";
  }

  if (typeof value !== "string" || !CURRENCY_CODE.test(value)) {
    throw badRequest("base must be a 3-letter currency code.");
  }

  return value.toUpperCase();
}

function parseSymbols(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (typeof value !== "string") {
    throw badRequest(
      "symbols must be a comma-separated list of 3-letter currency codes.",
    );
  }

  const symbols = value
    .split(",")
    .map((symbol) => symbol.trim())
    .filter((symbol) => symbol !== "");

  if (
    symbols.length === 0 ||
    symbols.some((symbol) => !CURRENCY_CODE.test(symbol))
  ) {
    throw badRequest(
      "symbols must be a comma-separated list of 3-letter currency codes.",
    );
  }

  return symbols.map((symbol) => symbol.toUpperCase());
}

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}
