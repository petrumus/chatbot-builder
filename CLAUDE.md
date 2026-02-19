# Chatbot Builder

Plain HTML/CSS/JS website hosted on GitHub Pages. Users fill a form to build a chatbot, then chat with it live. Both webhooks (build + chat) are proxied through Supabase Edge Functions to keep n8n URLs hidden.

## Specs
- [Project Overview](specs/project-overview.md) — architecture, file structure, conventions, deployment, response formats
- [Chat Interface](specs/chat-interface.md) — live chat demo: layout, webhook integration, session limit, markdown, error handling

## Quick Reference
- **Repo**: https://github.com/petrumus/chatbot-builder
- **Live**: https://petrumus.github.io/chatbot-builder/
- **Supabase project ref**: `umkkmgrjxgekbnvinhiq`
- **Supabase CLI**: `C:\Users\Petru\supabase-cli\supabase.exe`
- **Deploy frontend**: push to `main` (auto-deploys via GitHub Actions)
- **Deploy build function**: `supabase.exe functions deploy chatbot-webhook`
- **Deploy chat function**: `supabase.exe functions deploy chat-message`
- **Local dev**: `node serve.js` → http://localhost:8080
- **No frameworks, no build tools, no npm dependencies** — keep it vanilla
