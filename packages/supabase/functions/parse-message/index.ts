/**
 * parse-message Edge Function — Thin Proxy
 *
 * Trigger: DB Webhook on raw_messages INSERT
 * Forwards the webhook payload to the Web API /api/parse for actual parsing.
 * All parsing logic now lives in the Next.js app (single source of truth).
 */

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const record = body.record;

    if (!record) {
      return new Response(
        JSON.stringify({ error: "No record in webhook payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const webApiUrl = Deno.env.get("WEB_API_URL");
    const parseSecret = Deno.env.get("PARSE_API_SECRET");

    if (!webApiUrl || !parseSecret) {
      console.error("Missing WEB_API_URL or PARSE_API_SECRET env vars");
      return new Response(
        JSON.stringify({ error: "Proxy not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`${webApiUrl}/api/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-parse-secret": parseSecret,
      },
      body: JSON.stringify({
        message_id: record.id,
        content: record.content,
        hospital_id: record.hospital_id,
        force_order: body.force_order === true,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-message proxy error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
