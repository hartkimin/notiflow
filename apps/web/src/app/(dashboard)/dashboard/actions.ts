"use server";

import { getSalesRepPerformance, getHospitalRanking } from "@/lib/queries/dashboard-stats";

export async function getSalesRepByMonthAction(month: string) {
  return getSalesRepPerformance(month);
}

export async function getHospitalRankByMonthAction(month: string) {
  return getHospitalRanking(10, month);
}
