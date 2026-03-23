# Phase 21: In-App Chat - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time 1-1 and group messaging using Pusher.js. Users can start 1-1 chats, admin creates group chats, admin/tech can view all conversations via a separate admin view, normal users see only their own. Supports text, images, and file attachments.

Requirements: TBD (to be defined during planning)

</domain>

<decisions>
## Implementation Decisions

### Chat UI Layout
- **D-01:** Dedicated `/chat` page — full page with conversation list on left, message thread on right (Slack/Teams style)
- **D-02:** Conversation list style is Claude's discretion — avatar + name + preview or compact list
- **D-03:** No chat badge/indicator in sidebar — users navigate to /chat to check messages
- **D-04:** "Chat" nav item added to ops sidebar for all authenticated users

### Message Features
- **D-05:** Messages support text + images + file attachments (reuse R2 presign pattern for uploads)
- **D-06:** Typing indicator ("X is typing...") via Pusher client events
- **D-07:** Read receipts — double-check marks when message is read by recipient(s)
- **D-08:** Messages are permanent — no edit, no delete. Good for accountability in a work context
- **D-09:** Real-time delivery via Pusher.js channels — messages appear instantly without refresh

### Conversation Management
- **D-10:** 1-1 chats: any user can start a chat with any other active user
- **D-11:** Group chats: only admin (FOUNDER_ADMIN) can create groups — picks members and sets group name
- **D-12:** Admin can add or remove members from group chats at any time
- **D-13:** No mute, no archive — all conversations always visible (8-person team, manageable volume)
- **D-14:** Group chats have a name and optional icon/avatar

### Oversight / Admin Access
- **D-15:** Separate admin view — admin/tech see their own chats normally + a separate "All Conversations" tab to browse anyone's chats
- **D-16:** "All Conversations" tab available only to FOUNDER_ADMIN and TECH_LEAD
- **D-17:** Policy notice in chat: "Conversations may be reviewed by admins for operational purposes"
- **D-18:** Admin viewing another user's chat is read-only — cannot send messages on their behalf

### Pusher.js Configuration
- **D-19:** Pusher.js for real-time events — message delivery, typing indicators, read receipts, presence
- **D-20:** One Pusher channel per conversation (private channel: `private-chat-{conversationId}`)
- **D-21:** Pusher server-side (NestJS) triggers events; client-side subscribes
- **D-22:** Client events for typing indicators (no server round-trip needed)

### Claude's Discretion
- Conversation list design (avatar + preview vs compact)
- Message bubble styling and layout
- File/image attachment preview in messages
- Pusher channel naming conventions
- Database schema for conversations, messages, participants
- Pagination strategy for message history (cursor-based recommended)
- How to handle conversation creation UX (new chat button, user picker)
- Read receipt data model (per-message or per-conversation last-read timestamp)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Infrastructure
- `backend/src/notifications/notifications.service.ts` — Existing notification pattern (broadcast, per-user creation)
- `backend/src/storage/storage.service.ts` — R2 presign pattern for file/image uploads
- `backend/src/storage/storage.controller.ts` — Presign endpoint (reuse for chat attachments)
- `backend/src/auth/jwt.strategy.ts` — JWT auth pattern (req.user.id, req.user.roleCode)
- `backend/src/types/permissions.ts` — Permission enum (may need MANAGE_CHAT or use MANAGE_SYSTEM)
- `backend/src/types/roles.ts` — Role codes for admin/tech oversight check

### Frontend Patterns
- `frontend/components/ops/Sidebar.tsx` — Where to add Chat nav item
- `frontend/lib/api-client.ts` — API client with auth cookies
- `frontend/lib/stores/auth-store.ts` — User role info for admin checks
- `frontend/lib/providers.tsx` — React Query setup (for message fetching)

### Research Needed
- Pusher.js setup in NestJS (server-side SDK)
- Pusher.js React client hooks
- Private channel authentication pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StorageService` presign pattern — reuse for chat image/file uploads
- `NotificationBell` polling pattern — reference for real-time UX (though Pusher replaces polling)
- Auth store with role info — for admin/tech oversight visibility checks
- Existing admin page patterns — for the "All Conversations" admin tab

### Established Patterns
- NestJS module pattern (controller → service → Prisma)
- React Query for data fetching + cache invalidation
- Sonner toast for success/error
- `@RequiresPermission()` for RBAC gating
- Sheet/Dialog patterns from shadcn for forms

### Integration Points
- New `ChatModule` in NestJS (conversations, messages, participants)
- New Prisma models (Conversation, Message, ConversationParticipant)
- New `/chat` frontend route with split-panel layout
- Sidebar nav — add "Chat" item for all users
- Pusher.js server SDK in backend, client SDK in frontend
- R2 presign endpoint for chat attachments

</code_context>

<specifics>
## Specific Ideas

- 8-person team so chat volume is manageable — no need for complex threading or search
- Messages are permanent (no edit/delete) for workplace accountability
- Admin oversight is transparent (policy notice) but accessed via separate tab (not mixed into normal chat)
- Pusher.js handles all real-time — no need for WebSocket server setup

</specifics>

<deferred>
## Deferred Ideas

- Message search/filtering — Future
- Message reactions (emoji) — Future
- Thread replies within messages — Future
- Chat notifications (push/email) — Future
- Voice/video calls — Future
- Chat export/download — Future
- Pinned messages in groups — Future

</deferred>

---

*Phase: 21-in-app-chat*
*Context gathered: 2026-03-23*
