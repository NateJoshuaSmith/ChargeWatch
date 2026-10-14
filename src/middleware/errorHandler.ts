import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

type ErrorFields = {
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
};

function isErrorFields(err: unknown): err is ErrorFields {
  return typeof err === 'object' && err !== null;
}

function isHttpErrorStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599;
}

function resolveStatus(err: unknown): number {
  if (!isErrorFields(err)) {
    return 500;
  }

  if (isHttpErrorStatus(err.statusCode)) {
    return err.statusCode;
  }

  if (isHttpErrorStatus(err.status)) {
    return err.status;
  }

  return 500;
}

function clientErrorMessage(err: unknown): string {
  if (isErrorFields(err) && typeof err.message === 'string') {
    return err.message;
  }

  return 'Request failed';
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

  const status = resolveStatus(err);

  if (status >= 500) {
    console.error(err);
    res.status(status).json({ error: 'Internal server error' });
    return;
  }

  res.status(status).json({ error: clientErrorMessage(err) });
};
