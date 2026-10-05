import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { healthRouter } from "./routes/health";
import { roomsRouter } from "./routes/rooms";
import { roomTypesRouter } from "./routes/roomTypes";
import { ratePlansRouter } from "./routes/ratePlans";
import { floorsRouter } from "./routes/floors";
import { bedTypesRouter } from "./routes/bedTypes";
import { reservationsRouter } from "./routes/reservations";
import { foliosRouter } from "./routes/folios";
import { paymentsRouter } from "./routes/payments";
import { crmRouter } from "./routes/crm";
import { loyaltyRouter } from "./routes/loyalty";
import { nightAuditRouter } from "./routes/nightAudit";
import { reportsRouter } from "./routes/reports";
import { auditLogsRouter } from "./routes/auditLogs";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// API Endpoints - with /api prefix
app.use("/api/health", healthRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/room-types", roomTypesRouter);
app.use("/api/rate-plans", ratePlansRouter);
app.use("/api/floors", floorsRouter);
app.use("/api/bed-types", bedTypesRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/folios", foliosRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/crm", crmRouter);
app.use("/api/loyalty", loyaltyRouter);
app.use("/api/night-audit", nightAuditRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit-logs", auditLogsRouter);

// Direct root aliases (to satisfy GET /rooms, GET /room-types, GET /rate-plans, etc.)
app.use("/rooms", roomsRouter);
app.use("/room-types", roomTypesRouter);
app.use("/rate-plans", ratePlansRouter);
app.use("/night-audit", nightAuditRouter);

// Centralized error handler
app.use(errorHandler);
