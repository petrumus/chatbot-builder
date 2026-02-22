import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  corsResponse,
  errorResponse,
  fetchN8n,
  loadN8nEnv,
  parseN8nResponse,
} from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const env = loadN8nEnv("N8N_PAGE_VISIT_WEBHOOK_URL");
  if (!env) return errorResponse("Server configuration error", 500);

  let body: {
    visitor_id?: string;
    lang?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const n8nResponse = await fetchN8n(env.webhookUrl, env.authUser, env.authKey, {
      visitor_id: body.visitor_id || "",
      lang: body.lang || "en",
    });

    const { body: responseBody, status } = await parseN8nResponse(n8nResponse, "message");

    return new Response(responseBody, {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("Request timed out", 504);
    }
    return errorResponse("Failed to reach the page visit service", 502);
  }
});
