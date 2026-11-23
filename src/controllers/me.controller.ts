import type { Request, Response } from "express";
import { getUserById, updatePhoneNumber } from "../services/auth.service.js";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const PATCH_FIELDS = new Set<string>(["phoneNumber"]);

export async function getMe(req: Request, res: Response): Promise<void> {
  if (req.userId === undefined) {
    throw unauthorized("Authentication required.");
  }

  const user = await getUserById(req.userId);
  res.status(200).json({ user });
}

export async function patchMe(req: Request, res: Response): Promise<void> {
  if (req.userId === undefined) {
    throw unauthorized("Authentication required.");
  }

  const phoneNumber = readPhoneNumberBody(req.body);
  const user = await updatePhoneNumber(req.userId, phoneNumber);
  res.status(200).json({ user });
}

function readPhoneNumberBody(body: unknown): string {
  if (!isRecord(body)) {
    throw badRequest("Request body must be an object.");
  }

  for (const key of Object.keys(body)) {
    if (!PATCH_FIELDS.has(key)) {
      throw badRequest(`Unknown field: ${key}.`);
    }
  }

  if (
    typeof body.phoneNumber !== "string" ||
    !E164_PHONE.test(body.phoneNumber)
  ) {
    throw badRequest("phoneNumber must be in E.164 format, like +15551234567.");
  }

  return body.phoneNumber;
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
