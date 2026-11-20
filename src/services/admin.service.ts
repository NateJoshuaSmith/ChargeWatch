import { prisma } from "../db/prisma.js";

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  homeCurrency: true,
  createdAt: true,
} as const;

export async function listUsers() {
  return prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    orderBy: { createdAt: "asc" },
  });
}
