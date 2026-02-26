import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  corsResponse,
  errorResponse,
  jsonResponse,
  validateLength,
} from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("Server configuration error", 500);
  }

  let body: {
    event_name?: string;
    page?: string;
    metadata?: Record<string, unknown>;
    visitor_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body.event_name) {
    return errorResponse("Missing required field: event_name", 400);
  }

  const lengthError =
    validateLength(body.event_name, "event_name", 100) ||
    validateLength(body.page, "page", 500);
  if (lengthError) return errorResponse(lengthError, 400);

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from("events").insert({
      visitor_id: body.visitor_id || "",
      event_name: body.event_name,
      page: body.page || "",
      metadata: body.metadata || {},
    });

    if (error) {
      return errorResponse("Failed to store event", 500);
    }

    return jsonResponse({ success: true });
  } catch {
    return errorResponse("Failed to store event", 500);
  }
});
