import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { createLawsuit, getLawsuitById } from "../controllers/lawsuit.controller";

const router = Router();

router.post('/', asyncHandler(createLawsuit));
router.get('/:id', asyncHandler(getLawsuitById));

export default router;
