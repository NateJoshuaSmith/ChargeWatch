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
