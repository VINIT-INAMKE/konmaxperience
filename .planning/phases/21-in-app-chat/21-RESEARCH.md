# Phase 21: In-App Chat - Research

**Researched:** 2026-03-23
**Domain:** Pusher.js real-time chat, NestJS Channels SDK, Next.js 16 App Router, Prisma chat schema
**Confidence:** HIGH (Pusher APIs verified against official docs + GitHub README; Next.js 16 verified against official upgrade guide)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dedicated `/chat` page — full page with conversation list on left, message thread on right (Slack/Teams style)
- **D-02:** Conversation list style is Claude's discretion
- **D-03:** No chat badge/indicator in sidebar — users navigate to /chat to check messages
- **D-04:** "Chat" nav item added to ops sidebar for all authenticated users
- **D-05:** Messages support text + images + file attachments (reuse R2 presign pattern)
- **D-06:** Typing indicator ("X is typing...") via Pusher client events
- **D-07:** Read receipts — double-check marks when message is read by recipient(s)
- **D-08:** Messages are permanent — no edit, no delete
- **D-09:** Real-time delivery via Pusher.js channels
- **D-10:** 1-1 chats: any user can start a chat with any other active user
- **D-11:** Group chats: only FOUNDER_ADMIN can create groups — picks members and sets group name
- **D-12:** Admin can add or remove members from group chats at any time
- **D-13:** No mute, no archive
- **D-14:** Group chats have a name and optional icon/avatar
- **D-15:** Separate admin view — admin/tech see their own chats + "All Conversations" tab
- **D-16:** "All Conversations" tab available only to FOUNDER_ADMIN and TECH_LEAD
- **D-17:** Policy notice in chat: "Conversations may be reviewed by admins for operational purposes"
- **D-18:** Admin viewing another user's chat is read-only
- **D-19:** Pusher.js for all real-time events
- **D-20:** One Pusher channel per conversation (`private-chat-{conversationId}`)
- **D-21:** Pusher server-side (NestJS) triggers events; client-side subscribes
- **D-22:** Client events for typing indicators (no server round-trip)

### Claude's Discretion

- Conversation list design (avatar + preview vs compact)
- Message bubble styling and layout
- File/image attachment preview in messages
- Pusher channel naming conventions
- Database schema for conversations, messages, participants
- Pagination strategy for message history (cursor-based recommended)
- How to handle conversation creation UX
- Read receipt data model (per-message or per-conversation last-read timestamp)

### Deferred Ideas (OUT OF SCOPE)

- Message search/filtering
- Message reactions (emoji)
- Thread replies within messages
- Chat notifications (push/email)
- Voice/video calls
- Chat export/download
- Pinned messages in groups
</user_constraints>

---

## Summary

Phase 21 adds real-time 1-1 and group chat to the ops platform using Pusher Channels. The architecture is straightforward: NestJS initializes a singleton Pusher server SDK instance, triggered on message save; the client uses pusher-js with private channel authorization routed through a NestJS `/chat/auth` endpoint that checks conversation membership before returning the Pusher auth token. Typing indicators use Pusher client events (no server round-trip) with a client-side debounce + 3-second display timeout.

The primary schema design decision is to use `last_read_at` per ConversationParticipant rather than per-message read tracking — this matches Twilio/Slack patterns and is much simpler at this team size (8 people). Admin oversight is implemented entirely in the auth endpoint: FOUNDER_ADMIN and TECH_LEAD are always granted authorization for any `private-chat-*` channel, bypassing the membership check.

The UI must break out of the ops layout's padding container to achieve a full-height split panel. The UI-SPEC contract fully prescribes layout dimensions, colors, bubble styles, and component choices — the planner should treat it as implementation spec, not research territory.

**Primary recommendation:** Build as a single `ChatModule` with NestJS; initialize Pusher as a `@Injectable()` service singleton with `ConfigService`; use `last_read_at` on `ConversationParticipant` for read receipts; use cursor-based pagination (by `id`, `DESC`) for message history.

---

<phase_requirements>
## Phase Requirements

