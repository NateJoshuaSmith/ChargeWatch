# ChargeWatch: Agent Instructions

ChargeWatch is a subscription tracker API built with Node.js, Express 5, and TypeScript (strict), using ES modules. The owner must be able to explain every line, so keep code simple and readable.

## Language and modules

- TypeScript strict mode. Never use `any`. Use `unknown` and narrow it.
- ES modules only. Relative imports use `.js` extensions (NodeNext), even in `.ts` files.

## Architecture

- Layers: routes → controllers → services.
- Routes map URLs to controller functions and contain no logic.
- Controllers handle HTTP only: read the request, call a service, send the response.
- Services hold business logic and all calls to the database and external APIs. They never touch `req` or `res`.
- Middleware lives in `src/middleware/`.

## Errors and config

- Express 5 forwards errors from async handlers automatically. Don't wrap handlers in try/catch just to call `next(err)`.
- All errors go through `src/middleware/errorHandler.ts`. Never send stack traces or internal details to clients.
- Read environment variables only in `src/config/env.ts`, validated at startup. Other files import from config, never from `process.env`.
- Never commit secrets. Add new variables to `.env.example` without real values.

## Working rules

- Only change what the task asks for. Don't refactor unrelated code.
- Don't add dependencies without saying which one and why.
- Before finishing, run `npm run typecheck` and `npm run lint`, and fix all errors.
