import type { Request, Response } from "express";
import { getUserById } from "../services/auth.service.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  if (req.userId === undefined) {
    throw unauthorized("Authentication required.");
  }

  const user = await getUserById(req.userId);
  res.status(200).json({ user });
}

function unauthorized(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 401 });
}
