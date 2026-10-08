import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { auditContextMiddleware } from "./middleware/auditContext";
import { authenticate } from "./middleware/auth";
import { globalRateLimit, publicRateLimit } from "./middleware/rateLimit";
import { responseSanitizerMiddleware } from "./security/sanitize";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { publicBookingRouter } from "./routes/publicBooking";
import { roomsRouter } from "./routes/rooms";
import { roomTypesRouter } from "./routes/roomTypes";
import { ratePlansRouter } from "./routes/ratePlans";
import { floorsRouter } from "./routes/floors";
import { bedTypesRouter } from "./routes/bedTypes";
import { reservationsRouter } from "./routes/reservations";
import { foliosRouter } from "./routes/folios";
import { paymentsRouter, paymentsWebhookRouter } from "./routes/payments";
import { crmRouter } from "./routes/crm";
import { loyaltyRouter } from "./routes/loyalty";
import { nightAuditRouter } from "./routes/nightAudit";
import { reportsRouter } from "./routes/reports";
import { auditLogsRouter } from "./routes/auditLogs";
import { frontDeskRouter } from "./routes/frontDesk";
import { adminDashboardRouter } from "./routes/adminDashboard";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

// Behind a load balancer / reverse proxy set TRUST_PROXY=true so `req.ip`
// (and therefore audit log IPs and rate limit keys) reflects the client.
app.set("trust proxy", env.TRUST_PROXY ? 1 : false);

// Security headers
app.use(helmet());

// Explicit origin allow-list - credentials are never accepted from "*".
app.use(
  cors({
    origin: [env.CRM_URL, env.PUBLIC_WEB_URL],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }),
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req: express.Request, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isDevelopment ? "dev" : "combined"));

// Every request runs inside an audit context (IP + user agent + actor).
app.use(auditContextMiddleware);
// No response may carry a raw identity number, payment signature or password.
app.use(responseSanitizerMiddleware);
app.use(globalRateLimit);

// ---------------------------------------------------------------------------
// Public endpoints - guest facing, no session, rate limited
// ---------------------------------------------------------------------------
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

// Guest booking funnel used by the public website. These endpoints only expose
// published inventory and never guest or payment data.
app.use("/api/public", publicRateLimit, publicBookingRouter);
app.use("/public", publicRateLimit, publicBookingRouter);

// Razorpay calls this endpoint server-to-server; it is authenticated by the
// gateway's HMAC signature, not by a user session, so it stays public.
app.use("/api/payments/webhook", paymentsWebhookRouter);
app.use("/payments/webhook", paymentsWebhookRouter);

// ---------------------------------------------------------------------------
// Protected endpoints - authentication required, authorization enforced per
// route via `requirePermission(...)`.
// ---------------------------------------------------------------------------
app.use("/api/rooms", authenticate, roomsRouter);
app.use("/api/room-types", authenticate, roomTypesRouter);
app.use("/api/rate-plans", authenticate, ratePlansRouter);
app.use("/api/floors", authenticate, floorsRouter);
app.use("/api/bed-types", authenticate, bedTypesRouter);
app.use("/api/reservations", authenticate, reservationsRouter);
app.use("/api/folios", authenticate, foliosRouter);
app.use("/api/payments", authenticate, paymentsRouter);
app.use("/api/crm", authenticate, crmRouter);
app.use("/api/loyalty", authenticate, loyaltyRouter);
app.use("/api/night-audit", authenticate, nightAuditRouter);
app.use("/api/reports", authenticate, reportsRouter);
app.use("/api/audit-logs", authenticate, auditLogsRouter);
app.use("/api/front-desk", authenticate, frontDeskRouter);
app.use("/api/admin-dashboard", authenticate, adminDashboardRouter);

// Direct root aliases (to satisfy GET /rooms, POST /payments/create-order, etc.)
app.use("/admin-dashboard", authenticate, adminDashboardRouter);
app.use("/rooms", authenticate, roomsRouter);
app.use("/room-types", authenticate, roomTypesRouter);
app.use("/rate-plans", authenticate, ratePlansRouter);
app.use("/floors", authenticate, floorsRouter);
app.use("/bed-types", authenticate, bedTypesRouter);
app.use("/night-audit", authenticate, nightAuditRouter);
app.use("/front-desk", authenticate, frontDeskRouter);
app.use("/reservations", authenticate, reservationsRouter);
app.use("/folios", authenticate, foliosRouter);
app.use("/payments", authenticate, paymentsRouter);

// Centralized error handler
app.use(errorHandler);
