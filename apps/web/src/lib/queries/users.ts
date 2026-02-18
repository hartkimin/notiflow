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

  // Call the manage-users Edge Function
  const { data, error } = await supabase.functions.invoke("manage-users", {
    method: "GET",
  });

  if (error) {
    console.error("getUsers failed:", error.message);
    return { users: [], total: 0 };
  }

  const result = data as { users?: UserProfile[]; total?: number } | null;
  return { users: result?.users ?? [], total: result?.total ?? 0 };
}
