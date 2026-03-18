/**
 * Catch-all proxy for Supabase API.
 * Reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) at runtime so it works
 * both in local dev (localhost:54321) and Docker (host.docker.internal:54321).
 */
import { NextRequest, NextResponse } from "next/server";

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:54321"
  );
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const supabaseUrl = getSupabaseUrl();
  const targetPath = path.join("/");
  const url = new URL(request.url);
  const target = `${supabaseUrl}/${targetPath}${url.search}`;

  // Forward headers (strip host, add originals)
  const headers = new Headers(request.headers);
  headers.delete("host");

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined,
  });

  // Forward response
  const responseHeaders = new Headers(res.headers);
  // Remove hop-by-hop headers
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
