import dotenv from "dotenv";
import path from "path";

// Load root and local .env files
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { app } from "./app";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🏨 Indian Hotel PMS API running on http://localhost:${PORT}`);
  console.log(`⚡ Health check available at http://localhost:${PORT}/api/health`);
});
