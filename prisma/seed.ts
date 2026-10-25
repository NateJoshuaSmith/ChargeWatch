import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/config/env.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  BillingCycle,
  Role,
  SubscriptionStatus,
} from "../src/generated/prisma/enums.js";

const PASSWORD_HASH = "seed-placeholder-not-a-real-hash";

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

async function seedUser(user: SeedUser): Promise<string> {
  const saved = await prisma.user.upsert({
    where: { email: user.email },
    update: {},
    create: {
      email: user.email,
      passwordHash: PASSWORD_HASH,
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

async function main(): Promise<void> {
  for (const user of users) {
    const userId = await seedUser(user);
    const subscriptions = subscriptionsByEmail[user.email] ?? [];

    for (const subscription of subscriptions) {
      await seedSubscription(userId, subscription);
    }
  }

  console.log("Seeded 2 users and 6 subscriptions.");
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
