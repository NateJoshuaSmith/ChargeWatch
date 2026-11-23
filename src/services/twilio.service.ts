import { twilioConfig } from "../config/env.js";

const REQUEST_TIMEOUT_MS = 5000;

export class RemindersNotConfiguredError extends Error {
  readonly statusCode = 503;

  constructor() {
    super("Reminders are not configured.");
    this.name = "RemindersNotConfiguredError";
  }
}

export class ReminderSendError extends Error {
  readonly statusCode = 502;

  constructor(cause?: unknown) {
    super(
      "Could not send the reminder.",
      cause === undefined ? undefined : { cause },
    );
    this.name = "ReminderSendError";
  }
}

export async function sendSms(
  to: string,
  body: string,
): Promise<{ sid: string; status: string }> {
  if (twilioConfig === null) {
    throw new RemindersNotConfiguredError();
  }

  const { accountSid, authToken, fromNumber, trialTemplate } = twilioConfig;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64",
  );
  const form = new URLSearchParams({
    From: fromNumber,
    To: to,
    Body: trialTemplate ?? body,
  });

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw new ReminderSendError(error);
  }

  if (!response.ok) {
    throw new ReminderSendError(
      new Error(`Twilio responded with status ${response.status}`),
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error: unknown) {
    throw new ReminderSendError(error);
  }

  if (
    !isRecord(payload) ||
    typeof payload.sid !== "string" ||
    typeof payload.status !== "string"
  ) {
    throw new ReminderSendError(
      new Error("Twilio response missing sid or status."),
    );
  }

  return { sid: payload.sid, status: payload.status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
