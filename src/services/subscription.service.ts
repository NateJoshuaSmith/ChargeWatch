import { prisma } from "../db/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  BillingCycle,
  SubscriptionSource,
  SubscriptionStatus,
} from "../generated/prisma/enums.js";

// Yearly cents are summed per group, then divided by 12 and rounded once.
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
  monthlyTotals: MonthlyTotal[];
  byCategory: CategoryTotal[];
  upcomingRenewals: UpcomingRenewal[];
};

type MonthlyTotal = {
  currency: string;
  amountCents: number;
};

type CategoryTotal = {
  category: string;
  currency: string;
  monthlyAmountCents: number;
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

  const [rows, upcoming] = await Promise.all([
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

  return {
    monthlyTotals: buildMonthlyTotals(rows),
    byCategory: buildCategoryTotals(rows),
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

function buildMonthlyTotals(rows: AmountRow[]): MonthlyTotal[] {
  const yearlyByCurrency = new Map<string, number>();

  for (const row of rows) {
    const current = yearlyByCurrency.get(row.currency) ?? 0;
    yearlyByCurrency.set(row.currency, current + yearlyCents(row));
  }

  return [...yearlyByCurrency.entries()]
    .map(([currency, totalYearlyCents]) => ({
      currency,
      amountCents: monthlyAmountCents(totalYearlyCents),
    }))
    .sort((left, right) => compareCurrency(left.currency, right.currency));
}

function buildCategoryTotals(rows: AmountRow[]): CategoryTotal[] {
  const yearlyByCategory = new Map<
    string,
    { category: string; currency: string; totalYearlyCents: number }
  >();

  for (const row of rows) {
    const category = row.category ?? UNCATEGORIZED;
    // Currency is always 3 characters, so the key can't be ambiguous.
    const key = `${row.currency}:${category}`;
    const current = yearlyByCategory.get(key);
    yearlyByCategory.set(key, {
      category,
      currency: row.currency,
      totalYearlyCents: (current?.totalYearlyCents ?? 0) + yearlyCents(row),
    });
  }

  return [...yearlyByCategory.values()]
    .map((group) => ({
      category: group.category,
      currency: group.currency,
      monthlyAmountCents: monthlyAmountCents(group.totalYearlyCents),
    }))
    .sort(compareCategoryTotals);
}

function yearlyCents(row: AmountRow): number {
  return row.amountCents * PAYMENTS_PER_YEAR[row.billingCycle];
}

function monthlyAmountCents(totalYearlyCents: number): number {
  return Math.round(totalYearlyCents / 12);
}

function compareCategoryTotals(
  left: CategoryTotal,
  right: CategoryTotal,
): number {
  const byCurrency = compareCurrency(left.currency, right.currency);
  if (byCurrency !== 0) {
    return byCurrency;
  }
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
