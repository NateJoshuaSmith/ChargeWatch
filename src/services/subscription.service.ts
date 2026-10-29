import { prisma } from "../db/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  BillingCycle,
  SubscriptionSource,
  SubscriptionStatus,
} from "../generated/prisma/enums.js";
import { getUserById } from "./auth.service.js";
import {
  ExchangeRateUnavailableError,
  getConversionRates,
  type ConversionRate,
} from "./exchangeRate.service.js";

// Amounts are converted to the home currency, summed per category, then divided by 12 and rounded once.
const PAYMENTS_PER_YEAR: Record<BillingCycle, number> = {
  WEEKLY: 52,
  MONTHLY: 12,
  YEARLY: 1,
};

const COUNTED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
];

const RENEWAL_WINDOW_DAYS = 30;
const UNCATEGORIZED = "Uncategorized";

const SUBSCRIPTION_SELECT = {
  id: true,
  name: true,
  amountCents: true,
  currency: true,
  billingCycle: true,
  nextRenewalDate: true,
  category: true,
  status: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicSubscription = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: string;
  category: string | null;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSubscriptionInput = {
  name: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: Date;
  category?: string | null;
  status?: SubscriptionStatus;
};

export type UpdateSubscriptionInput = {
  name?: string;
  amountCents?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  nextRenewalDate?: Date;
  category?: string | null;
  status?: SubscriptionStatus;
};

export type SubscriptionSummary = {
  homeCurrency: string;
  monthlyTotalCents: number;
  byCategory: CategoryTotal[];
  exchangeRates: Record<string, UsedExchangeRate>;
  upcomingRenewals: UpcomingRenewal[];
};

type CategoryTotal = {
  category: string;
  monthlyAmountCents: number;
};

type UsedExchangeRate = {
  rate: string;
  date: string;
  source: "live" | "cache";
};

type UpcomingRenewal = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  nextRenewalDate: string;
};

type SubscriptionRow = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: Date;
  category: string | null;
  status: SubscriptionStatus;
  source: SubscriptionSource;
  createdAt: Date;
  updatedAt: Date;
};

type AmountRow = {
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  category: string | null;
};

export class SubscriptionNotFoundError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("Subscription not found.");
    this.name = "SubscriptionNotFoundError";
  }
}

export async function listSubscriptions(
  userId: string,
): Promise<PublicSubscription[]> {
  const rows = await prisma.subscription.findMany({
    where: { userId },
    select: SUBSCRIPTION_SELECT,
    orderBy: [{ nextRenewalDate: "asc" }, { name: "asc" }],
  });

  return rows.map(toPublicSubscription);
}

export async function getSubscriptionSummary(
  userId: string,
): Promise<SubscriptionSummary> {
  const window = utcRenewalWindow(new Date());
  const counted = { userId, status: { in: COUNTED_STATUSES } };

  const [user, rows, upcoming] = await Promise.all([
    getUserById(userId),
    prisma.subscription.findMany({
      where: counted,
      select: {
        amountCents: true,
        currency: true,
        billingCycle: true,
        category: true,
      },
    }),
    prisma.subscription.findMany({
      where: {
        ...counted,
        nextRenewalDate: { gte: window.start, lte: window.end },
      },
      select: {
        id: true,
        name: true,
        amountCents: true,
        currency: true,
        nextRenewalDate: true,
      },
      orderBy: { nextRenewalDate: "asc" },
    }),
  ]);

  const homeCurrency = user.homeCurrency;
  const quotes = quotesToConvert(rows, homeCurrency);
  const rates = await getConversionRates(homeCurrency, quotes);
  const byCategory = buildCategoryTotals(rows, homeCurrency, rates);

  return {
    homeCurrency,
    monthlyTotalCents: buildMonthlyTotal(byCategory),
    byCategory,
    exchangeRates: usedExchangeRates(quotes, rates),
    upcomingRenewals: upcoming.map((row) => ({
      id: row.id,
      name: row.name,
      amountCents: row.amountCents,
      currency: row.currency,
      nextRenewalDate: formatRenewalDate(row.nextRenewalDate),
    })),
  };
}

export async function getSubscription(
  userId: string,
  id: string,
): Promise<PublicSubscription> {
  const row = await prisma.subscription.findFirst({
    where: { id, userId },
    select: SUBSCRIPTION_SELECT,
  });

  if (row === null) {
    throw new SubscriptionNotFoundError();
  }

  return toPublicSubscription(row);
}

