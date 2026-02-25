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

[On page load — fire-and-forget]
        ↓ POST (Bearer anon key)
[Supabase Edge Function: page-visit]
        ↓ POST (Header Auth)
[n8n Page Visit Webhook — tracks visitor]

[On session limit reached — fire-and-forget]
        ↓ POST (Bearer anon key)
[Supabase Edge Function: reached-limit]
        ↓ POST (Header Auth)
[n8n Reached Limit Webhook — notifies]

[Contact form submission (in-chat CTA or sidebar)]
        ↓ POST (Bearer anon key)
[Supabase Edge Function: contact-form]
        ↓ POST (Header Auth)
[n8n Contact Webhook — captures lead]
```

All n8n webhook URLs are hidden as Supabase Edge Function secrets. The frontend only knows the Supabase function URLs.

## Tech Stack
- **Frontend**: Plain HTML, CSS, JS — NO frameworks, NO build tools, NO npm dependencies
- **Backend proxy**: Supabase Edge Functions (Deno/TypeScript) — proxies for all n8n webhooks
- **Automation**: n8n webhooks (build, chat, contact form, reached-limit, page-visit)
- **Hosting**: GitHub Pages (auto-deploys from `main` via GitHub Actions)
- **Repo**: https://github.com/petrumus/chatbot-builder
- **Live site**: https://petrumus.github.io/chatbot-builder/

## File Structure
```
├── index.html              # Single-page app: form, progress, result, chat
├── style.css               # All styles — minimal, clean, responsive
├── script.js               # All frontend logic (IIFE pattern)
├── config.js               # Supabase URLs + anon key (no n8n URLs)
├── lang.js                 # i18n translations (en, ro, ru)
├── serve.js                # Local dev server (Node.js, port 8080) — not deployed
├── .gitignore
├── CLAUDE.md               # Project instructions for Claude Code
├── specs/                  # Feature specifications
│   ├── project-overview.md # This file — architecture, conventions, deployment
│   └── chat-interface.md   # Chat UI spec (post-build chat demo)
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   └── utils.ts    # Shared utilities (CORS, fetchN8n, validation)
│       ├── chatbot-webhook/
│       │   └── index.ts    # Edge function proxy — build webhook
│       ├── chat-message/
│       │   └── index.ts    # Edge function proxy — chat webhook
│       ├── contact-form/
│       │   └── index.ts    # Edge function proxy — contact/lead capture
│       ├── reached-limit/
│       │   └── index.ts    # Edge function proxy — session limit notification
│       └── page-visit/
│           └── index.ts    # Edge function proxy — page visit tracking
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
- `localStorage` is used only for `visitor_id` (persistent anonymous visitor tracking across sessions)
- All other state resets on page refresh (no sessionStorage)
- All secrets (n8n URLs, auth headers) are in Supabase Edge Function secrets, never in frontend code
- Supabase anon key IS public (by design, like Firebase API keys)
- All n8n webhooks use Header Auth: custom header name + value (not Basic Auth)
- All Edge Functions handle CORS via shared `_shared/utils.ts` (allow `Content-Type` and `Authorization` headers)
- n8n webhook URLs are never exposed to the browser — only Supabase function URLs are public
- All webhook requests include `visitor_id` and `lang` fields for tracking and i18n

## Shared Edge Function Utilities (`_shared/utils.ts`)
All Edge Functions import from `_shared/utils.ts`:
- `corsHeaders` / `corsResponse()` — CORS handling
- `jsonResponse(body, status)` — JSON response with CORS headers
- `errorResponse(message, status)` — error JSON response
- `parseJsonBody<T>(req)` — parse request JSON
- `fetchN8n(url, authUser, authKey, payload)` — POST to n8n with Header Auth and 60s timeout
- `parseN8nResponse(response, wrapKey)` — parse n8n response (try JSON, fallback to wrapping text)
- `validateLength(value, fieldName, maxLength)` — input length validation
- `loadN8nEnv(webhookUrlKey)` — load n8n env vars (`webhookUrlKey` + `N8N_AUTH_USER` + `N8N_AUTH_KEY`)

## Supabase Configuration
- **Project ref**: `umkkmgrjxgekbnvinhiq`
- **Edge Functions**: `chatbot-webhook` (build), `chat-message` (chat), `contact-form` (leads), `reached-limit` (notification), `page-visit` (tracking)
- **Secrets**: `N8N_WEBHOOK_URL`, `N8N_CHAT_WEBHOOK_URL`, `N8N_CONTACT_WEBHOOK_URL`, `N8N_REACHED_LIMIT_WEBHOOK_URL`, `N8N_PAGE_VISIT_WEBHOOK_URL`, `N8N_AUTH_USER`, `N8N_AUTH_KEY`
- **CLI path** (local): `C:\Users\Petru\supabase-cli\supabase.exe`

