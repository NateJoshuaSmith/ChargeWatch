import { prisma } from "../db/prisma.js";
import { ReminderStatus } from "../generated/prisma/enums.js";
import { SubscriptionNotFoundError } from "./subscription.service.js";
import { ReminderSendError, sendSms } from "./twilio.service.js";

const CHANNEL_SMS = "sms";
const SEND_FAILED_ERROR = "send_failed";

export class PhoneNumberRequiredError extends Error {
  readonly statusCode = 400;

  constructor() {
    super("Add a phone number with PATCH /api/me first.");
    this.name = "PhoneNumberRequiredError";
  }
}

export async function sendRenewalReminder(
  userId: string,
  subscriptionId: string,
) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    select: {
      id: true,
      name: true,
      amountCents: true,
      currency: true,
      nextRenewalDate: true,
    },
  });

  if (subscription === null) {
    throw new SubscriptionNotFoundError();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true },
  });

  if (user === null || user.phoneNumber === null) {
    throw new PhoneNumberRequiredError();
  }

  const renewalDate = formatRenewalDate(subscription.nextRenewalDate);
  const amount = (subscription.amountCents / 100).toFixed(2);
  const body = `ChargeWatch reminder: ${subscription.name} renews on ${renewalDate} for ${amount} ${subscription.currency}.`;

  let message: { sid: string; status: string };

  try {
    message = await sendSms(user.phoneNumber, body);
  } catch (error: unknown) {
    if (error instanceof ReminderSendError) {
      await upsertReminder(subscription.id, subscription.nextRenewalDate, {
        status: ReminderStatus.FAILED,
        channel: CHANNEL_SMS,
        sentAt: null,
        error: SEND_FAILED_ERROR,
      });
      throw error;
    }
    throw error;
  }

  const reminder = await upsertReminder(
    subscription.id,
    subscription.nextRenewalDate,
    {
      status: ReminderStatus.SENT,
      channel: CHANNEL_SMS,
      sentAt: new Date(),
      error: null,
    },
  );

  return {
    reminder: {
      id: reminder.id,
      subscriptionId: reminder.subscriptionId,
      renewalDate: formatRenewalDate(reminder.renewalDate),
      status: reminder.status,
      channel: reminder.channel,
      sentAt: reminder.sentAt,
    },
    message,
  };
}

async function upsertReminder(
  subscriptionId: string,
  renewalDate: Date,
  data: {
    status: ReminderStatus;
    channel: string;
    sentAt: Date | null;
    error: string | null;
  },
) {
  return prisma.reminder.upsert({
    where: {
      subscriptionId_renewalDate: {
        subscriptionId,
        renewalDate,
      },
    },
    create: {
      subscriptionId,
      renewalDate,
      status: data.status,
      channel: data.channel,
      sentAt: data.sentAt,
      error: data.error,
    },
    update: {
      status: data.status,
      channel: data.channel,
      sentAt: data.sentAt,
      error: data.error,
    },
    select: {
      id: true,
      subscriptionId: true,
      renewalDate: true,
      status: true,
      channel: true,
      sentAt: true,
    },
  });
}

function formatRenewalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