Requirements for Phase 21 are TBD (to be defined during planning). The planner should define CHAT-01 through CHAT-N to cover all locked decisions D-01 through D-22.

| Category | Coverage Needed |
|----------|----------------|
| Schema | Conversation, Message, ConversationParticipant, Prisma migration |
| Backend module | ChatModule: service, controller, Pusher auth endpoint |
| Real-time | Pusher trigger on message create, client event passthrough for typing |
| Read receipts | last_read_at update on read, Pusher event to sender |
| Admin oversight | Auth endpoint bypass for FOUNDER_ADMIN / TECH_LEAD |
| Frontend page | /chat split-panel page, conversation list, thread, compose area |
| Attachments | Presign endpoint for chat/ prefix |
| Sidebar | Add "Chat" nav item to all authenticated users |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pusher (server) | 5.3.3 | NestJS SDK — trigger events, authorize channels | Official Pusher Node.js HTTP client |
| pusher-js (client) | 8.4.3 | Next.js React SDK — subscribe channels, receive events, client events | Official Pusher browser client |
| @prisma/client | 6.19.2 (already installed) | Chat schema — Conversation, Message, Participant | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 | already installed | R2 presign for chat attachments | Reuse StorageService.generatePresignedPutUrl |
| lucide-react | already installed | Paperclip, Check, Users, Plus icons in chat UI | Reuse existing icon library |
| @tanstack/react-query | already installed | Message history fetching, conversations list | Reuse existing query client |
| zustand | already installed | Auth store for role checks (admin oversight) | Reuse useAuthStore |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pusher (locked D-19) | Socket.io | Socket.io requires managing a WebSocket server; Pusher is hosted infrastructure |
| last_read_at on participant | Per-message MessageRead join table | Per-message is necessary only for detailed group receipts; last_read_at is sufficient for this team size and is battle-tested (Twilio pattern) |
| cursor by id DESC | offset pagination | Offset is unusable with real-time inserts; cursor by id is stable |

### Installation

```bash
# Backend
cd backend && npm install pusher

# Frontend
cd frontend && npm install pusher-js
```

**Version verification (confirmed 2026-03-23):**
- `npm view pusher version` → 5.3.3
- `npm view pusher-js version` → 8.4.3

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/chat/
├── chat.module.ts              # imports StorageModule for presign reuse
├── chat.service.ts             # createMessage, getConversations, getMessages, markRead
├── chat.controller.ts          # REST endpoints + /chat/auth Pusher endpoint
├── pusher.service.ts           # @Injectable() Pusher singleton, trigger(), authorizeChannel()
├── dto/
│   ├── create-conversation.dto.ts
│   ├── create-message.dto.ts
│   └── pusher-auth.dto.ts      # socket_id, channel_name
└── types/
    └── chat.types.ts           # ChatEvent enum, message payload interfaces

frontend/app/(ops)/chat/
├── page.tsx                    # Chat page — 'use client', split-panel layout
├── _components/
│   ├── conversation-list.tsx   # Left panel: list + new chat button
│   ├── conversation-item.tsx   # Single row with avatar, preview, unread badge
│   ├── message-thread.tsx      # Right panel: scroll area + bubbles + compose
│   ├── message-bubble.tsx      # Outgoing / incoming bubble variants
│   ├── compose-area.tsx        # Textarea + attach button + send button
│   ├── typing-indicator.tsx    # "X is typing..." display
│   └── read-receipt-icon.tsx   # Double check SVG with conditional coloring
frontend/lib/
├── pusher-client.ts            # Singleton Pusher client (typeof window guard)
└── hooks/
    └── use-pusher-channel.ts   # Subscribe/unsubscribe lifecycle hook
