# Chatbot Builder

Plain HTML/CSS/JS website hosted on GitHub Pages. Users fill a form to build a chatbot, then chat with it live. Supabase Edge Function proxy for the build webhook; direct n8n webhook for chat.

## Specs
- [Project Overview](specs/project-overview.md) — architecture, file structure, conventions, deployment, response formats
- [Chat Interface](specs/chat-interface.md) — live chat demo: layout, webhook integration, session limit, markdown, error handling

## Quick Reference
- **Repo**: https://github.com/petrumus/chatbot-builder
- **Live**: https://petrumus.github.io/chatbot-builder/
- **Supabase project ref**: `umkkmgrjxgekbnvinhiq`
- **Supabase CLI**: `C:\Users\Petru\supabase-cli\supabase.exe`
- **Deploy frontend**: push to `main` (auto-deploys via GitHub Actions)
- **Deploy edge function**: `supabase.exe functions deploy chatbot-webhook`
- **Local dev**: `node serve.js` → http://localhost:8080
- **No frameworks, no build tools, no npm dependencies** — keep it vanilla
