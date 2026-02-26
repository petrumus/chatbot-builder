# SPEC: Demo Page — Build & Chat Interface

> **Status: IMPLEMENTED** — This spec reflects the current working implementation on `demo/index.html`.

## Overview

The demo page (`demo.html`) is where users build and interact with a custom AI agent. After filling a form (website URL, company description, agent name), the page transitions from a single-column form layout to a **two-panel split layout**: config info on the left, live chat on the right. The chat connects to n8n via a Supabase Edge Function proxy (`chat-message`), auto-sends a greeting, and supports markdown rendering, reply buttons, a typing indicator, and a 30-message session limit.

All demo-specific logic lives in `demo.js`, which depends on `shared.js` via the `window.NexonTech` API (aliased as `NT`).

---

## Page Structure

### Demo Intro Section (`#demo-header`)
Shown before the form, provides context:
- **Headline**: "See Your AI Agent in Action"
- **Description**: "This demo shows the conversational foundation — the 10% that's hardest to get right."
- **Badge**: "30 messages · No signup required"

### Form Section (`#form-section`)
The agent builder form with 3 fields:
- Website URL (text input, flexible format validation)
- Company Description (textarea, min 10 chars)
- Agent Name (text input)

### Progress Section (`#progress-section`)
4 animated steps shown during build.

### Result Section (`#result-section`)
Error card with retry button on build failure.

### Chat Panels (`#chat-config` + `#chat-panel`)
Split layout shown after successful build (hidden by default).

---

## Flow

### Build → Chat Transition
1. User fills form (website URL, company description, agent name)
2. Submit → POST to Supabase Edge Function → n8n build webhook (includes `lang`, `visitor_id`)
3. Progress steps animate (4 steps, 3s intervals, localized via i18n)
4. On success → extract `uuid` from response (checks `result.uuid` and `result.user_data.uuid`)
5. Hide form, progress, demo header → show split-panel layout
6. Auto-send localized greeting (first message, counts toward limit): "Hello" (en), "Salut" (ro), "Привет" (ru)
7. User chats with bot via `chat-message` edge function (proxies to n8n, includes `lang`, `visitor_id`)

### Build Failure
- Backend returns `{ success: false, message: "..." }` (HTTP 200 or 422)
- Frontend shows only the `message` field to the user (the `error.failures` array is kept internal)
- Generic fallback: "We couldn't build your chatbot. Please try again."
- Retry button returns to the form

### No UUID in Response
- Shows error: "Chatbot was created but something went wrong loading the chat. Please contact support."
- Does NOT enter chat mode

---

## Layout

### Split Layout Container
When chat activates, `#demo-container` gets the `.chat-mode` class:
- `display: flex`, `max-width: 1200px`, `gap: 1.5rem`
- Left panel: `360px` fixed width
- Right panel: `flex: 1`
- On mobile (≤768px): stacks vertically

**Note:** Uses `#demo-container` (not `.container`) and `#demo-header` (not `header`) to avoid conflicts with the shared navbar and page layout.

```
┌──────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌──────────────────────────────┐   │
│  │             │  │  Chat Header (bot name + ●)  │   │
│  │  Config     │  │──────────────────────────────│   │
│  │  Info       │  │                              │   │
│  │             │  │  Messages area (scrollable)  │   │
│  │  - Name     │  │                              │   │
│  │  - Website  │  │  [bot bubble - markdown]     │   │
│  │  - Desc     │  │         [user bubble - dark] │   │
│  │  - ID       │  │──────────────────────────────│   │
│  │  - Status   │  │  [Reply pill] [Reply pill]   │   │
│  │             │  │──────────────────────────────│   │
│  │  [Build     │  │  [Input (48px)] [Send btn]   │   │
│  │   Another]  │  │                              │   │
│  └─────────────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Left Panel — Config Info (`#chat-config`)
A card (`.config-card`) showing:
- **Agent name** as heading (`<h2>`)
- **Website** — clickable link (`target="_blank"`)
- **Description** — company description from form
- **Status** — "● Active" with green dot (`#2e7d32`)
- **Build Another** button — resets everything back to the form

