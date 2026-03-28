import express from "express";
import { resetTestData, seedTestData } from "../controllers/test.controller.js";

const router = express.Router();

router.post("/reset", resetTestData);
router.post("/seed", seedTestData);

export default router;
