import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { databaseUrl } from "../src/config/env.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  BillingCycle,
  HouseholdRole,
  Role,
  SubscriptionStatus,
} from "../src/generated/prisma/enums.js";

// Local development only.
const SEED_PASSWORD = "chargewatch-dev-password";
// Must match BCRYPT_COST in src/services/auth.service.ts.
const BCRYPT_COST = 12;
const HOUSEHOLD_NAME = "Smith Household";
const HOUSEHOLD_INVITE_CODE = "SEED-HOUSE";

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

type SeedUser = {
  email: string;
  role: Role;
};

type SeedSubscription = {
  name: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: string;
  category: string | null;
  status: SubscriptionStatus;
};

const users: SeedUser[] = [
  { email: "admin@example.com", role: Role.ADMIN },
  { email: "user@example.com", role: Role.USER },
];

const subscriptionsByEmail: Record<string, SeedSubscription[]> = {
  "admin@example.com": [
    {
      name: "Netflix",
      amountCents: 1599,
      currency: "USD",
      billingCycle: BillingCycle.MONTHLY,
      nextRenewalDate: "2026-11-15T12:00:00.000Z",
      category: "Streaming",
      status: SubscriptionStatus.ACTIVE,
    },
    {
      name: "Figma",
      amountCents: 14400,
      currency: "EUR",
      billingCycle: BillingCycle.YEARLY,
      nextRenewalDate: "2026-12-01T12:00:00.000Z",
      category: "Software",
      status: SubscriptionStatus.TRIAL,
    },
    {
      name: "The Guardian",
      amountCents: 499,
      currency: "GBP",
      billingCycle: BillingCycle.MONTHLY,
      nextRenewalDate: "2026-11-02T12:00:00.000Z",
      category: "News",
      status: SubscriptionStatus.CANCELED,
    },
  ],
  "user@example.com": [
    {
      name: "Spotify",
      amountCents: 1199,
      currency: "USD",
      billingCycle: BillingCycle.MONTHLY,
      nextRenewalDate: "2026-11-08T12:00:00.000Z",
      category: "Streaming",
      status: SubscriptionStatus.ACTIVE,
    },
    {
      name: "iCloud+",
      amountCents: 299,
      currency: "EUR",
      billingCycle: BillingCycle.MONTHLY,
      nextRenewalDate: "2026-11-20T12:00:00.000Z",
      category: "Storage",
      status: SubscriptionStatus.ACTIVE,
    },
    {
      name: "Local gym",
      amountCents: 800,
      currency: "GBP",
      billingCycle: BillingCycle.WEEKLY,
      nextRenewalDate: "2026-11-03T12:00:00.000Z",
      category: "Health",
      status: SubscriptionStatus.TRIAL,
    },
  ],
};

async function seedUser(user: SeedUser, passwordHash: string): Promise<string> {
  const saved = await prisma.user.upsert({
    where: { email: user.email },
    update: { passwordHash },
    create: {
      email: user.email,
      passwordHash,
      role: user.role,
    },
  });

  return saved.id;
}

async function seedSubscription(
  userId: string,
  subscription: SeedSubscription,
): Promise<void> {
  const existing = await prisma.subscription.findFirst({
    where: { userId, name: subscription.name },
  });

  const data = {
    amountCents: subscription.amountCents,
    currency: subscription.currency,
    billingCycle: subscription.billingCycle,
    nextRenewalDate: subscription.nextRenewalDate,
    category: subscription.category,
    status: subscription.status,
  };

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.subscription.create({
    data: {
      userId,
      name: subscription.name,
      ...data,
    },
  });
}

async function seedMembership(
  userId: string,
  householdId: string,
  role: HouseholdRole,
): Promise<void> {
  await prisma.membership.upsert({
    where: {
      userId_householdId: { userId, householdId },
    },
    update: {},
    create: { userId, householdId, role },
  });
}

async function seedHousehold(adminId: string, memberId: string): Promise<void> {
  const household = await prisma.household.upsert({
    where: { inviteCode: HOUSEHOLD_INVITE_CODE },
    update: {},
    create: {
      name: HOUSEHOLD_NAME,
      inviteCode: HOUSEHOLD_INVITE_CODE,
    },
  });

  await seedMembership(adminId, household.id, HouseholdRole.OWNER);
  await seedMembership(memberId, household.id, HouseholdRole.MEMBER);
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_COST);
  const userIds = new Map<string, string>();

  for (const user of users) {
    const userId = await seedUser(user, passwordHash);
    userIds.set(user.email, userId);
    const subscriptions = subscriptionsByEmail[user.email] ?? [];

    for (const subscription of subscriptions) {
      await seedSubscription(userId, subscription);
    }
  }

  const adminId = userIds.get("admin@example.com");
  const memberId = userIds.get("user@example.com");
  if (adminId === undefined || memberId === undefined) {
    throw new Error("Seed users were not created.");
  }

  await seedHousehold(adminId, memberId);

  console.log("Seeded 2 users, 6 subscriptions, and 1 household.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
