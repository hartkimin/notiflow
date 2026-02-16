"use server";

import { markKpisReported } from "@/lib/queries/reports";
import { revalidatePath } from "next/cache";

export async function markReportedAction(id: number, referenceNumber: string) {
  await markKpisReported(id, { reference_number: referenceNumber });
  revalidatePath("/kpis");
  revalidatePath("/");
}
