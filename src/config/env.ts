import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const DEFAULT_PORT = 3000;
const MIN_PORT = 1;
const MAX_PORT = 65535;

function parsePort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort.trim() === '') {
    return DEFAULT_PORT;
  }

  const trimmed = rawPort.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid PORT "${rawPort}". PORT must be an integer from ${MIN_PORT} to ${MAX_PORT}.`);
  }

  const port = Number(trimmed);

  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`Invalid PORT "${rawPort}". PORT must be an integer from ${MIN_PORT} to ${MAX_PORT}.`);
  }

  return port;
}

export const port = parsePort(process.env.PORT);
