import { Router } from "express";
import { ApiResponse } from "@hotel/types";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const response: ApiResponse<{
    status: string;
    service: string;
    environment: string;
    uptimeSeconds: number;
  }> = {
    success: true,
    data: {
      status: "healthy",
      service: "Indian Hotel PMS & CRM API",
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
    },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});
