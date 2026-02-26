# NexonTech — Project Guide

## Overview
A multi-page marketing website for NexonTech AI agents. The site positions the product as a full AI agent (not just a chatbot) with 5 capability layers. Users can explore the landing page, view pricing, read FAQs, and try a live demo that builds a custom AI agent in 60 seconds. Both webhooks (build + chat) are proxied through Supabase Edge Functions to keep n8n URLs hidden.

**Pages (clean URLs — directory-based routing):**
- `/home` → `home/index.html` — Landing page (hero, capabilities, how-it-works, use cases, testimonials, CTA)
- `/demo` → `demo/index.html` — Interactive demo (form → build → live chat with AI agent)
- `/pricing` → `pricing/index.html` — Pricing tiers, add-ons, overage table, lead capture modal
- `/faq` → `faq/index.html` — Accordion FAQ (10 items, derived from sales objection handling)
- `/` → `index.html` — Redirect to `/home`

## Architecture
```
[GitHub Pages — static HTML/CSS/JS, multi-page]
        ↓ POST (Bearer anon key)
[Supabase Edge Function: chatbot-webhook]
        ↓ POST (Header Auth)
[n8n Build Webhook — builds chatbot]
        ↓ responds with uuid + user_data

[Frontend transitions to chat mode on demo/index.html]
        ↓ POST (Bearer anon key)
[Supabase Edge Function: chat-message]
        ↓ POST (Header Auth)
[n8n Chat Webhook — handles messages]
        ↓ responds with bot message + reply options
[Frontend renders chat]

[On page load (all pages) — fire-and-forget]
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
- **Backend proxy**: Supabase Edge Functions (Deno/TypeScript) — proxies for n8n webhooks + direct DB writes
- **Database**: Supabase PostgreSQL — `events` table for analytics event tracking
- **Automation**: n8n webhooks (build, chat, contact form, reached-limit, page-visit)
- **Hosting**: GitHub Pages (auto-deploys from `main` via GitHub Actions)
- **Repo**: https://github.com/petrumus/chatbot-builder
- **Live site**: https://petrumus.github.io/chatbot-builder/

## File Structure
```
├── index.html              # Root redirect → /home
├── home/
│   └── index.html          # Landing page — hero, capabilities, bridge, how-it-works, use cases, testimonials, CTA
├── demo/
│   └── index.html          # Demo page — form, progress steps, result, live chat
├── pricing/
│   └── index.html          # Pricing page — 4 tiers + enterprise + add-ons + overages + lead capture modal
├── faq/
│   └── index.html          # FAQ page — 10 accordion items
├── style.css               # All styles — navbar, pages, chat, responsive, animations
├── shared.js               # Shared logic (all pages) — visitor ID, i18n, event tracking, navbar, scroll reveal, FAQ, pricing toggle, pricing modal
├── demo.js                 # Demo-only logic — form, build, chat, markdown, contacts
├── config.js               # Supabase URLs + anon key (no n8n URLs)
├── lang.js                 # i18n translations (en, ro, ru) — all pages
├── serve.js                # Local dev server (Node.js, port 8080, clean URLs) — not deployed
├── .gitignore
├── CLAUDE.md               # Project instructions for Claude Code
├── specs/                  # Feature specifications
│   ├── project-overview.md # This file — architecture, conventions, deployment
│   └── chat-interface.md   # Chat UI spec (demo page: build + chat)
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
│       ├── page-visit/
│       │   └── index.ts    # Edge function proxy — page visit tracking
│       └── track-event/
│           └── index.ts    # Edge function — analytics event tracking (direct Supabase DB insert)
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Pages deployment
```

### JS Architecture
The original monolithic `script.js` was split into two files:

- **`shared.js`** (loaded on ALL pages): visitor ID, i18n system, page visit tracking, event tracking (`trackEvent()`), navbar (scroll/hamburger), smooth scroll, scroll reveal animations, FAQ accordion, pricing toggle, pricing lead capture modal. Exposes `window.NexonTech = { visitorId, t, getLang, applyLanguage, trackEvent }` for other scripts. Loaded from `../shared.js` (pages live in subdirectories).
- **`demo.js`** (loaded on `demo/index.html` ONLY): form validation, build API call, progress steps, chat mode, markdown renderer, contact forms. Uses `window.NexonTech` (aliased as `NT`) for translations and visitor ID. Guards with `if (!form) return;` to safely no-op on non-demo pages.

## Design System
- **Font**: system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`)
- **Primary color**: `#0a2540` (dark navy)
- **Accent color**: `#1a73e8` (blue)
- **Background**: `#ffffff` (white), `#f0f4f8` (light blue-gray for alternating sections)
- **Navbar**: fixed, transparent on home (→ solid on scroll), always solid on other pages
- **Buttons**: primary = `#0a2540` bg / white text; outline = transparent bg / border; CTA = accent blue
- **Cards**: white bg, subtle shadow, `border-radius: 12px`
- **Chat bubbles**: bot = `#f5f5f5` bg, user = `#1a1a1a` bg + white text
- **Error color**: `#d32f2f`
- **Success color**: `#2e7d32`
- **Reply buttons**: pill-shaped (`border-radius: 999px`), light gray bg