#### Sidebar Contact CTA (`#sidebar-cta`)
A compact lead capture form shown alongside the config card during active chat:
- Single contact field (phone or email) + submit button
- Visible during chat, hidden when session ends (in-chat CTA takes over)
- Submits to `contact-form` edge function with `{ contact, user_uuid, chatbot_name, lang, visitor_id }`
- On success: replaced with "Thank you" message

### Right Panel — Chat Interface (`#chat-panel`)
A `.chat-card` with fixed `600px` height (flex column):

#### Chat Header
- Bot name + green status dot
- Fixed at top, `border-bottom`

#### Messages Area (`.chat-messages`)
- Scrollable, flex column, auto-scroll to bottom on new messages
- `gap: 0.75rem` between messages, `padding: 1.25rem`

#### Message Bubbles (`.chat-bubble`)
- **Bot messages** (`.chat-bubble.bot`): left-aligned, `background: #f5f5f5`, border-radius `2px 8px 8px 8px`, max-width 80%
- **User messages** (`.chat-bubble.user`): right-aligned, `background: #1a1a1a`, white text, border-radius `8px 2px 8px 8px`, max-width 80%
- **Error messages** (`.chat-bubble.error`): centered, light red bg (`#fff5f5`), red border (`#ffcdd2`), smaller font
- All bubbles have `fadeIn` animation (0.3s)

#### Typing Indicator (`.typing-indicator`)
- Three bouncing dots (`.typingBounce` keyframe animation)
- Styled like a bot bubble (left-aligned, gray bg)
- Shown while waiting for webhook response, removed when response arrives

#### Reply Buttons (`.chat-reply-buttons`)
- Row between messages and input (`padding: 0.5rem 1.25rem 0.75rem`)
- Pill-shaped buttons: `border-radius: 999px`, `background: #f5f5f5`, `border: 1px solid #d0d0d0`
- Hover: darker bg (`#e8e8e8`), border turns dark (`#1a1a1a`)
- Clicking a button sends its text as a user message
- Buttons clear when any message is sent
- Hidden when empty (`:empty { display: none }`)

#### Input Area (`.chat-input-area`)
- Fixed at bottom, `border-top`, `padding: 0.875rem 1.25rem`
- Text input: `min-height: 48px`, `border-radius: 12px`, `font-size: 0.9rem`
- Send button: `48px × 48px`, dark bg, white arrow SVG icon, `border-radius: 12px`
- Enter key sends (no Shift+Enter handling — single-line input)
- Input + button disabled while waiting for response
- Input + button disabled when session ends

---

## Chat Webhook Integration

### Endpoint
```
POST https://umkkmgrjxgekbnvinhiq.supabase.co/functions/v1/chat-message
```
**Proxied through Supabase Edge Function** — the n8n webhook URL (`N8N_CHAT_WEBHOOK_URL`) is a server-side secret. Frontend calls `CONFIG.CHAT_FUNCTION_URL` with Bearer anon key, same pattern as the build webhook.

### Request Body
```json
{
  "text": "User's message text here",
  "user_uuid": "c6b71ae3-e162-49d5-a046-94ade2723917",
  "lang": "en",
  "visitor_id": "abc-123-..."
}
```

### Response Body (normal)
```json
{
  "response": "Bot's markdown-formatted response text",
  "uuid": "c6b71ae3-e162-49d5-a046-94ade2723917",
  "user_reply_options": ["Option1", "Option2", "Option3"]
}
```

### Response Body (session limit)
```json
{
  "response": "Ai atins limita de mesaje...",
  "uuid": "c6b71ae3-e162-49d5-a046-94ade2723917",
  "user_reply_options": [],
  "session_ended": true
}
```

### Notes
- `response` contains Markdown: `**bold**`, `*italic*`, `\n` for newlines, `[text](url)` for links
- `user_reply_options` is an array of 0-4 short strings, or empty array `[]`
- `uuid` is echoed back (same as sent)

