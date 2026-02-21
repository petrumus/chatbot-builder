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

  const env = loadN8nEnv("N8N_WEBHOOK_URL");
  if (!env) return errorResponse("Server configuration error", 500);

  let body: { website?: string; description?: string; chatbotName?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body.website || !body.description || !body.chatbotName) {
    return errorResponse("Missing required fields: website, description, chatbotName", 400);
  }

  // Input length validation
  const lengthError =
    validateLength(body.website, "website", 500) ||
    validateLength(body.description, "description", 5000) ||
    validateLength(body.chatbotName, "chatbotName", 100);
  if (lengthError) return errorResponse(lengthError, 400);

  try {
    const n8nResponse = await fetchN8n(env.webhookUrl, env.authUser, env.authKey, {
      website: body.website,
      description: body.description,
      chatbotName: body.chatbotName,
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
    return errorResponse("Failed to reach the chatbot builder service", 502);
  }
});