## Responsive Breakpoints
- **≤960px**: hamburger menu, stacked grids
- **≤640px**: smaller headings, tighter padding
- **≤480px**: single-column pricing, compact hero

## Key Conventions
- No frameworks or libraries — everything is vanilla JS
- `localStorage` used for `visitor_id` (persistent anonymous tracking) and `lang` (language preference)
- All other state resets on page refresh
- All secrets (n8n URLs, auth headers) are in Supabase Edge Function secrets, never in frontend code
- Supabase anon key IS public (by design, like Firebase API keys)
- All n8n webhooks use Header Auth: custom header name + value (not Basic Auth)
- All Edge Functions handle CORS via shared `_shared/utils.ts`
- n8n webhook URLs are never exposed to the browser — only Supabase function URLs are public
- All webhook requests include `visitor_id` and `lang` fields for tracking and i18n
- Body class determines page behavior: `page-home` = transparent navbar with scroll transition; other pages = solid navbar immediately
- All user-facing text uses `data-i18n` attributes for translation; all 3 languages (en/ro/ru) are fully translated

## Shared Edge Function Utilities (`_shared/utils.ts`)
All Edge Functions import from `_shared/utils.ts`:
- `corsHeaders` / `corsResponse()` — CORS handling (allows all origins for dev/prod flexibility)
- `jsonResponse(body, status)` — JSON response with CORS headers
- `errorResponse(message, status)` — error JSON response
- `parseJsonBody<T>(req)` — parse request JSON
- `fetchN8n(url, authUser, authKey, payload)` — POST to n8n with Header Auth and 60s timeout
- `parseN8nResponse(response, wrapKey)` — parse n8n response (try JSON, fallback to wrapping text)
- `validateLength(value, fieldName, maxLength)` — input length validation
- `loadN8nEnv(webhookUrlKey)` — load n8n env vars (`webhookUrlKey` + `N8N_AUTH_USER` + `N8N_AUTH_KEY`)

