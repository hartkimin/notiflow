import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Weekly data retention job:
 * 1. Archive raw_messages older than 90 days
 * 2. Clean up old notification_logs (180 days) and audit_logs (365 days)
 *
 * Schedule: Every Sunday at 03:00 KST (Saturday 18:00 UTC)
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const results: Record<string, unknown> = {};

  // 1. Archive old messages
  const { data: archiveCount, error: archiveError } = await supabase.rpc(
    "archive_old_messages",
    { retention_days: 90 },
  );

  if (archiveError) {
    results.archive_error = archiveError.message;
  } else {
    results.messages_archived = archiveCount;
  }

  // 2. Clean up old logs
  const { data: cleanupResult, error: cleanupError } = await supabase.rpc(
    "cleanup_old_logs",
  );

  if (cleanupError) {
    results.cleanup_error = cleanupError.message;
  } else {
    results.cleanup = cleanupResult;
  }

  return NextResponse.json({
    success: !archiveError && !cleanupError,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
