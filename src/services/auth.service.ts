import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

const BCRYPT_COST = 12;
// Hashed once at startup so unknown emails take the same time as wrong passwords.
const DUMMY_HASH = await bcrypt.hash("dummy-password-for-timing", BCRYPT_COST);
const TOKEN_TTL = "1h";
const JWT_ALGORITHM = "HS256";

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  homeCurrency: true,
  createdAt: true,
} as const;

export class EmailAlreadyRegisteredError extends Error {
  readonly statusCode = 409;

  constructor() {
    super("Email is already registered.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidTokenError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Invalid or expired token.");
    this.name = "InvalidTokenError";
  }
}

export class UserNotFoundError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}

export async function registerUser(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: PUBLIC_USER_SELECT,
    });
    return { user, token: signToken(user.id) };
  } catch (error: unknown) {
    if (isEmailUniqueConflict(error)) {
      throw new EmailAlreadyRegisteredError();
    }
    throw error;
  }
}

export async function loginUser(email: string, password: string) {
  const stored = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true, ...PUBLIC_USER_SELECT },
  });

  const passwordMatches = await bcrypt.compare(
    password,
    stored === null ? DUMMY_HASH : stored.passwordHash,
  );

  if (stored === null || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  return {
    user: {
      id: stored.id,
      email: stored.email,
      role: stored.role,
      homeCurrency: stored.homeCurrency,
      createdAt: stored.createdAt,
    },
    token: signToken(stored.id),
  };
}

export function verifyToken(token: string): string {
  let decoded: unknown;

  try {
    decoded = jwt.verify(token, jwtSecret, { algorithms: [JWT_ALGORITHM] });
  } catch {
    throw new InvalidTokenError();
  }

  if (
    !isRecord(decoded) ||
    typeof decoded.sub !== "string" ||
    decoded.sub === ""
  ) {
    throw new InvalidTokenError();
  }

  return decoded.sub;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: PUBLIC_USER_SELECT,
  });

  if (user === null) {
    throw new UserNotFoundError();
  }

  return user;
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, jwtSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: TOKEN_TTL,
  });
}

function isEmailUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (target === undefined) {
    return true;
  }

  if (typeof target === "string") {
    return target.includes("email");
  }

  return Array.isArray(target) && target.some((field) => field === "email");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
