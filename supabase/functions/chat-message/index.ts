import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const N8N_CHAT_WEBHOOK_URL = Deno.env.get("N8N_CHAT_WEBHOOK_URL");
  const N8N_AUTH_USER = Deno.env.get("N8N_AUTH_USER");
  const N8N_AUTH_KEY = Deno.env.get("N8N_AUTH_KEY");

  if (!N8N_CHAT_WEBHOOK_URL || !N8N_AUTH_USER || !N8N_AUTH_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let body: { text?: string; user_uuid?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate required fields
  if (!body.text || !body.user_uuid) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: text, user_uuid" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // n8n Header Auth: sends the header name (N8N_AUTH_USER) with value (N8N_AUTH_KEY)
    const n8nResponse = await fetch(N8N_CHAT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [N8N_AUTH_USER]: N8N_AUTH_KEY,
      },
      body: JSON.stringify({
        text: body.text,
        user_uuid: body.user_uuid,
      }),
    });

    const n8nData = await n8nResponse.text();

    let responseBody: string;
    try {
      // Try to parse as JSON and forward it
      JSON.parse(n8nData);
      responseBody = n8nData;
    } catch {
      // If n8n returned non-JSON, wrap it
      responseBody = JSON.stringify({ response: n8nData });
    }

    return new Response(responseBody, {
      status: n8nResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to reach the chat service" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
