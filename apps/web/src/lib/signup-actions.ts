"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export interface SignupData {
  email: string;
  password: string;
  name: string;
  companyName: string;
}

/**
 * Create a new organization + owner user.
 * Called from the /signup page.
 * Uses the admin client so we can bypass RLS during initial account creation.
 */
export async function signupWithOrg(data: SignupData): Promise<{ error?: string }> {
  const admin = createAdminClient();

  // 1. Create the auth user
  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { name: data.name, role: "admin" },
  });
  if (authErr) return { error: `계정 생성 실패: ${authErr.message}` };

  // 2. Create the organization
  const slug = data.companyName
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `org-${Date.now()}`;

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: data.companyName,
      slug: `${slug}-${Date.now().toString(36)}`, // ensure uniqueness
      plan: "free",
      is_demo: false,
      is_active: true,
    })
    .select("id")
    .single();

  if (orgErr) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return { error: `조직 생성 실패: ${orgErr.message}` };
  }

  // 3. Create the user profile (owner of the new org)
  const { error: profileErr } = await admin.from("user_profiles").upsert({
    id: newUser.user.id,
    name: data.name,
    role: "admin",       // system role (for existing RLS)
    org_role: "owner",   // org-level role
    organization_id: org.id,
    is_active: true,
  }, { onConflict: "id" });

  if (profileErr) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    await admin.from("organizations").delete().eq("id", org.id);
    return { error: `프로필 생성 실패: ${profileErr.message}` };
  }

  return {};
}
