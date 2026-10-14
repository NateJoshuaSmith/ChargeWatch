import { port } from './config/env.js';
import app from './app.js';

app.listen(port, () => {
  console.log(`ChargeWatch API listening on port ${port}`);
});
