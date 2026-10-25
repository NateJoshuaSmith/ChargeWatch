import express from "express";
import healthRoutes from "./routes/health.routes.js";
import exchangeRateRoutes from "./routes/exchangeRate.routes.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(express.json());
app.use("/health", healthRoutes);
app.use("/api/exchange-rates", exchangeRateRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