---

## Session Limit

**Maximum: 30 messages** (both user + bot messages counted).

Three detection methods (any triggers session end):
1. Backend returns `session_ended: true`
2. Client-side `messageCount >= 30`
3. Response is missing both `response` and `user_reply_options` fields

When session ends:
- Final bot message is displayed (from webhook response, or localized fallback text)
- Input is disabled, placeholder cleared
- Send button disabled
- Reply buttons cleared
- A `.chat-session-ended` bar is appended (localized)
- Sidebar CTA is hidden
- **In-chat Contact CTA** form is appended inside `.chat-card`
- If client-side limit triggered (messageCount >= 30): fire-and-forget POST to `reached-limit` edge function

### In-Chat Contact CTA (`.contact-cta`)
Appears inside the chat card after session ends:
- Fields: name (required), contact/phone/email (required), optional note
- Submit → POST to `contact-form` edge function with `{ name, contact, note, user_uuid, chatbot_name, lang, visitor_id }`
- Validation: name and contact required
- On success: form replaced with localized "Thank you" message
- On error: error message shown, button re-enabled

---

## Markdown Renderer

Custom `renderMarkdown(text)` function in `demo.js` (no library). Two-level processing:

**Block-level** (line-by-line in `renderMarkdown`):
1. **Escape HTML entities** (`&`, `<`, `>`, `"`) — XSS prevention
2. **Bullet lists**: `* text` or `- text` → `<ul class="md-list"><li>...</li></ul>`
3. **Ordered lists**: `1. text` → `<ol class="md-list"><li>...</li></ol>`
4. **Tables**: `| col | col |` rows → `<table class="md-table">` with optional header detection
5. **Empty lines** → `<br>` paragraph breaks
6. Regular lines → inline formatting + `<br>` between consecutive lines

**Inline-level** (`renderInline`):
1. **Bold**: `**text**` → `<strong>text</strong>`
2. **Italic**: `*text*` → `<em>text</em>`
3. **Markdown links**: `[text](url)` → `<a href="url" target="_blank" rel="noopener">text</a>`
4. **Bare URLs**: `https://...` → auto-linked `<a>` tags

Bot messages use `innerHTML` with rendered markdown. User messages use `textContent` (plain text only).

---

## URL Validation

Website URL field accepts flexible formats:
- Bare domain: `ultra.md`
- With www: `www.ultra.md`
- With protocol: `https://ultra.md` or `http://ultra.md`
- With path: `ultra.md/some-page`

**Validation** (`isValidDomain`): strips protocol and `www.`, takes first path segment, checks regex: `/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`

**Normalization** (`normalizeWebsite`): strips any existing protocol, prepends `https://`

Input is `type="text"` (not `type="url"`) with placeholder `example.com`.

---

## State Management

**Persistent (localStorage):**
```js
// In shared.js:
const visitorId = localStorage.getItem("visitor_id") || crypto.randomUUID();
let currentLang = localStorage.getItem("lang") || detectFromBrowser();
```

**Session state in demo.js (reset on page refresh):**
```js
const state = {
  userUuid: null,              // From build success response
  chatbotName: null,           // From form data
  messageCount: 0,             // Counts both user + bot messages
  sessionEnded: false,         // True when limit reached
  isWaitingForResponse: false, // Blocks input during API call
};
let savedFormData = null;      // { website, description, chatbotName }
```

**Constants:**
```js
const STEP_INTERVAL = 3000;   // Progress step timing (ms)
const MAX_MESSAGES = 30;      // Session message limit
```

---

## Key Functions

### shared.js (all pages)
| Function | Purpose |
|----------|---------|
| `t(key)` | Resolve i18n translation key (falls back to English) |
| `applyLanguage()` | Update all `[data-i18n]` elements, placeholders, page title, lang attr |

