const CONFIG = {
  // Your Supabase Edge Function URL
  SUPABASE_FUNCTION_URL: "https://umkkmgrjxgekbnvinhiq.supabase.co/functions/v1/chatbot-webhook",

  // Supabase anon key (public — safe to expose, like a Firebase API key)
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVta2ttZ3JqeGdla2JudmluaGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzAyOTUsImV4cCI6MjA4Njg0NjI5NX0.HWJTti-WLG1trPhp9zh_-DXT5zMti1gOOW9TZjvMO4s",

  // Chat message Edge Function URL (proxies to n8n, hides webhook URL)
  CHAT_FUNCTION_URL: "https://umkkmgrjxgekbnvinhiq.supabase.co/functions/v1/chat-message",

  // Contact form Edge Function URL (proxies to n8n, collects leads after chat demo)
  CONTACT_FUNCTION_URL: "https://umkkmgrjxgekbnvinhiq.supabase.co/functions/v1/contact-form",

  // Reached-limit Edge Function URL (notifies n8n when user hits message limit)
  REACHED_LIMIT_FUNCTION_URL: "https://umkkmgrjxgekbnvinhiq.supabase.co/functions/v1/reached-limit",

  // Page-visit Edge Function URL (notifies n8n when a visitor loads the page)
  PAGE_VISIT_FUNCTION_URL: "https://umkkmgrjxgekbnvinhiq.supabase.co/functions/v1/page-visit",
};
