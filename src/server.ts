import { createServer } from "node:http";
import { port } from "./config/env.js";
import app from "./app.js";
import { initRealtime } from "./services/realtime.service.js";

const server = createServer(app);
initRealtime(server);

server.listen(port, (): void => {
  console.log(`ChargeWatch API listening on port ${port}`);
});

server.on("error", (error: Error): void => {
  console.error(`Failed to start ChargeWatch API on port ${port}:`, error);
  process.exit(1);
});
