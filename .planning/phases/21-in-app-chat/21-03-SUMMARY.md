---
phase: 21-in-app-chat
plan: 03
subsystem: ui
tags: [react, next.js, pusher-js, chat, typescript, tanstack-query, shadcn]

# Dependency graph
requires:
  - phase: 21-in-app-chat
    plan: 01
    provides: "Prisma chat models, PusherService, auth endpoint, DTOs, types"
  - phase: 21-in-app-chat
    plan: 02
    provides: "ChatService CRUD, ChatController REST endpoints, cursor pagination, admin oversight"
provides:
  - "Chat TypeScript types (Conversation, Message, ConversationParticipant, MessagesResponse)"
  - "Pusher client singleton with cookie auth forwarding via customHandler"
  - "Chat layout overriding ops padding for full-height split panel"
  - "Chat sidebar nav item for all authenticated users"
  - "ConversationList component with admin tabs (My Chats / All Conversations)"
  - "ConversationItem with avatar, name, preview, timestamp, unread indicator"
  - "NewChatDialog for 1-1 conversation creation with Command user picker"
  - "NewGroupDialog for group creation with multi-select (admin only)"
  - "ChatEmptyState for no-selection and no-conversations states"
  - "ConversationListSkeleton loading state"
  - "Chat page with split-panel layout and mobile responsive views"
affects: [21-04]

# Tech tracking
tech-stack:
  added: [pusher-js@^8.4.0-rc2]
  patterns: [pusher-client-singleton-with-custom-handler, split-panel-chat-layout, admin-tabs-conversation-list, mobile-thread-toggle]

key-files:
  created:
    - frontend/lib/types/chat.ts
    - frontend/lib/pusher-client.ts
    - frontend/app/(ops)/chat/layout.tsx
    - frontend/app/(ops)/chat/page.tsx
    - frontend/components/ops/chat/ConversationList.tsx
    - frontend/components/ops/chat/ConversationItem.tsx
    - frontend/components/ops/chat/NewChatDialog.tsx
    - frontend/components/ops/chat/NewGroupDialog.tsx
    - frontend/components/ops/chat/ChatEmptyState.tsx
    - frontend/components/ops/chat/ConversationListSkeleton.tsx
  modified:
    - frontend/components/ops/Sidebar.tsx
    - frontend/package.json

key-decisions:
  - "Pusher client uses customHandler (not default ajax transport) to forward cookies via credentials: 'include' -- per Research Pitfall 1"
  - "Chat layout uses negative margins (-m-4 sm:-m-6) to break out of ops layout padding for full-height panel"
  - "DropdownMenuTrigger uses className directly (not asChild) since base-ui does not support asChild prop"
  - "ConversationItem unread badge uses dot indicator (bullet) instead of count -- simpler for 8-person team"
  - "Admin sees dropdown menu on New Chat button with 'New Chat' and 'New Group Chat' options; non-admin gets direct dialog open"

patterns-established:
  - "Split-panel chat layout pattern: 320px left conversation list + flex-1 right thread area"
  - "Mobile responsive toggle: mobileShowThread state switches between list and thread views below lg breakpoint"
  - "Admin tab pattern: Tabs with 'My Chats' (GET /chat/conversations) and 'All Conversations' (GET /chat/admin/conversations)"
  - "Conversation display name derivation: direct chats show other participant's name, groups show conversation.name"

requirements-completed: [CHAT-03, CHAT-04, CHAT-05, CHAT-06]

# Metrics
duration: 11min
completed: 2026-03-23
---

# Phase 21 Plan 03: Chat Frontend Foundation Summary

**Split-panel /chat page with conversation list, admin tabs, 1-1 and group chat creation dialogs, Pusher client singleton with cookie auth, TypeScript types, and sidebar nav entry**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-23T13:43:01Z
- **Completed:** 2026-03-23T13:54:22Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Full chat frontend foundation with 10 new files and 2 modified files
- Split-panel layout (320px left panel + flex-1 right panel) with mobile responsive toggle
- Admin/tech users see "My Chats" and "All Conversations" tabs with section dividers in admin view
- 1-1 chat creation via Command user picker dialog, group chat creation via multi-select dialog (admin only)
- Pusher client singleton with customHandler for cookie-based auth forwarding
- Chat nav item in sidebar for all authenticated users

## Task Commits

Files created but commits pending due to parallel execution git contention:

1. **Task 1: Types, Pusher client, chat layout, sidebar nav entry** - PENDING
2. **Task 2: Chat page, ConversationList, dialogs, empty states** - PENDING

Note: Page.tsx was enhanced by the parallel Plan 04 agent to include MessageThread integration. ConversationList was enhanced with onActiveTabChange prop for admin read-only detection.

