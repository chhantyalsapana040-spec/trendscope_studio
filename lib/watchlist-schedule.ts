import { addHours } from "date-fns";
import type { TrackingInterval } from "@/types/database.types";

const HOURS: Record<TrackingInterval, number> = {
  hourly: 1,
  daily: 24,
  weekly: 24 * 7,
  monthly: 24 * 30,
};

export function computeNextCollection(from: Date, interval: TrackingInterval): Date {
  return addHours(from, HOURS[interval]);
}
