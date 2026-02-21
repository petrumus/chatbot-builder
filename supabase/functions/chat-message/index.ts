import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  corsResponse,
  errorResponse,
  fetchN8n,
  loadN8nEnv,
  parseN8nResponse,
  validateLength,
} from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const env = loadN8nEnv("N8N_CHAT_WEBHOOK_URL");
  if (!env) return errorResponse("Server configuration error", 500);

  let body: { text?: string; user_uuid?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body.text || !body.user_uuid) {
    return errorResponse("Missing required fields: text, user_uuid", 400);
  }

  // Input length validation
  const lengthError = validateLength(body.text, "text", 2000);
  if (lengthError) return errorResponse(lengthError, 400);

  try {
    const n8nResponse = await fetchN8n(env.webhookUrl, env.authUser, env.authKey, {
      text: body.text,
      user_uuid: body.user_uuid,
      lang: body.lang || "en",
    });

    const { body: responseBody, status } = await parseN8nResponse(n8nResponse, "response");

    return new Response(responseBody, {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("Request timed out", 504);
    }
    return errorResponse("Failed to reach the chat service", 502);
  }
});
