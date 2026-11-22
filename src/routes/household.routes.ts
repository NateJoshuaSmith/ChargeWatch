import { Router } from "express";
import {
  createHousehold,
  getHousehold,
  joinHousehold,
  listHouseholds,
  removeMember,
} from "../controllers/household.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Every route requires a JWT, including any route added later.
router.use(authenticate);

router.get("/", listHouseholds);
// Registered before /:id so "join" is not captured as an id.
router.post("/join", joinHousehold);
router.get("/:id", getHousehold);
router.post("/", createHousehold);
router.delete("/:id/members/:userId", removeMember);

export default router;
