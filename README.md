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

## CI

GitHub Actions runs the CI workflow on pull requests to `main` and on pushes to `main`. It checks lint, types, formatting, and that the project builds. A new commit on the same branch cancels the run already in progress.
