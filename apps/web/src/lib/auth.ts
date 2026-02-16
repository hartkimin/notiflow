import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** Get current authenticated user with profile. Redirects to /login if not authenticated. */
export async function requireAuth(): Promise<UserSession> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile.name,
    role: profile.role,
  };
}

/** Get current user or null (no redirect). */
export async function getUser(): Promise<UserSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile.name,
    role: profile.role,
  };
}
