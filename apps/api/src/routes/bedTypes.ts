import { Router } from "express";
import { getBedTypes, createBedType } from "../services/roomService";
import { ApiResponse } from "@hotel/types";

export const bedTypesRouter = Router();

// GET /bed-types
bedTypesRouter.get("/", async (_req, res, next) => {
  try {
    const beds = await getBedTypes();
    const response: ApiResponse<typeof beds> = {
      success: true,
      data: beds,
      timestamp: new Date().toISOString(),
    };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /bed-types
bedTypesRouter.post("/", async (req, res, next) => {
  try {
    const created = await createBedType(req.body);
    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
