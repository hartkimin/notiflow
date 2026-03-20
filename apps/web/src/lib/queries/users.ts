import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Get profiles from user_profiles table
  const { data: profiles, count, error } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (error || !profiles) {
    console.warn("user_profiles access failed:", error?.message);
    return { users: [], total: 0 };
  }

  // Get emails from auth.users via admin client
  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  if (authData?.users) {
    for (const u of authData.users) {
      emailMap.set(u.id, u.email ?? "");
    }
  }

  // Merge email into profiles
  type ProfileRow = Omit<UserProfile, "email">;
  const users: UserProfile[] = (profiles as ProfileRow[]).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "",
  }));

  return { users, total: count ?? users.length };
}
