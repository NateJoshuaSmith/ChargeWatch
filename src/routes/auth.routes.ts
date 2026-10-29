import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

export default router;
