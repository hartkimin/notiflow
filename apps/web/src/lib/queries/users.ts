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

  if (error) throw error;
  return data as { users: UserProfile[]; total: number };
}
