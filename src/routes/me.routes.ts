import { Router } from "express";
import { getMe } from "../controllers/me.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.get("/", authenticate, getMe);

export default router;
