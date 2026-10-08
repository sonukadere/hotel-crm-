import { describeConfiguration, env } from "./config/env";
import { app } from "./app";

app.listen(env.PORT, () => {
  console.log(`Indian Hotel PMS API running on ${env.API_BASE_URL}`);
  console.log(`Health check available at ${env.API_BASE_URL}/api/health`);
  // Redacted on purpose: the real values are never written to stdout.
  console.log("Configuration:", describeConfiguration());
});
