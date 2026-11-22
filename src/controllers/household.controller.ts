import type { Request, Response } from "express";
import * as households from "../services/household.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;

const CREATE_FIELDS = new Set<string>(["name"]);
const JOIN_FIELDS = new Set<string>(["inviteCode"]);

export async function createHousehold(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const name = readCreateBody(req.body);
  const result = await households.createHousehold(userId, name);
  res.status(201).json(result);
}

export async function joinHousehold(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const inviteCode = readJoinBody(req.body);
  const result = await households.joinHousehold(userId, inviteCode);
  res.status(201).json(result);
}

export async function listHouseholds(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req);
  const result = await households.listHouseholds(userId);
  res.status(200).json({ households: result });
}

export async function getHousehold(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const id = readId(req.params.id);
  const household = await households.getHousehold(userId, id);
  res.status(200).json({ household });
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  const callerId = requireUserId(req);
  const householdId = readId(req.params.id, "id");
  const targetUserId = readId(req.params.userId, "userId");
  await households.removeMember(callerId, householdId, targetUserId);
  res.status(204).end();
}

function requireUserId(req: Request): string {
  if (req.userId === undefined) {
    throw unauthorized("Authentication required.");
  }

  return req.userId;
}

function readId(value: unknown, fieldName = "id"): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw badRequest(`${fieldName} must be a valid UUID.`);
  }

  return value.toLowerCase();
}

function readCreateBody(body: unknown): string {
  const record = readBody(body, CREATE_FIELDS);
  return readName(record.name);
}

function readJoinBody(body: unknown): string {
  const record = readBody(body, JOIN_FIELDS);
  return readInviteCode(record.inviteCode);
}

function readBody(
  body: unknown,
  allowedFields: Set<string>,
): Record<string, unknown> {
  if (!isRecord(body)) {
    throw badRequest("Request body must be an object.");
  }

  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
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

function readInviteCode(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("inviteCode must be a non-empty string.");
  }

  const inviteCode = value.trim().toUpperCase();
  if (inviteCode.length === 0) {
    throw badRequest("inviteCode must be a non-empty string.");
  }

  return inviteCode;
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
