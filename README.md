# ChargeWatch

ChargeWatch is a subscription and free-trial tracker API. Users track subscriptions in any currency, see a monthly total in their home currency, and share plans with a household that gets live updates.

Live API: https://chargewatch.onrender.com (free plan, the first request after idle can take about a minute). Live demo page: https://chargewatch.onrender.com/realtime-demo.html

## Features

- Auth: register, login, JWT
- Subscriptions: CRUD and monthly summary
- Currency conversion with cached rates
- Households with invite codes
- Shared subscriptions
- Real-time updates with Socket.IO
- Role-based access control at two levels (app and household)
- Rate-limited login and register

## Tech stack

Node.js 24, Express 5, TypeScript (strict, ES modules), PostgreSQL, Prisma 7, Socket.IO, bcryptjs, jsonwebtoken, Docker Compose for local Postgres, GitHub Actions CI, Render plus Neon for deployment.

## APIs used

| Kind           | API                                 | Notes                                               |
| -------------- | ----------------------------------- | --------------------------------------------------- |
| Public API     | Frankfurter exchange rates (no key) | Used for currency conversion and cached in Postgres |
| Private API    | ChargeWatch API                     | Protected by JWT                                    |
| Additional API | Twilio WhatsApp reminders           | Planned (see Known limitations)                     |

## Architecture

Routes map URLs. Middleware handles auth and roles. Controllers handle HTTP only. Services hold business logic and are the only layer that uses Prisma. Errors go through one error handler that never returns stack traces. Environment variables are validated at startup in `src/config/env.ts`.

## Auth and RBAC

- JWT bearer token with only the user id
- Passwords hashed with bcryptjs
- Generic login error so emails can't be enumerated
- App roles `USER` and `ADMIN`: `requireRole` loads the role from the database on every request, so a token can't fake a role and changes apply immediately; admins are promoted directly in the database, never through the API
- Household roles `OWNER` and `MEMBER`: only the owner sees the invite code, removes members and deletes shared subscriptions; non-members get 404 so they can't tell a household exists
- Ownership checks in every query prevent reading other users' data by guessing ids

## Real-time

- The client connects to Socket.IO with `{ auth: { token } }`
- It emits `household:join` with `{ householdId }` and gets an ack
- Membership is checked before joining the room
- Events are `subscription:created`, `subscription:deleted`, `member:joined`, `member:removed`; removed members are dropped from the room immediately

Use the demo page: paste a JWT from `/api/auth/login` and a household id, click Connect, then create or delete shared subscriptions in another window.

## Data model

- `users` — accounts with email, password hash, role, and home currency
- `subscriptions` — integer cents plus a 3-letter currency code; optional `householdId`
- `households` — name and unique invite code
- `memberships` — role `OWNER` or `MEMBER`; unique per user and household
- `exchange_rates` — Decimal rates, cached
- `reminders`, `plaid_items`, and `accounts` — reserved for planned features
- All ids are UUIDs

## Endpoints

| Method | Path                                                | Auth        | Description                    |
| ------ | --------------------------------------------------- | ----------- | ------------------------------ |
| GET    | `/health`                                           | No          | Health check                   |
| GET    | `/api/exchange-rates`                               | No          | Latest exchange rates          |
| POST   | `/api/auth/register`                                | No          | Create an account              |
| POST   | `/api/auth/login`                                   | No          | Log in and get a JWT           |
| GET    | `/api/me`                                           | JWT         | Current user                   |
| GET    | `/api/subscriptions`                                | JWT         | List own subscriptions         |
| POST   | `/api/subscriptions`                                | JWT         | Create a subscription          |
| GET    | `/api/subscriptions/summary`                        | JWT         | Monthly total in home currency |
| GET    | `/api/subscriptions/:id`                            | JWT         | Get one subscription           |
| PATCH  | `/api/subscriptions/:id`                            | JWT         | Update a subscription          |
| DELETE | `/api/subscriptions/:id`                            | JWT         | Delete a subscription          |
| GET    | `/api/admin/users`                                  | JWT + ADMIN | List all users                 |
| POST   | `/api/households`                                   | JWT         | Create a household             |
| POST   | `/api/households/join`                              | JWT         | Join with an invite code       |
| GET    | `/api/households`                                   | JWT         | List households you belong to  |
| GET    | `/api/households/:id`                               | JWT         | Get one household              |
| DELETE | `/api/households/:id/members/:userId`               | JWT + OWNER | Remove a member                |
| GET    | `/api/households/:id/subscriptions`                 | JWT         | List shared subscriptions      |
| DELETE | `/api/households/:id/subscriptions/:subscriptionId` | JWT + OWNER | Delete a shared subscription   |

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in values
3. `docker compose up -d`
4. `npx prisma migrate dev`
5. `npm run db:seed`
6. `npm run dev`

`docker compose ps` shows whether the database is running.

`docker compose down` stops the database and removes the container. Your data stays in the volume.

`docker compose down -v` deletes all local data.

`npm start` runs the server without reloading on file changes.

## Environment variables

| Variable               | Required     | Purpose                                                   |
| ---------------------- | ------------ | --------------------------------------------------------- |
| `PORT`                 | Optional     | Port the API listens on (default 3000)                    |
| `POSTGRES_USER`        | Local Docker | Postgres role for the local database                      |
| `POSTGRES_PASSWORD`    | Local Docker | Password for that local Postgres role                     |
| `POSTGRES_DB`          | Local Docker | Local database name                                       |
| `DATABASE_URL`         | Required     | Postgres connection string                                |
| `FRANKFURTER_BASE_URL` | Optional     | Frankfurter API origin                                    |
| `JWT_SECRET`           | Required     | Secret used to sign login tokens (at least 32 characters) |

## Seed accounts (local only)

`npm run db:seed` creates two accounts you can log in with locally:

- `admin@example.com` — `chargewatch-dev-password`
- `user@example.com` — `chargewatch-dev-password`

The seed must never be run against a deployed database.

## CI

GitHub Actions runs the CI workflow on pull requests to `main` and on pushes to `main`. It checks lint, types, formatting, and that the project builds. A new commit on the same branch cancels the run already in progress.

## Deploy (Render)

Build command:

```bash
npm ci --include=dev && npm run build && npx prisma migrate deploy
```

`--include=dev` installs prisma and typescript, which the build needs even if `NODE_ENV` is production.

`postinstall` runs `prisma generate`.

`migrate deploy` applies only the committed migrations and never resets data.

Migrations run before Render switches to the new version, and if the new version fails its health check, the old version keeps running on the migrated database. So keep migrations backward compatible: add new columns or tables first, and remove old ones in a later deploy. (Render's pre-deploy command has the same ordering and is paid-only, so the build command is used.)

Start command: `npm start`

Health check path: `/health`

Environment variables:

- `DATABASE_URL`: the production Postgres connection string
- `JWT_SECRET`: a new random value of at least 32 characters, never the local one
- `FRANKFURTER_BASE_URL`: optional

Render sets `PORT` itself. `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are for local Docker only.

The free plan sleeps after 15 minutes idle, so the first request can take about a minute.

Don't seed production. The seed accounts are for local use only.

## Known limitations

- Twilio reminders and Plaid bank sync are planned but not built
- Render's free plan sleeps after 15 minutes idle
- There is no API to change a user's role or a password
- Crypto tokens with 3-letter codes can appear in the exchange rate list
- Real-time uses one server instance (Postgres LISTEN/NOTIFY would be needed to scale to several)
