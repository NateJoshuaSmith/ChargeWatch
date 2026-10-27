import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/auth.service.js";

const BEARER_PREFIX = "Bearer ";

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header("authorization");
  const token = readBearerToken(header);
  req.userId = verifyToken(token);
  next();
}

function readBearerToken(header: string | undefined): string {
  if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
    throw malformedAuthorization();
  }

  const token = header.slice(BEARER_PREFIX.length);
  if (token === "" || token.includes(" ")) {
    throw malformedAuthorization();
  }

  return token;
}

function malformedAuthorization(): Error & { statusCode: number } {
  return Object.assign(
    new Error("Missing or malformed Authorization header."),
    {
      statusCode: 401,
    },
  );
}
