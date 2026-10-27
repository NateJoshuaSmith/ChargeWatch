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
- Only services import the Prisma client from `src/db/prisma.ts`.
- Money is stored in integer cents with a currency code.
- Middleware lives in `src/middleware/`.

## Errors and config

- Express 5 forwards errors from async handlers automatically. Don't wrap handlers in try/catch just to call `next(err)`.
- All errors go through `src/middleware/errorHandler.ts`. Never send stack traces or internal details to clients.
- Never commit secrets. Add new variables to `.env.example` without real values.
- App code reads environment variables only through `src/config/env.ts`, validated at startup. Tool config files like `prisma7.config.ts` may read `process.env` directly.

## Working rules

- Only change what the task asks for. Don't refactor unrelated code.
- Don't add dependencies without saying which one and why.
- Never run git commands that change history or the remote: no commit, push, merge, rebase, or reset. The owner reviews and commits all changes.
- Never run destructive commands without asking first: no `prisma migrate reset`, `docker compose down -v`, dropping tables, or deleting files outside the task. If Prisma asks to reset the database, stop and ask the owner.

## Database

- Prisma schema style: uuid ids (`@default(uuid()) @db.Uuid`), camelCase fields with snake_case `@map`, plural snake_case table names with `@@map`, `createdAt`/`updatedAt` on every model, enums mapped to snake_case.
- Currency codes are `String @db.Char(3)`. Exchange rates use `Decimal`, never `Float`.
- Change the schema only through a new migration: `npx prisma migrate dev --name <what_changed>`. Never edit a migration that has already been applied.
- Enforce rules like "no duplicates" with database constraints (`@unique`, `@@unique`), not only with checks in code.
- The seed script must be safe to run more than once.

## Finishing a task

- Run `npm run typecheck`, `npm run lint`, and `npm run format:check`, and fix all errors.
- End with a short summary for the owner: files changed, what each change does, and any design decision they should be able to explain.
