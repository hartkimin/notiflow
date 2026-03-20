"use server";

import { getSalesRepPerformance } from "@/lib/queries/dashboard-stats";

export async function getSalesRepByMonthAction(month: string) {
  return getSalesRepPerformance(month);
}
