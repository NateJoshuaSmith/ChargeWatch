import rateLimit from "express-rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 10;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_LIMIT = 5;

export class TooManyRequestsError extends Error {
  readonly statusCode = 429;

  constructor() {
    super("Too many attempts. Try again later.");
    this.name = "TooManyRequestsError";
  }
}

export const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_LIMIT,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new TooManyRequestsError()),
});

export const registerLimiter = rateLimit({
  windowMs: REGISTER_WINDOW_MS,
  limit: REGISTER_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new TooManyRequestsError()),
});