### demo.js (demo page only)
| Function | Purpose |
|----------|---------|
| `isValidDomain(value)` | Validates domain format (flexible) |
| `normalizeWebsite(value)` | Strips protocol, prepends `https://` |
| `validateField(input)` | Per-field validation with localized error messages |
| `validateForm()` | Validates all form fields |
| `submitToBackend(data)` | POST to Supabase Edge Function, parses JSON, attaches body to errors |
| `showBuildError(result)` | Shows `result.message` on build failure |
| `activateChatMode(uuid, formData)` | Transitions to split layout, populates config, resets sidebar CTA, auto-sends greeting |
| `renderMarkdown(text)` | Block-level MD → HTML (lists, tables, paragraphs) |
| `renderTable(lines)` | Parse pipe-delimited table lines into `<table>` HTML |
| `renderInline(text)` | Inline MD → HTML (bold, italic, links, bare URLs) |
| `appendMessage(role, text, replyOptions)` | Renders chat bubble + optional reply buttons |
| `appendError(text)` | Renders centered error bubble in chat |
| `showTypingIndicator()` | Adds bouncing dots indicator |
| `hideTypingIndicator()` | Removes typing indicator |
| `scrollToBottom()` | Scrolls chat messages to bottom |
| `sendMessage(text)` | Full send flow: show user msg → POST to edge function → handle response → reached-limit notification |
| `disableChat(reason)` | Disables input, hides sidebar CTA, appends session-ended bar + in-chat contact CTA |
| `escapeHtml(str)` | Escape HTML entities for safe insertion in contact CTA |
| `submitContactForm()` | Submit in-chat contact CTA to `contact-form` edge function |
| `submitSidebarContactForm()` | Submit sidebar contact CTA to `contact-form` edge function |
| `updateSendButton()` | Enables/disables send based on input state |

---

## Error Handling

### Build Errors
| Scenario | Behavior |
|----------|----------|
| HTTP 422, `success: false` | Show `result.message` from response |
| HTTP 200, `success: false` | Show `result.message` from response |
| HTTP 200, no uuid | Show "something went wrong loading the chat" |
| Network error / other | Show "We couldn't build your chatbot. Please try again." |

### Chat Errors
| Scenario | Behavior |
|----------|----------|
| Webhook HTTP error | Error bubble in chat, don't count message |
| Network failure | Error bubble in chat, don't count message |
| Missing response field | Treated as session end |

---

## Responsive Design (≤768px)

- `#demo-container.chat-mode`: `flex-direction: column`, `max-width: 100%`
- `#chat-config`: `width: 100%`
- `.config-card`: horizontal flex wrap, description and UUID fields hidden
- `.build-another-btn`: inline, `width: auto`
- `.chat-card`: `height: calc(100vh - 200px)`, `min-height: 400px`

---

## Animations

| Animation | CSS | Usage |
|-----------|-----|-------|
| `fadeIn` | 0.4s ease, translateY(8px→0) | Progress steps, result cards |
| `fadeIn` | 0.3s ease | Chat bubbles, typing indicator |
| `spin` | 0.8s linear infinite, rotate(360deg) | Progress step spinners |
| `typingBounce` | 1.2s ease-in-out infinite, translateY(-4px) | Typing indicator dots (staggered 0.15s) |

---

## "Build Another" Flow

Clicking the "Build Another" button:
1. Resets all chat state (`userUuid`, `chatbotName`, `messageCount`, `sessionEnded`, `isWaitingForResponse`)
2. Hides chat panels (`#chat-config`, `#chat-panel`)
3. Removes `.chat-mode` class from `#demo-container`
4. Removes any `.chat-session-ended` bar and `.contact-cta` element
5. Shows demo header and form section

---

## What NOT to Change

- No npm dependencies or build tools
- No markdown parsing library (custom `renderMarkdown` function in demo.js)
- No changes to `serve.js`
- No authentication or session persistence (except `visitor_id` and `lang` in localStorage)
- `visitor_id` and `lang` are the only uses of localStorage — do not add other persistent state
- `demo.js` must access shared state via `window.NexonTech`, not by duplicating logic