```

### Pattern 1: Pusher Service Singleton (NestJS)

**What:** Initialize Pusher once in the service constructor, reuse across all requests.
**When to use:** Every triggered event goes through this service.

```typescript
// Source: https://github.com/pusher/pusher-http-node
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class PusherService {
  private readonly pusher: Pusher;

  constructor(private readonly config: ConfigService) {
    this.pusher = new Pusher({
      appId: this.config.get<string>('PUSHER_APP_ID')!,
      key: this.config.get<string>('PUSHER_KEY')!,
      secret: this.config.get<string>('PUSHER_SECRET')!,
      cluster: this.config.get<string>('PUSHER_CLUSTER')!,
      useTLS: true,
    });
  }

  trigger(channel: string, event: string, data: unknown) {
    return this.pusher.trigger(channel, event, data);
  }

  authorizeChannel(socketId: string, channelName: string) {
    // Returns { auth: "<signed_string>" } — send directly to client
    return this.pusher.authorizeChannel(socketId, channelName);
  }
}
```

### Pattern 2: Private Channel Auth Endpoint (NestJS)

**What:** Pusher client calls `NEXT_PUBLIC_API_URL/chat/auth` with `socket_id` and `channel_name` (form-encoded POST). Server verifies membership, returns auth token.
**When to use:** Called automatically by pusher-js when subscribing to `private-chat-*`.

```typescript
// Source: https://pusher.com/docs/channels/server_api/authorizing-users/
@Post('auth')
@HttpCode(200)
async pusherAuth(
  @Body() dto: PusherAuthDto,   // { socket_id: string, channel_name: string }
  @Req() req: express.Request,
) {
  const user = (req as any).user; // { id, roleCode } from JwtAuthGuard
  const { socket_id, channel_name } = dto;

  // Extract conversationId from "private-chat-{conversationId}"
  const conversationId = channel_name.replace('private-chat-', '');

  // Admin/tech bypass — always authorized to subscribe to any chat channel
  const isAdmin = [RoleCode.FOUNDER_ADMIN, RoleCode.TECH_LEAD].includes(user.roleCode);

  if (!isAdmin) {
    // Verify caller is a participant in this conversation
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversation_id: conversationId, user_id: user.id },
    });
    if (!participant) throw new ForbiddenException('Not a participant');
  }

  return this.pusherService.authorizeChannel(socket_id, channel_name);
}
```

**Key insight:** The auth endpoint is the sole access-control layer. Admin bypass is a server-side decision — no Pusher-side configuration needed. The server controls who gets an auth token, so admins simply always get one for any `private-chat-*` channel.

### Pattern 3: Pusher Client Singleton (Next.js)

**What:** Create pusher-js instance once using `globalThis` guard to prevent SSR crash and multiple connections.
**When to use:** Import from any client component that needs real-time.

```typescript
// Source: https://github.com/pusher/pusher-js (README)
// frontend/lib/pusher-client.ts
import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

