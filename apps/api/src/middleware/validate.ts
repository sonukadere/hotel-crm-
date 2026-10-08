import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

/**
 * Zod request validation.
 *
 * Schemas that feed existing services use `.passthrough()` so unknown fields
 * keep flowing to the service layer (nothing is silently dropped), while known
 * fields are type- and shape-checked before they reach business logic.
 */

function formatIssues(error: { issues: Array<{ path: (string | number | symbol)[]; message: string }> }): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(body)";
    return `${path}: ${issue.message}`;
  });
}

function reject(res: Response, issues: string[]): void {
  res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: issues,
    timestamp: new Date().toISOString(),
  });
}

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      reject(res, formatIssues(result.error));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      reject(res, formatIssues(result.error));
      return;
    }
    // Express 5 exposes a read-only query; merge validated values onto req for
    // handlers that read via `req.query` by replacing known keys.
    Object.assign(req.query as Record<string, unknown>, result.data);
    next();
  };
}
