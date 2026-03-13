import { createClient } from "@/lib/supabase/server";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getUsers(): Promise<{ users: UserProfile[]; total: number }> {
  const supabase = await createClient();

  // Try direct table access first as it's more reliable for dashboard
  const { data, count, error } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (!error && data) {
    return { users: data as UserProfile[], total: count ?? data.length };
  }

  // Fallback to Edge Function if table access fails (e.g. RLS issues)
  console.warn("Direct user_profiles access failed, trying Edge Function:", error?.message);
  
  const { data: funcData, error: funcError } = await supabase.functions.invoke("manage-users", {
    body: { _action: "list" },
  });

  if (funcError) {
    console.error("getUsers (Edge Function) failed:", funcError.message);
    return { users: [], total: 0 };
  }

  const result = funcData as { users?: UserProfile[]; total?: number } | null;
  return { users: result?.users ?? [], total: result?.total ?? 0 };
}
