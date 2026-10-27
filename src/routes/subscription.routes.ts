import { Router } from "express";
import {
  createSubscription,
  deleteSubscription,
  getSubscription,
  getSubscriptionSummary,
  listSubscriptions,
  updateSubscription,
} from "../controllers/subscription.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Every route requires a JWT, including any route added later.
router.use(authenticate);

router.get("/", listSubscriptions);
// Registered before /:id so "summary" is not captured as an id.
router.get("/summary", getSubscriptionSummary);
router.get("/:id", getSubscription);
router.post("/", createSubscription);
router.patch("/:id", updateSubscription);
router.delete("/:id", deleteSubscription);

export default router;
