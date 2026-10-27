import type { Request, Response } from "express";
import { loginUser, registerUser } from "../services/auth.service.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

export async function register(req: Request, res: Response): Promise<void> {
  const credentials = readCredentials(req.body);
  const result = await registerUser(credentials.email, credentials.password);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const credentials = readCredentials(req.body);
  const result = await loginUser(credentials.email, credentials.password);
  res.status(200).json(result);
}

function readCredentials(body: unknown): { email: string; password: string } {
  if (!isRecord(body)) {
    throw badRequest("Request body must be an object.");
  }

  const email = readEmail(body.email);
  const password = readPassword(body.password);
  return { email, password };
}

function readEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("email must be a valid email address.");
  }

  const email = value.trim().toLowerCase();
  if (!EMAIL.test(email)) {
    throw badRequest("email must be a valid email address.");
  }

  return email;
}

function readPassword(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < MIN_PASSWORD_LENGTH ||
    // bcrypt only uses the first 72 bytes, so the maximum is checked in bytes.
    Buffer.byteLength(value, "utf8") > MAX_PASSWORD_LENGTH
  ) {
    throw badRequest(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters and at most ${MAX_PASSWORD_LENGTH} bytes.`,
    );
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function badRequest(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 400 });
}