## Files Created/Modified
- `frontend/lib/types/chat.ts` - TypeScript types: Conversation, Message, ConversationParticipant, MessagesResponse, ChatUser
- `frontend/lib/pusher-client.ts` - Pusher client singleton with customHandler for cookie auth forwarding
- `frontend/app/(ops)/chat/layout.tsx` - Chat layout overriding ops padding with negative margins for full-height
- `frontend/app/(ops)/chat/page.tsx` - Main chat page with split-panel layout, mobile toggle, admin detection (enhanced by Plan 04)
- `frontend/components/ops/chat/ConversationList.tsx` - Left panel with admin tabs, new chat buttons, conversation rendering
- `frontend/components/ops/chat/ConversationItem.tsx` - Conversation row: avatar, name, preview, relative timestamp, unread badge
- `frontend/components/ops/chat/NewChatDialog.tsx` - Dialog for 1-1 conversations with Command user picker
- `frontend/components/ops/chat/NewGroupDialog.tsx` - Dialog for group conversations with name input and multi-select (admin only)
- `frontend/components/ops/chat/ChatEmptyState.tsx` - Empty states for no-selection (right panel) and no-conversations (list)
- `frontend/components/ops/chat/ConversationListSkeleton.tsx` - 5-row skeleton loading state
- `frontend/components/ops/Sidebar.tsx` - Added Chat nav item (MessageSquare icon) after Guide in overviewNav array
- `frontend/package.json` - Added pusher-js@^8.4.0-rc2 dependency

## Decisions Made
- Pusher client uses customHandler (not default ajax transport) to forward cookies via `credentials: 'include'` -- standard ajax transport in pusher-js does not send cookies
- Chat layout uses negative margins (-m-4 sm:-m-6) to break out of ops layout padding constraint
- DropdownMenuTrigger uses className directly instead of asChild since base-ui Menu.Trigger does not support the asChild pattern
- ConversationItem unread indicator uses a dot/bullet rather than numeric count -- simpler and sufficient for an 8-person team
- Admin sees a dropdown menu with "New Chat" / "New Group Chat" options; non-admin users get direct dialog open on Plus button click

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed DropdownMenuTrigger asChild incompatibility**
- **Found during:** Task 2 (ConversationList component)
- **Issue:** Plan specified `asChild` prop on DropdownMenuTrigger, but project uses base-ui which does not support asChild
- **Fix:** Used className-based styling directly on DropdownMenuTrigger instead of wrapping Button with asChild
- **Files modified:** frontend/components/ops/chat/ConversationList.tsx
- **Verification:** Consistent with how Sidebar.tsx uses DropdownMenuTrigger

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor API pattern fix. No scope creep.

## Issues Encountered
- Git write operations (add, commit) and npm install blocked by sandbox permissions during parallel agent execution. All files created successfully via Write tool but commits are pending. The parallel Plan 04 agent was able to commit, indicating this is an agent-instance-specific permission issue.
- npm install for pusher-js could not run -- package.json updated but node_modules not installed. Requires manual `cd frontend && npm install` before TypeScript compilation.

## User Setup Required

**Run npm install** after checking out these changes:
```bash
cd frontend && npm install
```
This will install the pusher-js dependency added to package.json.

## Known Stubs

None - all components are fully wired to real API endpoints via React Query. The right panel shows a placeholder message ("Message thread coming in Plan 04") only because MessageThread was being built by the parallel Plan 04 agent, which has since been integrated into page.tsx.

## Next Phase Readiness
- Chat frontend foundation complete: all left-panel components, dialogs, layout, and navigation ready
- Plan 04 (MessageThread, ComposeArea, real-time) has been built in parallel and already integrated into page.tsx
- Pusher client singleton ready for subscription in Plan 04 components
- All chat TypeScript types defined and consumed by both Plan 03 and Plan 04 components

## Self-Check: PASSED

All 12 created/modified files verified on disk:
- frontend/lib/types/chat.ts - FOUND
- frontend/lib/pusher-client.ts - FOUND
- frontend/app/(ops)/chat/layout.tsx - FOUND
- frontend/app/(ops)/chat/page.tsx - FOUND
- frontend/components/ops/chat/ConversationList.tsx - FOUND
- frontend/components/ops/chat/ConversationItem.tsx - FOUND
- frontend/components/ops/chat/NewChatDialog.tsx - FOUND
- frontend/components/ops/chat/NewGroupDialog.tsx - FOUND
- frontend/components/ops/chat/ChatEmptyState.tsx - FOUND
- frontend/components/ops/chat/ConversationListSkeleton.tsx - FOUND
- frontend/components/ops/Sidebar.tsx - FOUND
- frontend/package.json - FOUND
- .planning/phases/21-in-app-chat/21-03-SUMMARY.md - FOUND

Commits pending due to parallel execution sandbox restrictions on git write operations.

---
*Phase: 21-in-app-chat*
*Completed: 2026-03-23*