export function getPusherClient(): Pusher {
  if (typeof window === 'undefined') {
    throw new Error('Pusher client only available in browser');
  }
  if (!pusherInstance) {
    pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        endpoint: `${process.env.NEXT_PUBLIC_API_URL}/chat/auth`,
        transport: 'ajax',
        // credentials: 'include' not supported in ajax transport directly;
        // use customHandler to pass cookies
        customHandler: async ({ socketId, channelName, callback }) => {
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/chat/auth`,
              {
                method: 'POST',
                credentials: 'include',   // sends access_token cookie
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
              },
            );
            if (!res.ok) { callback(new Error('Auth failed'), null); return; }
            const data = await res.json();
            callback(null, data);
          } catch (err) {
            callback(err as Error, null);
          }
        },
      },
    });
  }
  return pusherInstance;
}
```

**Critical:** The standard `ajax` transport for `channelAuthorization` does NOT automatically include cookies. Use `customHandler` with `credentials: 'include'` to forward the `access_token` cookie to the NestJS JWT guard.

### Pattern 4: Channel Subscription Hook (React)

**What:** Subscribe to a private channel when a conversation is selected; unsubscribe on cleanup.

```typescript
// frontend/lib/hooks/use-pusher-channel.ts
'use client';

import { useEffect, useRef } from 'react';
import type { Channel } from 'pusher-js';
import { getPusherClient } from '@/lib/pusher-client';

export function usePusherChannel(channelName: string | null) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!channelName) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    return () => {
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [channelName]);

  return channelRef;
}
```

### Pattern 5: Typing Indicator (Client Events)

**What:** Sender triggers `client-typing` on the private channel directly — no server round-trip. Receiver displays a timeout-cleared indicator.
**When to use:** Every keydown in compose textarea.

Sender (compose-area.tsx):
```typescript
// Source: https://pusher.com/tutorials/typing-indicator-javascript/
const typingThrottleRef = useRef(false);

function handleKeyDown() {
  if (!typingThrottleRef.current && channel) {
    channel.trigger('client-typing', { userId: currentUser.id, name: currentUser.name });
    typingThrottleRef.current = true;
    setTimeout(() => { typingThrottleRef.current = false; }, 2000); // throttle: fire max every 2s
  }
}
```

Receiver (message-thread.tsx):
```typescript
const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

channel.bind('client-typing', (data: { userId: string; name: string }) => {
  if (data.userId === currentUser.id) return; // ignore self
  setTypingUser(data.name);
  if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  clearTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
});
```

**Requirement:** Client events must be enabled in the Pusher dashboard (Settings → Enable client events). They only work on private channels (already the case with `private-chat-*`).

### Pattern 6: Read Receipt Update Flow

**What:** When a user opens a conversation thread, mark all unread messages as read by updating `last_read_at` on their `ConversationParticipant` row. Then trigger a Pusher event so senders can update their check marks.

```
User opens conversation
  → PATCH /chat/conversations/{id}/read   (sets last_read_at = now())
  → ChatService.markRead() updates ConversationParticipant.last_read_at
  → PusherService.trigger(`private-chat-{id}`, 'message-read', { userId, readAt })
  → All subscribers (including sender) receive event and re-render read receipts
```

On the frontend, a message's read status is derived:
```typescript
// A message is "read" if all non-sender participants have last_read_at > message.created_at
const isRead = participants
  .filter(p => p.user_id !== message.sender_id)
  .every(p => p.last_read_at && p.last_read_at > message.created_at);
```

### Pattern 7: Admin All-Conversations View

**What:** Admin/tech see ALL conversations in a second tab. For reading another user's thread, the admin subscribes to `private-chat-{conversationId}` and gets authorized because the server-side auth endpoint bypasses membership check for their role. Admin fetches messages via a separate admin endpoint that skips participant validation.

```typescript
// Admin-only fetch endpoint — no participant check
@Get('admin/conversations')
@RequiresPermission(Permission.MANAGE_SYSTEM)
async getAllConversations() { ... }

@Get('admin/conversations/:id/messages')
@RequiresPermission(Permission.MANAGE_SYSTEM)
async getAnyMessages(@Param('id') id: string) { ... }
```

### Anti-Patterns to Avoid

- **Triggering Pusher in a controller directly:** Always inject `PusherService` into `ChatService`, trigger after database write in the service layer — not in the controller.
- **Re-instantiating Pusher per request in NestJS:** The service must be `@Injectable()` (singleton by default in NestJS). Do not `new Pusher(...)` inside a method.
- **Using the default `ajax` transport without cookie forwarding:** The standard `channelAuthorization.endpoint` config sends form-encoded POST without cookies. Use `customHandler` with `credentials: 'include'` for cookie-based JWT auth.
- **Subscribing to a channel on every render:** The subscription hook must use `useEffect` with cleanup to unsubscribe. Multiple subscriptions to the same channel are legal in Pusher but wasteful.
- **Using `offset`-based pagination for messages:** New messages shift offsets; use cursor (`take: 30, cursor: { id: lastMessageId }, skip: 1, orderBy: { created_at: 'asc' }`).
- **Blocking the admin auth check on membership:** Admins must bypass membership lookup entirely — do NOT return a 403 to admin users who are not participants.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Channel authentication signature | Custom HMAC signing | `pusher.authorizeChannel(socketId, channel)` | Pusher uses specific HMAC-SHA256 format that custom implementations routinely get wrong |
| WebSocket connection management | Socket.io server or native ws | Pusher hosted infrastructure | Reconnection, fallbacks, TLS, scaling — all handled by Pusher |
| Typing indicator server broadcast | POST /typing endpoint + trigger | `channel.trigger('client-typing', data)` | Client events bypass the server entirely — zero latency, zero DB write |
| Read receipt timestamps per message | MessageRead join table | `last_read_at` on ConversationParticipant | Per-message tracking is only needed when you need "read by whom at what time" per message; last_read_at is sufficient for double-check mark display |
| Image/file upload for attachments | Custom upload logic | Reuse `StorageService.generatePresignedPutUrl()` | Already handles MIME validation, R2 signing, key construction |

**Key insight:** Pusher's client events feature (typing indicators) completely removes the need for a server-side typing broadcast endpoint. The client talks directly to Pusher's servers, which fan-out to other subscribers. This is the canonical pattern.

---

## Prisma Schema (Recommended)

```prisma
model Conversation {
  id           String                    @id @default(uuid())
  type         String                    // "direct" | "group"
  name         String?                   // null for 1-1 chats, required for groups
  avatar_key   String?                   // R2 key for group avatar (optional)
  created_by   String                    // user_id of creator
  created_at   DateTime                  @default(now())
  updated_at   DateTime                  @updatedAt
  participants ConversationParticipant[]
  messages     Message[]

  @@index([created_by])
  @@index([updated_at(sort: Desc)])       // conversation list sorted by recent activity
}

model ConversationParticipant {
  id              String       @id @default(uuid())
  conversation_id String
  conversation    Conversation @relation(fields: [conversation_id], references: [id])
  user_id         String
  user            User         @relation(fields: [user_id], references: [id])
  last_read_at    DateTime?    // null = never read; used for read receipts
  joined_at       DateTime     @default(now())

  @@unique([conversation_id, user_id])     // one row per user per conversation
  @@index([user_id])
  @@index([conversation_id])
}

model Message {
  id              String       @id @default(uuid())
  conversation_id String
  conversation    Conversation @relation(fields: [conversation_id], references: [id])
  sender_id       String
  sender          User         @relation(fields: [sender_id], references: [id])
  content         String?      @db.Text    // nullable if message is attachment-only
  attachment_key  String?      // R2 key
  attachment_url  String?      // public R2 URL
  attachment_name String?      // original filename for file attachments
  attachment_type String?      // "image" | "file"
  created_at      DateTime     @default(now())

  @@index([conversation_id, created_at(sort: Desc)])
  @@index([sender_id])
}
```

Add to `User` model:
```prisma
chat_participations   ConversationParticipant[]
sent_messages         Message[]
```

**Schema decisions:**
- `last_read_at` per participant (not per message): simpler, sufficient for double-check mark display at this team size. This matches the Twilio Conversations "Read Horizon" pattern.
- Single `attachment_*` column set per message (not a separate Attachment model): messages only ever have one attachment per message; no many-to-many needed.
- `Message.content` is nullable: allows image-only messages with no text.
- No `updated_at` on Message: messages are immutable (D-08).
- `Conversation.updated_at` auto-updates on PATCH; use this to sort conversation list by most recent activity.

---

## Environment Variables

Add to `backend/.env` and `frontend/.env`:

```bash
# Backend (.env)
PUSHER_APP_ID=<app_id>
PUSHER_KEY=<key>
PUSHER_SECRET=<secret>
PUSHER_CLUSTER=<cluster>   # e.g. ap2

# Frontend (.env.local)
NEXT_PUBLIC_PUSHER_KEY=<key>       # same as PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER=<cluster>
```

Add to `backend/.env.example`:
```bash
# Pusher (Real-time chat)
PUSHER_APP_ID=<app_id>
PUSHER_KEY=<key>
PUSHER_SECRET=<secret>
PUSHER_CLUSTER=ap2
```

---

## Common Pitfalls

### Pitfall 1: Cookie Not Forwarded to Pusher Auth Endpoint

**What goes wrong:** The default `channelAuthorization.endpoint` uses XHR but does not set `credentials: 'include'`. The NestJS JWT guard gets no cookie and returns 401, causing subscription to fail silently.
**Why it happens:** Pusher's built-in AJAX transport does not expose a `withCredentials` option in the standard config.
**How to avoid:** Use `channelAuthorization.customHandler` with a `fetch()` call that includes `credentials: 'include'`. The custom handler receives `{ socketId, channelName, callback }` and must call `callback(null, authData)` or `callback(error, null)`.
**Warning signs:** Browser network tab shows a 401 on `/chat/auth`; channel fires `pusher:subscription_error`.

### Pitfall 2: Client Events Not Enabled in Dashboard

**What goes wrong:** `channel.trigger('client-typing', data)` silently fails. No error in console.
**Why it happens:** Pusher disables client events by default per app for security.
**How to avoid:** Go to Pusher Dashboard → Your App → App Settings → check "Enable client events". This is a one-time setup step.
**Warning signs:** Typing indicators never appear for recipients; no console errors.

### Pitfall 3: PusherService Instantiated Per-Request

**What goes wrong:** Each message create call creates a new `Pusher` HTTP client instance, establishing fresh HTTP connections. Under load, connection pool exhaustion.
**Why it happens:** Developer follows old tutorials that do `const pusher = new Pusher(...)` inside a service method.
**How to avoid:** Instantiate once in the `constructor` of `@Injectable()` PusherService. NestJS services are singletons by default.

### Pitfall 4: Multiple pusher-js Instances in React

**What goes wrong:** Each component that imports `new Pusher(...)` creates a new WebSocket connection. 10 conversations = 10 connections.
**Why it happens:** Pusher client created per component instead of as a singleton.
**How to avoid:** Export a `getPusherClient()` function from `frontend/lib/pusher-client.ts` that returns a cached instance behind a `typeof window` guard.

### Pitfall 5: Subscribing in the Wrong Lifecycle

**What goes wrong:** Subscription is created inside a component but never unsubscribed, accumulating zombie listeners on navigation.
**Why it happens:** Missing cleanup in `useEffect` return.
**How to avoid:** Always return `() => pusher.unsubscribe(channelName)` from the `useEffect`. Use the `usePusherChannel` hook pattern so cleanup is handled in one place.

### Pitfall 6: Conversation List Not Updating on New Message

**What goes wrong:** A new message arrives via Pusher but the conversation list (showing last message preview + timestamp) doesn't update.
**Why it happens:** The list is fetched with React Query; Pusher events update the thread but not the list cache.
**How to avoid:** On receiving a `new-message` Pusher event, call `queryClient.invalidateQueries({ queryKey: ['conversations'] })` to refetch the list. Alternatively update the cache directly with `queryClient.setQueryData`.

### Pitfall 7: Admin Auth Without Membership Check

**What goes wrong:** Admin tries to read another user's conversation, gets 403 from auth endpoint because they're not a `ConversationParticipant`.
**Why it happens:** Membership check runs before role check.
**How to avoid:** Always check role FIRST, return auth token immediately for FOUNDER_ADMIN and TECH_LEAD, skip the participant lookup entirely.

### Pitfall 8: NestJS Request Body Parsing for Pusher Auth

**What goes wrong:** `dto.socket_id` is undefined because Pusher's default transport sends form-encoded data, but NestJS parses JSON by default.
**Why it happens:** The standard `channelAuthorization.endpoint` sends `application/x-www-form-urlencoded`. The `customHandler` approach with JSON avoids this.
**How to avoid:** With the `customHandler` pattern (JSON body), use `@Body() dto: PusherAuthDto` as normal. If you ever use the default Pusher transport, add `app.use(express.urlencoded({ extended: false }))` in main.ts.

---

## Code Examples

### Triggering a New Message Event

```typescript
// Source: https://github.com/pusher/pusher-http-node
// After saving message to DB:
await this.pusherService.trigger(
  `private-chat-${message.conversation_id}`,
  'new-message',
  {
    id: message.id,
    sender_id: message.sender_id,
    sender_name: senderUser.name,
    content: message.content,
    attachment_url: message.attachment_url,
    attachment_type: message.attachment_type,
    attachment_name: message.attachment_name,
    created_at: message.created_at.toISOString(),
  },
);
```

### Subscribing and Receiving Messages (React)

```typescript
// Source: https://github.com/pusher/pusher-js
useEffect(() => {
  if (!conversationId) return;
  const pusher = getPusherClient();
  const channel = pusher.subscribe(`private-chat-${conversationId}`);

  channel.bind('new-message', (data: MessagePayload) => {
    queryClient.setQueryData<Message[]>(
      ['messages', conversationId],
      (old) => [...(old ?? []), data],
    );
    scrollToBottom();
  });

  channel.bind('message-read', (data: { userId: string; readAt: string }) => {
    // Re-derive read status from updated last_read_at
    queryClient.invalidateQueries({ queryKey: ['participants', conversationId] });
  });

  return () => {
    channel.unbind_all();
    pusher.unsubscribe(`private-chat-${conversationId}`);
  };
}, [conversationId]);
```

### Cursor Pagination for Messages

```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/pagination
// Backend: GET /chat/conversations/:id/messages?cursor=<messageId>&limit=30
async getMessages(conversationId: string, cursor?: string, limit = 30) {
  return this.prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: 'asc' },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, name: true } },
    },
  });
}
```

### Determining Unread Count for Conversation List

```typescript
// Count messages in conversation created AFTER the user's last_read_at
async getUnreadCount(conversationId: string, userId: string): Promise<number> {
  const participant = await this.prisma.conversationParticipant.findFirst({
    where: { conversation_id: conversationId, user_id: userId },
    select: { last_read_at: true },
  });
  if (!participant) return 0;
  return this.prisma.message.count({
    where: {
      conversation_id: conversationId,
      created_at: { gt: participant.last_read_at ?? new Date(0) },
      sender_id: { not: userId }, // don't count own messages as unread
    },
  });
}
```

### Finding or Creating a 1-1 Conversation

```typescript
async findOrCreateDirect(userAId: string, userBId: string): Promise<Conversation> {
  // Find existing direct conversation between exactly these two users
  const existing = await this.prisma.conversation.findFirst({
    where: {
      type: 'direct',
      AND: [
        { participants: { some: { user_id: userAId } } },
        { participants: { some: { user_id: userBId } } },
      ],
    },
    include: { participants: true },
  });
  // Verify exactly 2 participants (not a group that happens to include both)
  if (existing && existing.participants.length === 2) return existing;

  return this.prisma.conversation.create({
    data: {
      type: 'direct',
      created_by: userAId,
      participants: {
        create: [
          { user_id: userAId },
          { user_id: userBId },
        ],
      },
    },
    include: { participants: true },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `new Pusher({ encrypted: true })` | `new Pusher({ useTLS: true })` | pusher v5+ | `encrypted` is deprecated; use `useTLS` |
| `pusher.authenticate()` | `pusher.authorizeChannel()` | pusher v5 | Method renamed; old name still works but deprecated |
| `pusher.authEndpoint` (client) | `channelAuthorization.endpoint` | pusher-js v7.4+ | Old `authEndpoint` key still works but deprecated |
| Form-encoded Pusher auth POST | JSON body via `customHandler` | pusher-js v8+ | Custom handler allows full control over auth request format |
| React `setState` pattern for messages | React Query + Pusher event to invalidate | 2023+ | Keeps REST and real-time in sync without manual merging |

**Deprecated/outdated:**
- `encrypted: true` in Pusher server config: use `useTLS: true`
- `pusher.authenticate(socketId, channel)`: use `pusher.authorizeChannel(socketId, channel)`
- Tutorial patterns with `@Component()` (old NestJS): use `@Injectable()`

---

## Next.js 16 Relevant Notes

This project uses Next.js 16.2.0 (confirmed in `frontend/package.json`). The chat page is a `'use client'` page — it does NOT use `params` or `searchParams` async APIs. No breaking changes affect it specifically. Key notes:

- **Turbopack by default:** `next dev` uses Turbopack. No webpack config in this project, so no conflict.
- **middleware → proxy:** Not relevant to this phase (no middleware changes needed).
- **Async params:** Not relevant (chat page uses no URL params for data fetching — conversation selection is client state).
- **SSR + pusher-js:** `getPusherClient()` uses `typeof window === 'undefined'` guard. Do not import pusher-js in any Server Component. The `/chat/page.tsx` must be `'use client'`.

---

## Validation Architecture

nyquist_validation is enabled (config.json → workflow.nyquist_validation: true).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (backend — configured in backend/package.json) |
| Config file | backend/package.json → jest section |
| Quick run command | `cd backend && npx jest --testPathPattern=chat --passWithNoTests` |
| Full suite command | `cd backend && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-schema | Prisma migration applies cleanly | smoke | `cd backend && npx prisma migrate dev --name chat --create-only` | Wave 0 |
| CHAT-auth | Auth endpoint returns 200 + auth token for participant, 403 for non-participant | unit | `npx jest chat.controller.spec --passWithNoTests` | Wave 0 |
| CHAT-admin | Auth endpoint returns 200 for FOUNDER_ADMIN regardless of participation | unit | `npx jest chat.controller.spec --passWithNoTests` | Wave 0 |
| CHAT-create-message | Message saved to DB and Pusher.trigger called | unit | `npx jest chat.service.spec --passWithNoTests` | Wave 0 |
| CHAT-read-receipt | markRead updates last_read_at and triggers message-read event | unit | `npx jest chat.service.spec --passWithNoTests` | Wave 0 |
| CHAT-find-direct | findOrCreateDirect is idempotent (same conversation returned on second call) | unit | `npx jest chat.service.spec --passWithNoTests` | Wave 0 |

Frontend tests are not in scope for this project's test setup (no Jest/Vitest config in frontend/). Manual verification via browser suffices.

### Sampling Rate

- **Per task commit:** `cd backend && npx jest --testPathPattern=chat --passWithNoTests`
- **Per wave merge:** `cd backend && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/chat/chat.service.spec.ts` — covers CHAT-create-message, CHAT-read-receipt, CHAT-find-direct
- [ ] `backend/src/chat/chat.controller.spec.ts` — covers CHAT-auth, CHAT-admin
- [ ] Prisma migration: `backend/prisma/migrations/` will need new migration file for Conversation/Message/ConversationParticipant models

---

## Sources

### Primary (HIGH confidence)
- https://github.com/pusher/pusher-http-node — pusher server Node.js SDK v5.3.3 README; constructor options, trigger(), authorizeChannel()
- https://github.com/pusher/pusher-js — pusher-js client v8.4.3 README; channelAuthorization, customHandler, client events API
- https://pusher.com/docs/channels/server_api/authorizing-users/ — auth endpoint format: receives socket_id + channel_name, returns { auth: "..." }
- https://pusher.com/tutorials/typing-indicator-javascript/ — typing indicator throttle + timeout pattern
- https://nextjs.org/docs/app/guides/upgrading/version-16 — Next.js 16.2 upgrade guide; async APIs, Turbopack, middleware→proxy
- `backend/package.json` — confirmed pusher not yet installed, versions verified via npm view

### Secondary (MEDIUM confidence)
- https://pusher.com/docs/channels/using_channels/events/ — client events naming convention (must prefix `client-`), rate limit (10/sec/client), private channels only
- https://ably.com/topic/read-receipts — read receipts patterns: last_read_at per participant vs per-message analysis

### Tertiary (LOW confidence)
- WebSearch result re: singleton pattern in Next.js App Router — multiple sources agree `globalThis` / module-level variable works for client-side singletons in App Router

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm view confirmed pusher 5.3.3, pusher-js 8.4.3; both already in project's peer ecosystem
- Architecture: HIGH — auth flow verified against official Pusher docs; NestJS singleton pattern is project-standard
- Prisma schema: HIGH — Prisma v6 docs verified; schema follows existing project conventions
- Pitfalls: HIGH — cookie forwarding pitfall verified by Pusher docs (customHandler); client events pitfall verified by Pusher docs (must enable in dashboard)

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (Pusher API is stable; Next.js 16 is current)
