import type { Request, Response } from "express";
import { BillingCycle, SubscriptionStatus } from "../generated/prisma/enums.js";
import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "../services/subscription.service.js";
import * as subscriptions from "../services/subscription.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MIN_CATEGORY_LENGTH = 1;
const MAX_CATEGORY_LENGTH = 50;
const MAX_AMOUNT_CENTS = 100000000;
const DEFAULT_CURRENCY = "USD";

const ALLOWED_FIELDS = new Set<string>([
  "name",
  "amountCents",
  "currency",
  "billingCycle",
  "nextRenewalDate",
  "category",
  "status",
]);

export async function listSubscriptions(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const result = await subscriptions.listSubscriptions(userId);
  res.status(200).json({ subscriptions: result });
}

export async function getSubscriptionSummary(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const summary = await subscriptions.getSubscriptionSummary(userId);
  res.status(200).json(summary);
}

export async function getSubscription(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const id = readId(req.params.id);
  const subscription = await subscriptions.getSubscription(userId, id);
  res.status(200).json({ subscription });
}

export async function createSubscription(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const input = readCreateBody(req.body);
  const subscription = await subscriptions.createSubscription(userId, input);
  res.status(201).json({ subscription });
}

export async function updateSubscription(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const id = readId(req.params.id);
  const input = readUpdateBody(req.body);
  const subscription = await subscriptions.updateSubscription(
    userId,
    id,
    input,
  );
  res.status(200).json({ subscription });
}

export async function deleteSubscription(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const id = readId(req.params.id);
  await subscriptions.deleteSubscription(userId, id);
  res.status(204).end();
}

function requireUserId(req: Request): string {
  if (req.userId === undefined) {
    throw unauthorized("Authentication required.");
  }

  return req.userId;
}

function readId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw badRequest("id must be a valid UUID.");
  }

  return value;
}

function readCreateBody(body: unknown): CreateSubscriptionInput {
  const record = readBody(body);

  return {
    name: readName(record.name),
    amountCents: readAmountCents(record.amountCents),
    currency:
      record.currency === undefined
        ? DEFAULT_CURRENCY
        : readCurrency(record.currency),
    billingCycle: readBillingCycle(record.billingCycle),
    nextRenewalDate: readNextRenewalDate(record.nextRenewalDate),
    ...(record.category !== undefined
      ? { category: readCategory(record.category) }
      : {}),
    ...(record.status !== undefined
      ? { status: readStatus(record.status) }
      : {}),
  };
}

function readUpdateBody(body: unknown): UpdateSubscriptionInput {
  const record = readBody(body);
  const input: UpdateSubscriptionInput = {};

  if (record.name !== undefined) {
    input.name = readName(record.name);
  }
  if (record.amountCents !== undefined) {
    input.amountCents = readAmountCents(record.amountCents);
  }
  if (record.currency !== undefined) {
    input.currency = readCurrency(record.currency);
  }
  if (record.billingCycle !== undefined) {
    input.billingCycle = readBillingCycle(record.billingCycle);
  }
  if (record.nextRenewalDate !== undefined) {
    input.nextRenewalDate = readNextRenewalDate(record.nextRenewalDate);
  }
  if (record.category !== undefined) {
    input.category = readCategory(record.category);
  }
  if (record.status !== undefined) {
    input.status = readStatus(record.status);
  }

  if (Object.keys(input).length === 0) {
    throw badRequest("Provide at least one field to update.");
  }

  return input;
}

function readBody(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw badRequest("Request body must be an object.");
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw badRequest(`Unknown field: ${key}.`);
    }
  }

  return body;
}

function readName(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("name must be a string of 1 to 100 characters.");
  }

  const name = value.trim();
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    throw badRequest("name must be a string of 1 to 100 characters.");
  }

  return name;
}

function readAmountCents(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_AMOUNT_CENTS
  ) {
    throw badRequest("amountCents must be a positive integer of cents.");
  }

  return value;
}

function readCurrency(value: unknown): string {
  if (typeof value !== "string" || !CURRENCY_CODE.test(value)) {
    throw badRequest("currency must be a 3-letter code.");
  }

  return value.toUpperCase();
}

function readBillingCycle(value: unknown): BillingCycle {
  if (!isBillingCycle(value)) {
    throw badRequest("billingCycle must be WEEKLY, MONTHLY, or YEARLY.");
  }

  return value;
}

function readNextRenewalDate(value: unknown): Date {
  if (typeof value !== "string" || !isCalendarDate(value)) {
    throw badRequest("nextRenewalDate must be a real date in YYYY-MM-DD form.");
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function readCategory(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest(
      "category must be a string of 1 to 50 characters, or null.",
    );
  }

  const category = value.trim();
  if (
    category.length < MIN_CATEGORY_LENGTH ||
    category.length > MAX_CATEGORY_LENGTH
  ) {
    throw badRequest(
      "category must be a string of 1 to 50 characters, or null.",
    );
  }

  return category;
}

function readStatus(value: unknown): SubscriptionStatus {
  if (!isSubscriptionStatus(value)) {
    throw badRequest("status must be ACTIVE, TRIAL, or CANCELED.");
  }

  return value;
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return (
    value === BillingCycle.WEEKLY ||
    value === BillingCycle.MONTHLY ||
    value === BillingCycle.YEARLY
  );
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    value === SubscriptionStatus.ACTIVE ||
    value === SubscriptionStatus.TRIAL ||
    value === SubscriptionStatus.CANCELED
  );
}

function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function unauthorized(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 401 });
}
