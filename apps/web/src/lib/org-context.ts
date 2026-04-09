"use server";

import { createClient } from "@/lib/supabase/server";
import { cache } from "react";

export interface OrgContext {
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgRole: string;  // owner | admin | member
  isDemo: boolean;
}

/**
 * Get the current user's organization context.
 * Cached per-request via React cache().
 * Throws if the user has no organization (shouldn't happen after migration).
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("organization_id, org_role, organizations(id, name, slug, is_demo)")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    throw new Error("User has no organization");
  }

  const org = profile.organizations as unknown as { id: string; name: string; slug: string; is_demo: boolean } | null;
  if (!org) throw new Error("Organization not found");

  return {
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    orgRole: profile.org_role ?? "member",
    isDemo: org.is_demo,
  };
});

/**
 * Shorthand: just the org UUID, for injecting into inserts.
 */
export async function getOrgId(): Promise<string> {
  const ctx = await getOrgContext();
  return ctx.orgId;
}
