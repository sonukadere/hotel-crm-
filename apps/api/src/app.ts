import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { healthRouter } from "./routes/health";
import { roomsRouter } from "./routes/rooms";
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

// API Endpoints for all PMS Modules
app.use("/api/health", healthRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/folios", foliosRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/crm", crmRouter);
app.use("/api/loyalty", loyaltyRouter);
app.use("/api/night-audit", nightAuditRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/audit-logs", auditLogsRouter);

// Centralized error handler
app.use(errorHandler);