## Deployment
- **Frontend**: Push to `main` → GitHub Actions auto-deploys to Pages
- **Build function**: `supabase.exe functions deploy chatbot-webhook`
- **Chat function**: `supabase.exe functions deploy chat-message`
- **Contact function**: `supabase.exe functions deploy contact-form`
- **Reached-limit function**: `supabase.exe functions deploy reached-limit`
- **Page-visit function**: `supabase.exe functions deploy page-visit`
- **Local dev**: `node serve.js` → http://localhost:8080

## Feature Specs
- [Chat Interface](chat-interface.md) — live chat demo after successful chatbot build

## i18n System
- `lang.js` defines `LANG` object with translations for `en`, `ro`, `ru`
- Language auto-detected from `navigator.language` on page load
- Language switcher buttons (`.lang-btn`) allow manual switching
- `t(key)` function resolves translation keys, falls back to English
- `applyLanguage()` updates all `[data-i18n]` and `[data-i18n-placeholder]` elements, page title, and `html[lang]`
- Auto-greeting is localized: "Hello" (en), "Salut" (ro), "Привет" (ru)

## Visitor Tracking
- `visitor_id` generated via `crypto.randomUUID()` on first visit, stored in `localStorage`
- Persists across sessions — same visitor gets the same ID
- Sent with every webhook request (`visitor_id` field): build, chat, contact form, reached-limit, page-visit

## Current Flow

### 0. Page Load
- Generate or retrieve `visitor_id` from `localStorage`
- Auto-detect language from browser locale
- Fire-and-forget POST to `page-visit` edge function with `{ visitor_id, lang }`

### 1. Build Phase
1. User fills form (website URL, company description, chatbot name)
2. Website URL accepts flexible formats: bare domain (`ultra.md`), with www (`www.ultra.md`), or with protocol (`https://ultra.md`) — all normalized to `https://` prefix
3. Submit → POST to Supabase Edge Function (with Bearer anon key) — includes `lang` and `visitor_id`
4. Edge Function → forwards to n8n build webhook (with Header Auth)
5. Progress steps animate (4 steps, localized via i18n)

### 2. Build Success → Chat Mode
6. On success → extract `uuid` from response (checks both `result.uuid` and `result.user_data.uuid`)
7. Page transitions to split-panel layout (config left, chat right)
8. Auto-sends localized greeting via `chat-message` edge function
9. User chats with bot (30-message session limit)
10. Session ends when: backend sends `session_ended: true`, client count reaches 30, or response is missing `response` field

### 3. Session End → Contact CTA
11. Chat input disabled, session-ended bar shown
12. In-chat contact CTA form appears (name, contact, optional note)
13. Sidebar CTA is hidden (in-chat CTA takes over)
14. Contact form submits to `contact-form` edge function
15. On client-side limit (messageCount >= 30): fire-and-forget POST to `reached-limit` edge function

### 4. Build Failure
- HTTP 422 with `{ success: false, message: "..." }` → shows backend's `message` text
- HTTP 200 with `{ success: false, message: "..." }` → same handling
- Network/other errors → generic localized error message
- Retry button returns to form

### 5. Chat Errors
- Webhook failure → error bubble in chat (localized error message)
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
**Request body:**
```json
{
  "text": "User's message",
  "user_uuid": "c6b71ae3-...",
  "lang": "en",
  "visitor_id": "abc-123-..."
}
```

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
  "response": "Session limit message",
  "uuid": "c6b71ae3-e162-49d5-a046-94ade2723917",
  "user_reply_options": [],
  "session_ended": true
}
```

### Contact Form Webhook (via `contact-form` Edge Function)
**Request body:**
```json
{
  "name": "User's name",
  "contact": "Phone or email (required)",
  "note": "Optional note",
  "user_uuid": "c6b71ae3-...",
  "chatbot_name": "BotName",
  "lang": "en",
  "visitor_id": "abc-123-..."
}
```
Validation: `contact` required, `contact` max 200, `name` max 200, `note` max 1000 chars.

### Reached-Limit Webhook (via `reached-limit` Edge Function)
Fire-and-forget notification when client-side message count reaches 30.
**Request body:**
```json
{
  "user_uuid": "c6b71ae3-...",
  "chatbot_name": "BotName",
  "lang": "en",
  "visitor_id": "abc-123-..."
}
```

### Page-Visit Webhook (via `page-visit` Edge Function)
Fire-and-forget notification on every page load.
**Request body:**
```json
{
  "visitor_id": "abc-123-...",
  "lang": "en"
}
```
