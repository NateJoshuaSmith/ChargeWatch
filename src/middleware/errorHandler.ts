import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

type ErrorFields = {
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
};

function isErrorFields(err: unknown): err is ErrorFields {
  return typeof err === 'object' && err !== null;
}

function isFalsyStatus(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === false ||
    value === 0 ||
    value === '' ||
    (typeof value === 'number' && Number.isNaN(value))
  );
}

function resolveStatus(err: ErrorFields): number {
  const candidate = isFalsyStatus(err.statusCode) ? err.status : err.statusCode;

  if (typeof candidate !== 'number' && typeof candidate !== 'string') {
    return 500;
  }

  return Number(candidate) || 500;
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = isErrorFields(err) ? resolveStatus(err) : 500;
  const message =
    status === 500
      ? 'Internal server error'
      : isErrorFields(err) && typeof err.message === 'string'
        ? err.message
        : undefined;

  res.status(status).json({ error: message });
};
