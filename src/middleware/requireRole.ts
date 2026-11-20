import type { NextFunction, Request, Response } from "express";
import { Role } from "../generated/prisma/enums.js";
import { getUserRole } from "../services/auth.service.js";

export function requireRole(role: Role) {
  return async function requireRoleMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (req.userId === undefined) {
      throw unauthorized("Authentication required.");
    }

    const userRole = await getUserRole(req.userId);
    if (userRole === null) {
      throw unauthorized("Authentication required.");
    }

    if (userRole !== role) {
      throw forbidden("You do not have permission to do this.");
    }

    next();
  };
}

function unauthorized(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 401 });
}

function forbidden(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 403 });
}
