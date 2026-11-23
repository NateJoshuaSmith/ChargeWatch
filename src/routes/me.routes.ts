import { Router } from "express";
import { getMe, patchMe } from "../controllers/me.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.get("/", authenticate, getMe);
router.patch("/", authenticate, patchMe);

export default router;
