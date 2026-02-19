/**
 * Admin Supabase client (no cookies, no user session).
 *
 * Uses the service_role key to bypass RLS.
 * Safe to use in API routes that are called by external services
 * (e.g. Edge Functions) where no browser cookie context exists.
 */
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
