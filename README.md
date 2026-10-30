# ChargeWatch

ChargeWatch links your bank accounts, automatically finds your subscriptions, and reminds you before anything renews or a free trial starts charging.

## API

Node.js and Express 5. Copy `.env.example` to `.env` if you want to change the port (default `3000`).

```bash
npm install
npm run dev
```

`npm start` runs the server without reloading on file changes.

`GET /health` returns:

```json
{ "status": "ok" }
```

## Local database

PostgreSQL for local development. Start it in the background:

```bash
docker compose up -d
```

`docker compose ps` shows whether the database is running.

`docker compose down` stops the database and removes the container. Your data stays in the volume.

`docker compose down -v` deletes all local data.

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