## Supabase Configuration
- **Project ref**: `umkkmgrjxgekbnvinhiq`
- **Edge Functions**: `chatbot-webhook` (build), `chat-message` (chat), `contact-form` (leads), `reached-limit` (notification), `page-visit` (tracking), `track-event` (analytics)
- **Database tables**: `events` (analytics event tracking — visitor_id, event_name, page, metadata jsonb, created_at)
- **Secrets**: `N8N_WEBHOOK_URL`, `N8N_CHAT_WEBHOOK_URL`, `N8N_CONTACT_WEBHOOK_URL`, `N8N_REACHED_LIMIT_WEBHOOK_URL`, `N8N_PAGE_VISIT_WEBHOOK_URL`, `N8N_AUTH_USER`, `N8N_AUTH_KEY`
- **Auto-available env vars** (used by `track-event`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **CLI path** (local): `C:\Users\Petru\supabase-cli\supabase.exe`

## Deployment
- **Frontend**: Push to `main` → GitHub Actions auto-deploys to Pages
- **Build function**: `supabase.exe functions deploy chatbot-webhook`
- **Chat function**: `supabase.exe functions deploy chat-message`
- **Contact function**: `supabase.exe functions deploy contact-form`
- **Reached-limit function**: `supabase.exe functions deploy reached-limit`
- **Page-visit function**: `supabase.exe functions deploy page-visit`
- **Track-event function**: `supabase.exe functions deploy track-event`
- **Local dev**: `node serve.js` → http://localhost:8080

## Feature Specs
- [Chat Interface](chat-interface.md) — demo page: live chat after successful agent build

## i18n System
- `lang.js` defines `LANG` object with translations for `en`, `ro`, `ru`
- Language auto-detected from `navigator.language` on first visit, then persisted in `localStorage` as `lang`
- Language switcher in navbar footer (flag buttons) allows manual switching across pages
- `t(key)` function resolves translation keys, falls back to English
- `applyLanguage()` updates all `[data-i18n]` and `[data-i18n-placeholder]` elements, page title, and `html[lang]`
- Auto-greeting is localized: "Hello" (en), "Salut" (ro), "Привет" (ru)
- All pages share the same i18n system via `shared.js`

## Event Tracking (Analytics)
- `trackEvent(eventName, metadata)` in `shared.js` — fire-and-forget POST to `track-event` Edge Function
- Edge Function inserts directly into Supabase `events` table (uses `supabase-js` with service role key, not n8n)
- Events table: `id`, `visitor_id`, `event_name`, `page`, `metadata` (jsonb), `created_at`
- RLS enabled — only service role can insert

### Tracked Events
| Event | Source | Metadata |
|---|---|---|
| `lang_switch` | shared.js (all pages) | `{ lang }` |
| `nav_click` | shared.js (all pages) | `{ target: href }` |
| `cta_click` | shared.js (home page) | `{ label, section }` |
| `faq_toggle` | shared.js (FAQ page) | `{ question }` |
| `pricing_toggle` | shared.js (pricing page) | `{ period }` |
| `plan_cta_click` | shared.js (pricing page) | `{ plan, action }` |
| `modal_open` | shared.js (pricing page) | `{ plan }` |
| `modal_submit` | shared.js (pricing page) | `{ plan }` |
| `modal_close` | shared.js (pricing page) | `{ plan }` |
| `demo_build_start` | demo.js | `{}` |
| `demo_build_success` | demo.js | `{}` |
| `demo_build_error` | demo.js | `{}` |
| `demo_chat_send` | demo.js | `{}` |
| `demo_contact_submit` | demo.js | `{ source: "sidebar"\|"chat" }` |
| `demo_build_another` | demo.js | `{}` |

## Visitor Tracking
- `visitor_id` generated via `crypto.randomUUID()` on first visit, stored in `localStorage`
- Persists across sessions — same visitor gets the same ID
- Sent with every webhook request (`visitor_id` field): build, chat, contact form, reached-limit, page-visit
- Page visit webhook fires on every page load (all pages, via `shared.js`)

## Page-Specific Features

### Landing Page (`home/index.html`)
- **Hero section**: headline, subheading, CTA buttons ("See It in Action" → demo, "View Pricing" → pricing), CSS chat mockup showing appointment booking scenario
- **Capabilities section**: 5 cards (Task Execution, Proactive Monitoring, Autonomous Decisions, Deep Context, Open Integrations)
- **Bridge section**: "10% that's hardest to get right" messaging connecting capabilities to demo CTA
- **How It Works**: 3 numbered steps with connectors (Describe → Review → Deploy)
- **Use Cases**: 3 cards (E-commerce, Healthcare/Clinic, Agencies & B2B)
- **Testimonials**: 3 quote cards + stats bar (200+ businesses, 93% satisfaction, <60s setup)
- **Final CTA**: "Ready to Meet Your Next Employee?" with demo button
- **Scroll reveal**: `.reveal` elements animate in via IntersectionObserver

### Demo Page (`demo/index.html`)
- **Demo intro**: headline, "10%" description, badge ("30 messages · No signup required")
- **Form → Progress → Chat**: see [chat-interface.md](chat-interface.md)

### Pricing Page (`pricing/index.html`)
- **Monthly/Annual toggle**: checkbox with "Save ~17%" badge
- **4 pricing cards**: Free Demo ($0), Starter ($149/mo), Pro ($399/mo, "Most Popular"), Business ($899/mo)
- **Lead capture modal**: "Get Started" / "Contact Us" buttons on paid plans open a modal with phone/email field. Submits to existing `contact-form` Edge Function with `note: "Plan: {planName}"`. Closes on X, overlay click, or Escape. Translates for all 3 languages. Fires `plan_cta_click`, `modal_open`, `modal_submit`, `modal_close` tracking events.
- **Enterprise banner**: "From ~$2,000/mo", "Contact Us" CTA (also opens the lead capture modal)
- **Add-ons**: Setup Sprint ($499 one-time), Managed Monthly (+$299/mo)
- **Overage table**: per-conversation rates (Starter $0.08, Pro $0.05, Business $0.03)
- **Proof of concept note**: "Every paid plan includes 1,000 free chats"
- **Price anchoring**: "Compare: a part-time support hire costs $1,500–3,000/mo"

### FAQ Page (`faq/index.html`)
- **10 accordion items** derived from sales pitch objection handling:
  1. What makes this different from other chatbots?
  2. What can the AI agent actually do?
  3. How long does setup take?
  4. What systems does it integrate with?
  5. How do we trust it to act autonomously?
  6. We don't need this yet — is it too early?
  7. Is there a free trial?
  8. What languages are supported?
  9. How does billing work?
  10. What kind of support do you offer?
- **Bottom CTA**: "Still have questions? Try the Free Demo"

## Shared UI Components

### Navbar
- Fixed position, `z-index: 1000`
- Logo (SVG) + nav links (What It Does, How It Works, Demo, Pricing, FAQ) + language switcher
- **Home page** (`page-home`): transparent bg → solid dark navy on scroll (>60px)
- **Other pages**: always solid dark navy
- **Mobile (≤960px)**: hamburger menu, full-screen overlay nav

### Footer
- Dark navy bg, 2-column layout (Product links, Company links)
- Copyright line at bottom

### Scroll Reveal
- Elements with `.reveal` class start invisible (`opacity: 0; transform: translateY(20px)`)
- IntersectionObserver adds `.revealed` class when element enters viewport (threshold 0.1)
- Transition: `0.6s ease`

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
Fire-and-forget notification on every page load (all pages).
**Request body:**
```json
{
  "visitor_id": "abc-123-...",
  "lang": "en"
}
```

### Track Event (via `track-event` Edge Function)
Fire-and-forget analytics event. Inserts directly into Supabase `events` table (not proxied to n8n).
**Request body:**
```json
{
  "event_name": "cta_click",
  "page": "/pricing/",
  "metadata": { "plan": "Pro", "action": "Get Started" },
  "visitor_id": "abc-123-..."
}
```
Validation: `event_name` required (max 100 chars), `page` max 500 chars.
**Success (200):** `{ "success": true }`
