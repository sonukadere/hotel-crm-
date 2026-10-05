import { GST_CONFIG, SAC_CODES, INDIAN_STATE_CODES } from "@hotel/config";

export { GST_CONFIG, SAC_CODES, INDIAN_STATE_CODES };

export interface GSTConfigOverride {
  thresholdINR?: number;
  rateBelowThreshold?: number;
  rateAboveThreshold?: number;
  defaultServiceRate?: number;
}
