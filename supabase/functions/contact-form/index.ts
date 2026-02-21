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

  const env = loadN8nEnv("N8N_CONTACT_WEBHOOK_URL");
  if (!env) return errorResponse("Server configuration error", 500);

  let body: {
    name?: string;
    contact?: string;
    note?: string;
    user_uuid?: string;
    chatbot_name?: string;
    lang?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body.contact) {
    return errorResponse("Missing required field: contact", 400);
  }

  // Input length validation
  const lengthError =
    validateLength(body.contact, "contact", 200) ||
    validateLength(body.name, "name", 200) ||
    validateLength(body.note, "note", 1000);
  if (lengthError) return errorResponse(lengthError, 400);

  try {
    const n8nResponse = await fetchN8n(env.webhookUrl, env.authUser, env.authKey, {
      name: body.name,
      contact: body.contact,
      note: body.note || "",
      user_uuid: body.user_uuid || "",
      chatbot_name: body.chatbot_name || "",
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
    return errorResponse("Failed to reach the contact form service", 502);
  }
});
