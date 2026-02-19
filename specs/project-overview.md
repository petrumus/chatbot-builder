# Chatbot Builder — Project Guide

## Overview
A static website where users fill a form to build a custom chatbot. After the chatbot is built, the page transitions to a live chat demo interface. Hosted on GitHub Pages with a Supabase Edge Function proxy for secure backend communication.

## Architecture
```
[GitHub Pages — static HTML/CSS/JS]
        ↓ POST (Bearer anon key)
[Supabase Edge Function: chatbot-webhook]
        ↓ POST (Header Auth)
[n8n Build Webhook — builds chatbot]
        ↓ responds with uuid + user_data

[Frontend transitions to chat mode]
        ↓ POST (Bearer anon key)
[Supabase Edge Function: chat-message]
        ↓ POST (Header Auth)
[n8n Chat Webhook — handles messages]
        ↓ responds with bot message + reply options
[Frontend renders chat]
```

Both n8n webhook URLs are hidden as Supabase Edge Function secrets. The frontend only knows the Supabase function URLs.

## Tech Stack
- **Frontend**: Plain HTML, CSS, JS — NO frameworks, NO build tools, NO npm dependencies
- **Backend proxy**: Supabase Edge Functions (Deno/TypeScript) — for both build and chat webhooks
- **Automation**: n8n webhooks (build + chat)
- **Hosting**: GitHub Pages (auto-deploys from `main` via GitHub Actions)
- **Repo**: https://github.com/petrumus/chatbot-builder
- **Live site**: https://petrumus.github.io/chatbot-builder/

## File Structure
```
├── index.html              # Single-page app: form, progress, result, chat
├── style.css               # All styles — minimal, clean, responsive
├── script.js               # All frontend logic (IIFE pattern)
├── config.js               # Supabase URLs + anon key (no n8n URLs)
├── serve.js                # Local dev server (Node.js, port 8080) — not deployed
├── .gitignore
├── CLAUDE.md               # Project instructions for Claude Code
├── specs/                  # Feature specifications
│   ├── project-overview.md # This file — architecture, conventions, deployment
│   └── chat-interface.md   # Chat UI spec (post-build chat demo)
├── supabase/
│   └── functions/
│       ├── chatbot-webhook/
│       │   └── index.ts    # Edge function proxy — build webhook
│       └── chat-message/
│           └── index.ts    # Edge function proxy — chat webhook
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages deployment
```

## Design System
- Font: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`)
- Primary color: `#1a1a1a`
- Background: `#fafafa`
- Cards: white bg, `1px solid #e0e0e0`, `border-radius: 8px`
- Buttons: dark bg (`#1a1a1a`), white text, 6px radius
- Error color: `#d32f2f`
- Success color: `#2e7d32`
- Chat input: 12px border-radius, 48px min-height
- Reply buttons: pill-shaped (`border-radius: 999px`), light gray bg (`#f5f5f5`), subtle border (`#d0d0d0`)

## Key Conventions
- No frameworks or libraries — everything is vanilla JS
- No localStorage/sessionStorage — state resets on page refresh
- All secrets (n8n URLs, auth headers) are in Supabase Edge Function secrets, never in frontend code
- Supabase anon key IS public (by design, like Firebase API keys)
- Both n8n webhooks use Header Auth: custom header name + value (not Basic Auth)
- Both Edge Functions handle CORS (allow `Content-Type` and `Authorization` headers)
- n8n webhook URLs are never exposed to the browser — only Supabase function URLs are public

## Supabase Configuration
- **Project ref**: `umkkmgrjxgekbnvinhiq`
- **Edge Functions**: `chatbot-webhook` (build), `chat-message` (chat)
- **Secrets**: `N8N_WEBHOOK_URL`, `N8N_CHAT_WEBHOOK_URL`, `N8N_AUTH_USER`, `N8N_AUTH_KEY`
- **CLI path** (local): `C:\Users\Petru\supabase-cli\supabase.exe`

## Deployment
- **Frontend**: Push to `main` → GitHub Actions auto-deploys to Pages
- **Build function**: `supabase.exe functions deploy chatbot-webhook`
- **Chat function**: `supabase.exe functions deploy chat-message`
- **Local dev**: `node serve.js` → http://localhost:8080

## Feature Specs
- [Chat Interface](chat-interface.md) — live chat demo after successful chatbot build

## Current Flow

### 1. Build Phase
1. User fills form (website URL, company description, chatbot name)
2. Website URL accepts flexible formats: bare domain (`ultra.md`), with www (`www.ultra.md`), or with protocol (`https://ultra.md`) — all normalized to `https://` prefix
3. Submit → POST to Supabase Edge Function (with Bearer anon key)
4. Edge Function → forwards to n8n build webhook (with Header Auth)
5. Progress steps animate (4 steps: Analyzing website → Understanding business → Configuring chatbot → Finalizing setup)

### 2. Build Success → Chat Mode
6. On success → extract `uuid` from response (checks both `result.uuid` and `result.user_data.uuid`)
7. Page transitions to split-panel layout (config left, chat right)
8. Auto-sends `"Salut"` greeting via `chat-message` edge function
9. User chats with bot (30-message session limit)
10. Session ends when: backend sends `session_ended: true`, client count reaches 30, or response is missing `response` field

### 3. Build Failure
- HTTP 422 with `{ success: false, message: "..." }` → shows backend's `message` text
- HTTP 200 with `{ success: false, message: "..." }` → same handling
- Network/other errors → generic "We couldn't build your chatbot" message
- Retry button returns to form

### 4. Chat Errors
- Webhook failure → error bubble in chat ("Something went wrong. Please try again.")
- Failed messages don't count toward the 30-message limit

## Backend Response Formats

### Build Webhook (via Supabase Edge Function)
**Success (200):**
```json
{
  "success": true,
  "message": "Your chatbot has been built successfully.",
  "user_data": {
    "created_at": "2025-01-15T...",
    "id": "3",
    "uuid": "c6b71ae3-e162-49d5-a046-94ade2723917"
  }
}
```

**Failure (422):**
```json
{
  "success": false,
  "message": "User-facing error message here",
  "error": {
    "failures": ["detail1", "detail2"]
  }
}
```
Note: Only `message` is shown to the user. The `error.failures` array is for internal debugging.

### Chat Webhook (via `chat-message` Edge Function)
**Normal response:**
```json
{
  "response": "Bot's markdown-formatted response text",
  "uuid": "c6b71ae3-e162-49d5-a046-94ade2723917",
  "user_reply_options": ["Option1", "Option2", "Option3"]
}
```

**Session limit response:**
```json
{
  "response": "Session limit message in Romanian",
  "uuid": "c6b71ae3-e162-49d5-a046-94ade2723917",
  "user_reply_options": [],
  "session_ended": true
}
```
