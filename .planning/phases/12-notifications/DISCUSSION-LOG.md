# Phase 12: Notifications — Discussion Log

**Date:** 2026-03-22
**Areas discussed:** Delivery mechanism, Notification triggers, Frontend notification UX, Notification persistence

---

## Area 1: Delivery mechanism

**Q: How should notifications reach users?**
Options: In-app only (Recommended) | In-app + email critical | In-app + email all
**Selected:** In-app + email for critical alerts

**Q: Which notifications count as critical?**
Options (multi): Task overdue | Approval pending 24h+ | Low stock | Task blocked
**Selected:** All four

**Q: BullMQ + Redis or simpler approach?**
Options: Direct DB + cron (Recommended) | BullMQ + Redis | In-memory queue
**Selected:** BullMQ + Redis

**Q: Where will Redis run?**
Options: Upstash Redis (Recommended) | Docker | Railway/Render
**Selected:** Upstash Redis

---

## Area 2: Notification triggers

**Q: Time-based trigger frequency?**
Options: Hourly cron (Recommended) | Every 15 min | Twice daily
**Selected:** Cron job every hour

**Q: Event-driven trigger approach?**
Options: Inline at action (Recommended) | NestJS EventEmitter | DB polling
**Selected:** NestJS EventEmitter

**Q: Duplicate suppression?**
Options: Dedup with cooldown (Recommended) | Fire every cycle | One-shot only
**Selected:** Yes, deduplicate with cooldown

**Q: NOTF-05 KDS alert approach?**
Options: Both bell + KDS flash (Recommended) | KDS only | Bell only
**Selected:** Both: bell + KDS visual flash

---

## Area 3: Frontend notification UX

**Q: Bell and panel design?**
Options: Bell + dropdown (Recommended) | Bell + slide-over | Page only
**Selected:** Bell icon + dropdown panel

**Q: Polling frequency?**
Options: 30s (Recommended) | 60s | On navigation only
**Selected:** 30-second polling

**Q: Click action?**
Options: Deep link (Recommended) | Mark read only | Expand inline
**Selected:** Yes, deep link to source

**Q: Dedicated history page?**
Options: Under Admin (Recommended) | No page | Accessible to all
**Selected:** Yes, accessible to all users

---

## Area 4: Notification persistence

**Q: Retention period?**
Options: 30-day (Recommended) | Keep forever | 7-day
**Selected:** 30-day retention with auto-cleanup

**Q: Per-user preferences?**
Options: No preferences v1 (Recommended) | Basic mute | Full matrix
**Selected:** No per-user preferences for v1

**Q: Role-based routing?**
Options: Role-based (Recommended) | Broadcast with permission | Admin sees all
**Selected:** Role-based routing
