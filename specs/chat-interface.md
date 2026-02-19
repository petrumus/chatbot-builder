# SPEC: Chat Interface After Successful Chatbot Build

> **Status: IMPLEMENTED** — This spec reflects the current working implementation.

## Overview

After a user successfully builds a chatbot (form submit → Supabase Edge Function → n8n webhook → success), the page transitions from a single-column form layout to a **two-panel split layout**: config info on the left, live chat on the right. The chat connects to n8n via a Supabase Edge Function proxy (`chat-message`), auto-sends a greeting, and supports markdown rendering, reply buttons, a typing indicator, and a 30-message session limit.

---

## Flow

### Build → Chat Transition
1. User fills form (website URL, company description, chatbot name)
2. Submit → POST to Supabase Edge Function → n8n build webhook
3. Progress steps animate (4 steps, 3s intervals)
4. On success → extract `uuid` from response (checks `result.uuid` and `result.user_data.uuid`)
5. Hide form, progress, header → show split-panel layout
6. Auto-send `"Salut"` as greeting (first message, counts toward limit)
7. User chats with bot via `chat-message` edge function (proxies to n8n)

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
When chat activates, `.container` gets the `.chat-mode` class:
- `display: flex`, `max-width: 1200px`, `gap: 1.5rem`
- Left panel: `360px` fixed width
- Right panel: `flex: 1`
- On mobile (≤768px): stacks vertically

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
- **Chatbot name** as heading (`<h2>`)
- **Website** — clickable link (`target="_blank"`)
- **Description** — company description from form
- **Chatbot ID** — uuid in `<code>` tag
- **Status** — "● Active" with green dot (`#2e7d32`)
- **Build Another** button — resets everything back to the form

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
  "user_uuid": "c6b71ae3-e162-49d5-a046-94ade2723917"
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
- Final bot message is displayed (from webhook response, or fallback Romanian text)
- Input is disabled, placeholder cleared
- Send button disabled
- Reply buttons cleared
- A `.chat-session-ended` bar is appended: "You've reached the message limit for this demo session."

---

## Markdown Renderer

Custom `renderMarkdown(text)` function (no library). Processing order:
1. **Escape HTML entities** (`&`, `<`, `>`, `"`) — XSS prevention
2. **Bold**: `**text**` → `<strong>text</strong>`
3. **Italic**: `*text*` → `<em>text</em>`
4. **Links**: `[text](url)` → `<a href="url" target="_blank" rel="noopener">text</a>`
5. **Newlines**: `\n` → `<br>`

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

All state in JS variables (no persistence):
```js
let userUuid = null;          // From build success response
let chatbotName = null;       // From form data
let messageCount = 0;         // Counts both user + bot messages
let sessionEnded = false;     // True when limit reached
let isWaitingForResponse = false; // Blocks input during API call
let savedFormData = null;     // { website, description, chatbotName }
```

Constants:
```js
const STEP_INTERVAL = 3000;   // Progress step timing (ms)
const MAX_MESSAGES = 30;      // Session message limit
```

---

## Key Functions (script.js)

| Function | Purpose |
|----------|---------|
| `isValidDomain(value)` | Validates domain format (flexible) |
| `normalizeWebsite(value)` | Strips protocol, prepends `https://` |
| `validateField(input)` | Per-field validation with error messages |
| `validateForm()` | Validates all form fields |
| `submitToBackend(data)` | POST to Supabase Edge Function, parses JSON, attaches body to errors |
| `showBuildError(result)` | Shows `result.message` on build failure |
| `activateChatMode(uuid, formData)` | Transitions to split layout, populates config, auto-sends "Salut" |
| `renderMarkdown(text)` | Simple MD → HTML (bold, italic, links, newlines) |
| `appendMessage(role, text, replyOptions)` | Renders chat bubble + optional reply buttons |
| `appendError(text)` | Renders centered error bubble in chat |
| `showTypingIndicator()` | Adds bouncing dots indicator |
| `hideTypingIndicator()` | Removes typing indicator |
| `scrollToBottom()` | Scrolls chat messages to bottom |
| `sendMessage(text)` | Full send flow: show user msg → POST to edge function → handle response |
| `disableChat(reason)` | Disables input, appends session-ended bar |
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

- `.container.chat-mode`: `flex-direction: column`, `max-width: 100%`
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
3. Removes `.chat-mode` class from container
4. Removes any `.chat-session-ended` bar
5. Shows header and form section

---

## Testing Checklist

- [x] Form submit works (validation, progress steps, API call)
- [x] Flexible URL validation (bare domains, www, https)
- [x] On success: layout transitions to split view
- [x] Config panel shows correct info (name, website, description, uuid)
- [x] Auto-greeting ("Salut") sent immediately, typing indicator shows
- [x] Bot's welcome response appears with markdown rendered
- [x] Typing a message + Enter sends it
- [x] User message appears right-aligned in dark bubble
- [x] Typing indicator shows while waiting
- [x] Bot response appears left-aligned with markdown rendered
- [x] Reply option buttons appear when provided (pill-shaped)
- [x] Clicking a reply button sends it as a message
- [x] Reply buttons disappear after sending
- [x] 30-message limit disables input and shows end message
- [x] Webhook error shows error message in chat (not a page crash)
- [x] Failed messages don't count toward limit
- [x] Build failure shows backend's message text
- [x] Mobile layout stacks panels properly
- [x] On error (build fails): error card + retry button works
- [x] "Build another" button resets everything back to the form

---

## What NOT to Change

- No npm dependencies or build tools
- No localStorage or sessionStorage
- No markdown parsing library (custom `renderMarkdown` function)
- No changes to Supabase Edge Functions (they're passthrough proxies)
- No changes to `serve.js`
- No authentication or session persistence
