import express from "express";
import healthRoutes from "./routes/health.routes.js";
import exchangeRateRoutes from "./routes/exchangeRate.routes.js";
import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Render puts one proxy in front of the app. Trust exactly that hop so req.ip is
// the real client IP, which the rate limiter needs.
app.set("trust proxy", 1);

app.use(express.json());
app.use("/health", healthRoutes);
app.use("/api/exchange-rates", exchangeRateRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
