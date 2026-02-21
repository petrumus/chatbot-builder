// Shared utilities for Supabase Edge Functions

const ALLOWED_ORIGIN = "https://petrumus.github.io";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  return await req.json() as T;
}

/**
 * Fetch from n8n with Header Auth and a 60-second timeout.
 * Returns the raw Response from n8n.
 */
export async function fetchN8n(
  url: string,
  authUser: string,
  authKey: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [authUser]: authKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse n8n response: try JSON, otherwise wrap text in an object.
 */
export async function parseN8nResponse(
  n8nResponse: Response,
  wrapKey = "message",
): Promise<{ body: string; status: number }> {
  const n8nData = await n8nResponse.text();
  let body: string;
  try {
    JSON.parse(n8nData);
    body = n8nData;
  } catch {
    body = JSON.stringify({ [wrapKey]: n8nData });
  }
  return { body, status: n8nResponse.status };
}

/**
 * Validate that a string field does not exceed maxLength.
 * Returns an error message or null if valid.
 */
export function validateLength(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
): string | null {
  if (value && value.length > maxLength) {
    return `Field '${fieldName}' exceeds maximum length of ${maxLength} characters`;
  }
  return null;
}

/**
 * Load required n8n environment variables.
 * Returns the values or throws with errorResponse.
 */
export function loadN8nEnv(
  webhookUrlKey: string,
): { webhookUrl: string; authUser: string; authKey: string } | null {
  const webhookUrl = Deno.env.get(webhookUrlKey);
  const authUser = Deno.env.get("N8N_AUTH_USER");
  const authKey = Deno.env.get("N8N_AUTH_KEY");

  if (!webhookUrl || !authUser || !authKey) {
    return null;
  }

  return { webhookUrl, authUser, authKey };
}
