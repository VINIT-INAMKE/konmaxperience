# R2 lifecycle (RUN-06)

> Companion to `CLOUDFLARE-SETUP.md`, which covers the bucket itself and the
> `R2_*` environment variables. This file covers only what happens to objects
> **after** they are written: what expires on a schedule, what is swept by code,
> and what is never removed by either.

Two mechanisms remove objects from the bucket, and they do not overlap.

| Mechanism | Where it lives | What it touches |
|---|---|---|
| Object lifecycle rule `expire-exports-30d` | Cloudflare dashboard (manual, once) | `exports/` only |
| `OrphanSweepCron` — weekly, Sunday 04:00 node-local | `backend/src/storage/orphan-sweep.cron.ts` | Unreferenced objects under `evidence/`, `exports/`, `product-media/` |

Nothing else in this repository deletes from R2.

---

## 1. The `exports/` lifecycle rule

`ExportsService` writes one object per generated report under
`exports/{reportType}/{YYYYMMDD}/…`, and every one of them is reproducible on
demand from the same data. Keeping them forever is paying rent on a cache.

**There is no API call in this repository that sets this rule** — Cloudflare
object lifecycle rules are configured in the dashboard, and this is the only
step in RUN-06 that a human has to perform once:

**R2 → your bucket → Settings → Object lifecycle rules → Add rule**

| Field | Value |
|---|---|
| Rule name | `expire-exports-30d` |
| Prefix | `exports/` |
| Action | Delete uploaded objects |
| Days after upload | `30` |

Keep the rule name exactly as written. It is the only handle anyone auditing the
bucket has for tying the deletions back to this document.

The corresponding `ExportRecord` rows are **not** deleted with the object. The
row is the record that a report was generated, by whom and for what window; the
file is just its output. A download link older than 30 days returns 404, and
regenerating the report writes a fresh object.

## 2. What is never lifecycled

`evidence/` and product media are **never** put on a lifecycle rule, and no rule
may be added for them later without a decision that supersedes this one:

- **`evidence/`** is the proof behind an approval. `Evidence.url` is referenced
  from an approval trail that has no expiry, and a task validated in March whose
  photo silently vanished in April is an audit failure, not a storage saving.
- **`product-media/`** is referenced by a live storefront. A published product
  whose hero image expired is a broken shop page.
- **`assets/`, `guide/` and `chat/`** are not swept and not lifecycled either.
  Their volume is negligible and their rows are long-lived.

The orphan sweep is the only thing that removes objects under these prefixes,
and it removes only objects that **no database row points at**.

## 3. The weekly orphan sweep

`OrphanSweepCron` (`0 4 * * 0`, node timezone — an hour after the notifications
cleanup at `0 3 * * 0`, so the two weeklies never overlap) exists because a
presigned upload can succeed while the row that references it never lands: a tab
closed mid-form, a failed validation, a rolled-back transaction. Those objects
are invisible to every screen and are billed forever.

Each pass, under `ADVISORY_LOCK.R2_ORPHAN_SWEEP` (`6_350_005`) so N API
instances run it once between them:

1. lists every key under `evidence/`, `exports/` and `product-media/`,
   following the S3 continuation token;
2. loads every referenced key — `Evidence.url`, `ExportRecord.r2_key`,
   `ProductMedia.url`, `Asset.url`, `Conversation.avatar_key` — *after* the
   listing, so a row written while the listing is in flight still counts as a
   reference;
3. **skips anything modified in the last 48 hours.** A presigned PUT completes
   before its database row is written, so a fresh unreferenced object is
   indistinguishable from an upload in flight. An object whose `LastModified` is
   unknown is skipped for the same reason;
4. deletes the remainder in batches of 1000 (the S3 `DeleteObjects` limit) and
   writes one `AuditEvent(entity_type: 'storage', action: 'storage.orphan_swept')`
   per prefix, carrying the count and the first ten keys.

### Dry run before the first real pass

When `SystemSetting['maintenance_mode']` is `true`, the sweep logs what it
*would* delete and deletes nothing. Deleting customer evidence on a bad match is
unrecoverable, so **observe at least one production pass in maintenance mode**
before letting it delete for real: read the `[dry run]` warnings in the Railway
logs, confirm the sample keys are genuinely unreferenced, then turn maintenance
mode off.

### Reading the audit trail

```sql
SELECT created_at, entity_id AS prefix, after
FROM "AuditEvent"
WHERE action = 'storage.orphan_swept'
ORDER BY created_at DESC
LIMIT 20;
```

`after` carries `{ prefix, deleted, sample_keys }`. A pass that deleted nothing
writes no row — silence means a clean bucket.
