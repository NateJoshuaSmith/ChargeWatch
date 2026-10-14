import { port } from './config/env.js';
import app from './app.js';

app.listen(port, (error?: Error): void => {
  if (error) {
    console.error(`Failed to start ChargeWatch API on port ${port}:`, error);
    process.exit(1);
  }

  console.log(`ChargeWatch API listening on port ${port}`);
});
