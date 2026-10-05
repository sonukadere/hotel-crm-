import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "@hotel/types";

export interface CustomError extends Error {
  statusCode?: number;
  errors?: string[];
}

export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error(`[API Error] ${req.method} ${req.url} [${statusCode}]:`, err);

  const response: ApiResponse<null> = {
    success: false,
    message,
    errors: err.errors || [message],
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}
