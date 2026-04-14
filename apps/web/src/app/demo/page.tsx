import { createAdminClient } from "@/lib/supabase/admin";
import DemoClient from "./demo-client";

async function getDemoData() {
  const admin = createAdminClient();

  // Find the demo org
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("is_demo", true)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!org) return null;

  // Pull summary stats from the demo org
  const [ordersRes, hospitalsRes, suppliersRes] = await Promise.all([
    admin.from("orders").select("id, status, total_amount, order_date, hospitals(name)").eq("organization_id", org.id).order("order_date", { ascending: false }).limit(8),
    admin.from("hospitals").select("id, name, hospital_type").eq("organization_id", org.id).eq("is_active", true).order("name").limit(6),
    admin.from("suppliers").select("id, name").eq("organization_id", org.id).eq("is_active", true).order("name").limit(4),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    org: { id: org.id as string, name: org.name as string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders: ((ordersRes.data ?? []) as any[]).map((o: any) => ({
      id: o.id,
      status: o.status,
      total_amount: o.total_amount,
      order_date: o.order_date,
      hospitals: Array.isArray(o.hospitals) ? (o.hospitals[0] ?? null) : (o.hospitals ?? null),
    })),
    hospitals: (hospitalsRes.data ?? []) as Array<{ id: number; name: string; hospital_type: string }>,
    suppliers: (suppliersRes.data ?? []) as Array<{ id: number; name: string }>,
  };
}

export default async function DemoPage() {
  const data = await getDemoData();
  return <DemoClient data={data} />;
}
