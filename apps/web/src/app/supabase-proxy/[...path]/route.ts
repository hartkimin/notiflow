/**
 * Catch-all proxy for Supabase API.
 * Used by both Docker web container and mobile apps connecting via Cloudflare Tunnel.
 * Reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) at runtime.
 */
import { NextRequest, NextResponse } from "next/server";

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:54321"
  );
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const { path } = await params;
  const supabaseUrl = getSupabaseUrl();
  const targetPath = path.join("/");
  const url = new URL(request.url);
  const target = `${supabaseUrl}/${targetPath}${url.search}`;

  // Forward headers (strip host)
  const headers = new Headers(request.headers);
  headers.delete("host");

  const res = await fetch(target, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined,
  });

  // Forward response with CORS headers
  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete("transfer-encoding");
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    responseHeaders.set(key, value);
  }

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
