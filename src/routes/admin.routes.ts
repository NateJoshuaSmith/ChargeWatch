import { Router } from "express";
import { getUsers } from "../controllers/admin.controller.js";
import { Role } from "../generated/prisma/enums.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/users", authenticate, requireRole(Role.ADMIN), getUsers);

export default router;
