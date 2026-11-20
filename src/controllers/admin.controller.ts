import type { Request, Response } from "express";
import { listUsers } from "../services/admin.service.js";

export async function getUsers(_req: Request, res: Response): Promise<void> {
  const users = await listUsers();
  res.status(200).json({ users });
}
