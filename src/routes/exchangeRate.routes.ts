import { Router } from "express";
import { getExchangeRates } from "../controllers/exchangeRate.controller.js";

const router = Router();

router.get("/", getExchangeRates);

export default router;
