import { Router } from "express";
import {
  createSubscription,
  deleteSubscription,
  getSubscription,
  getSubscriptionSummary,
  listSubscriptions,
  remindSubscription,
  updateSubscription,
} from "../controllers/subscription.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { reminderLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Every route requires a JWT, including any route added later.
router.use(authenticate);

router.get("/", listSubscriptions);
// Registered before /:id so "summary" is not captured as an id.
router.get("/summary", getSubscriptionSummary);
router.get("/:id", getSubscription);
router.post("/", createSubscription);
router.post("/:id/remind", reminderLimiter, remindSubscription);
router.patch("/:id", updateSubscription);
router.delete("/:id", deleteSubscription);

export default router;
