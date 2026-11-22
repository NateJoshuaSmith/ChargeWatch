import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { HouseholdRole } from "../generated/prisma/enums.js";

const INVITE_CODE_BYTES = 6;
const MAX_INVITE_CODE_TRIES = 3;

export class HouseholdNotFoundError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("Household not found.");
    this.name = "HouseholdNotFoundError";
  }
}

export class InvalidInviteCodeError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("Invalid invite code.");
    this.name = "InvalidInviteCodeError";
  }
}

export class AlreadyMemberError extends Error {
  readonly statusCode = 409;

  constructor() {
    super("You are already a member of this household.");
    this.name = "AlreadyMemberError";
  }
}

export class NotHouseholdOwnerError extends Error {
  readonly statusCode = 403;

  constructor() {
    super("Only the household owner can do this.");
    this.name = "NotHouseholdOwnerError";
  }
}

export class OwnerCannotRemoveSelfError extends Error {
  readonly statusCode = 400;

  constructor() {
    super("The owner cannot remove themselves.");
    this.name = "OwnerCannotRemoveSelfError";
  }
}

export class MemberNotFoundError extends Error {
  readonly statusCode = 404;

  constructor() {
    super("Member not found.");
    this.name = "MemberNotFoundError";
  }
}

export type CreatedHousehold = {
  household: {
    id: string;
    name: string;
    inviteCode: string;
    createdAt: Date;
  };
  role: typeof HouseholdRole.OWNER;
};

export type JoinedHousehold = {
  household: {
    id: string;
    name: string;
    createdAt: Date;
  };
  role: typeof HouseholdRole.MEMBER;
};

export type HouseholdListItem = {
  id: string;
  name: string;
  createdAt: Date;
  role: HouseholdRole;
  inviteCode?: string;
};

export type HouseholdDetail = {
  id: string;
  name: string;
  createdAt: Date;
  role: HouseholdRole;
  inviteCode?: string;
  members: HouseholdMember[];
};

type HouseholdMember = {
  userId: string;
  email: string;
  role: HouseholdRole;
  joinedAt: Date;
};

export async function createHousehold(
  userId: string,
  name: string,
): Promise<CreatedHousehold> {
  for (let attempt = 1; attempt <= MAX_INVITE_CODE_TRIES; attempt++) {
    const inviteCode = generateInviteCode();

    try {
      const household = await prisma.$transaction(async (tx) => {
        const created = await tx.household.create({
          data: { name, inviteCode },
          select: {
            id: true,
            name: true,
            inviteCode: true,
            createdAt: true,
          },
        });

        await tx.membership.create({
          data: {
            userId,
            householdId: created.id,
            role: HouseholdRole.OWNER,
          },
        });

        return created;
      });

      return { household, role: HouseholdRole.OWNER };
    } catch (error: unknown) {
      if (isInviteCodeConflict(error) && attempt < MAX_INVITE_CODE_TRIES) {
        continue;
      }
      throw error;
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new Error("Failed to create household.");
}

export async function joinHousehold(
  userId: string,
  inviteCode: string,
): Promise<JoinedHousehold> {
  const household = await prisma.household.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  if (household === null) {
    throw new InvalidInviteCodeError();
  }

  try {
    await prisma.membership.create({
      data: {
        userId,
        householdId: household.id,
        role: HouseholdRole.MEMBER,
      },
    });
  } catch (error: unknown) {
    if (isMembershipUniqueConflict(error)) {
      throw new AlreadyMemberError();
    }
    throw error;
  }

  return { household, role: HouseholdRole.MEMBER };
}

export async function listHouseholds(
  userId: string,
): Promise<HouseholdListItem[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: {
      role: true,
      household: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          inviteCode: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((membership) => {
    const item: HouseholdListItem = {
      id: membership.household.id,
      name: membership.household.name,
      createdAt: membership.household.createdAt,
      role: membership.role,
    };

    if (membership.role === HouseholdRole.OWNER) {
      item.inviteCode = membership.household.inviteCode;
    }

    return item;
  });
}

export async function getHousehold(
  userId: string,
  householdId: string,
): Promise<HouseholdDetail> {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_householdId: { userId, householdId },
    },
    select: {
      role: true,
      household: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          inviteCode: true,
          memberships: {
            select: {
              role: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (membership === null) {
    throw new HouseholdNotFoundError();
  }

  const detail: HouseholdDetail = {
    id: membership.household.id,
    name: membership.household.name,
    createdAt: membership.household.createdAt,
    role: membership.role,
    members: membership.household.memberships.map((member) => ({
      userId: member.user.id,
      email: member.user.email,
      role: member.role,
      joinedAt: member.createdAt,
    })),
  };

  if (membership.role === HouseholdRole.OWNER) {
    detail.inviteCode = membership.household.inviteCode;
  }

  return detail;
}

export async function removeMember(
  callerId: string,
  householdId: string,
  targetUserId: string,
): Promise<void> {
  const callerMembership = await prisma.membership.findUnique({
    where: {
      userId_householdId: { userId: callerId, householdId },
    },
    select: { role: true },
  });

  if (callerMembership === null) {
    throw new HouseholdNotFoundError();
  }

  if (callerMembership.role !== HouseholdRole.OWNER) {
    throw new NotHouseholdOwnerError();
  }

  if (callerId === targetUserId) {
    throw new OwnerCannotRemoveSelfError();
  }

  try {
    await prisma.membership.delete({
      where: {
        userId_householdId: { userId: targetUserId, householdId },
      },
    });
  } catch (error: unknown) {
    if (isRecordNotFound(error)) {
      throw new MemberNotFoundError();
    }
    throw error;
  }
}

function generateInviteCode(): string {
  return randomBytes(INVITE_CODE_BYTES).toString("hex").toUpperCase();
}

function isInviteCodeConflict(error: unknown): boolean {
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
    return target.includes("invite_code") || target.includes("inviteCode");
  }

  return (
    Array.isArray(target) &&
    target.some((field) => field === "invite_code" || field === "inviteCode")
  );
}

function isMembershipUniqueConflict(error: unknown): boolean {
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
    return (
      target.includes("user_id") ||
      target.includes("userId") ||
      target.includes("household_id") ||
      target.includes("householdId")
    );
  }

  return (
    Array.isArray(target) &&
    target.some(
      (field) =>
        field === "user_id" ||
        field === "userId" ||
        field === "household_id" ||
        field === "householdId",
    )
  );
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
