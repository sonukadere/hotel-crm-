import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "@hotel/types";
import { env } from "../config/env";
import { redactLogMessage } from "../security/redaction";

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
  // Internal failures never expose internals (stack traces, SQL, secrets) to
  // clients in production; the detail still lands in the redacted server log.
  const expose = statusCode < 500 || !env.isProduction;
  const message = expose && err.message ? err.message : "Internal Server Error";

  console.error(
    `[API Error] ${req.method} ${req.url} [${statusCode}]:`,
    redactLogMessage(err.message || "unknown error"),
  );
  if (!env.isProduction && err.stack) {
    console.error(redactLogMessage(err.stack));
  }

  const response: ApiResponse<null> = {
    success: false,
    message,
    errors: (expose && err.errors) || [message],
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(response);
}
