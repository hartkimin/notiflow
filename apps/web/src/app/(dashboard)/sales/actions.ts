"use server";

import { getSalesRepDetail, getHospitalDetail, getOrderDetail } from "@/lib/queries/sales-stats";

export async function getSalesRepDetailAction(month: string) {
  return getSalesRepDetail(month);
}

export async function getHospitalDetailAction(month: string) {
  return getHospitalDetail(month);
}

export async function getOrderDetailAction(month: string) {
  return getOrderDetail(month);
}