export async function createSubscription(
  userId: string,
  input: CreateSubscriptionInput,
): Promise<PublicSubscription> {
  const row = await prisma.subscription.create({
    data: {
      userId,
      name: input.name,
      amountCents: input.amountCents,
      currency: input.currency,
      billingCycle: input.billingCycle,
      nextRenewalDate: input.nextRenewalDate,
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    select: SUBSCRIPTION_SELECT,
  });

  return toPublicSubscription(row);
}

export async function updateSubscription(
  userId: string,
  id: string,
  input: UpdateSubscriptionInput,
): Promise<PublicSubscription> {
  try {
    const row = await prisma.subscription.update({
      where: { id, userId },
      data: toUpdateData(input),
      select: SUBSCRIPTION_SELECT,
    });
    return toPublicSubscription(row);
  } catch (error: unknown) {
    if (isRecordNotFound(error)) {
      throw new SubscriptionNotFoundError();
    }
    throw error;
  }
}

export async function deleteSubscription(
  userId: string,
  id: string,
): Promise<void> {
  try {
    await prisma.subscription.delete({
      where: { id, userId },
    });
  } catch (error: unknown) {
    if (isRecordNotFound(error)) {
      throw new SubscriptionNotFoundError();
    }
    throw error;
  }
}

function toPublicSubscription(row: SubscriptionRow): PublicSubscription {
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amountCents,
    currency: row.currency,
    billingCycle: row.billingCycle,
    nextRenewalDate: formatRenewalDate(row.nextRenewalDate),
    category: row.category,
    status: row.status,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatRenewalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUpdateData(
  input: UpdateSubscriptionInput,
): Prisma.SubscriptionUpdateInput {
  const data: Prisma.SubscriptionUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.amountCents !== undefined) {
    data.amountCents = input.amountCents;
  }
  if (input.currency !== undefined) {
    data.currency = input.currency;
  }
  if (input.billingCycle !== undefined) {
    data.billingCycle = input.billingCycle;
  }
  if (input.nextRenewalDate !== undefined) {
    data.nextRenewalDate = input.nextRenewalDate;
  }
  if (input.category !== undefined) {
    data.category = input.category;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }

  return data;
}

// The total is the sum of the rounded category amounts, so they always add up.
function buildMonthlyTotal(categories: CategoryTotal[]): number {
  let total = 0;
  for (const category of categories) {
    total += category.monthlyAmountCents;
  }
  return total;
}

function buildCategoryTotals(
  rows: AmountRow[],
  homeCurrency: string,
  rates: Map<string, ConversionRate>,
): CategoryTotal[] {
  const yearlyByCategory = new Map<string, Prisma.Decimal>();

  for (const row of rows) {
    const category = row.category ?? UNCATEGORIZED;
    const current = yearlyByCategory.get(category) ?? new Prisma.Decimal(0);
    yearlyByCategory.set(
      category,
      current.plus(homeYearlyCents(row, homeCurrency, rates)),
    );
  }

  return [...yearlyByCategory.entries()]
    .map(([category, total]) => ({
      category,
      monthlyAmountCents: total
        .div(12)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
        .toNumber(),
    }))
    .sort(compareCategoryTotals);
}

function homeYearlyCents(
  row: AmountRow,
  homeCurrency: string,
  rates: Map<string, ConversionRate>,
): Prisma.Decimal {
  const yearly = new Prisma.Decimal(yearlyCents(row));
  if (row.currency === homeCurrency) {
    return yearly;
  }

  const conversion = rates.get(row.currency);
  if (conversion === undefined) {
    throw new ExchangeRateUnavailableError();
  }

  return yearly.div(conversion.rate);
}

function quotesToConvert(rows: AmountRow[], homeCurrency: string): string[] {
  const quotes = new Set<string>();
  for (const row of rows) {
    if (row.currency !== homeCurrency) {
      quotes.add(row.currency);
    }
  }
  return [...quotes].sort(compareCurrency);
}

function usedExchangeRates(
  quotes: string[],
  rates: Map<string, ConversionRate>,
): Record<string, UsedExchangeRate> {
  const exchangeRates: Record<string, UsedExchangeRate> = {};

  for (const quote of quotes) {
    const conversion = rates.get(quote);
    if (conversion === undefined) {
      throw new ExchangeRateUnavailableError();
    }
    exchangeRates[quote] = {
      rate: conversion.rate.toString(),
      date: conversion.date,
      source: conversion.source,
    };
  }

  return exchangeRates;
}

function yearlyCents(row: AmountRow): number {
  return row.amountCents * PAYMENTS_PER_YEAR[row.billingCycle];
}

function compareCategoryTotals(
  left: CategoryTotal,
  right: CategoryTotal,
): number {
  if (left.monthlyAmountCents !== right.monthlyAmountCents) {
    return right.monthlyAmountCents - left.monthlyAmountCents;
  }
  return compareCurrency(left.category, right.category);
}

function compareCurrency(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function utcRenewalWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + RENEWAL_WINDOW_DAYS);
  return { start, end };
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
