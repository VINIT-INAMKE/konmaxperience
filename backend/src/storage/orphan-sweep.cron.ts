import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NodeService } from '../node/node.service';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_NODE_TIMEZONE } from '../node/node.constants';
import { ADVISORY_LOCK, withAdvisoryLock } from '../common/utils/advisory-lock';
import { StorageService, type StoredObject } from './storage.service';

/**
 * The prefixes the sweep is allowed to delete from.
 *
 * `assets/`, `guide/` and `chat/` are deliberately absent: their rows are
 * long-lived, their volume is tiny, and an over-eager match there costs a brand
 * mark or a guide illustration nobody notices is gone until it is needed. Their
 * keys are still loaded into the referenced set below, so a key that somehow
 * lands under a swept prefix while an `Asset` or `Conversation` row points at it
 * is still safe.
 */
export const SWEPT_PREFIXES = [
  'evidence/',
  'exports/',
  'product-media/',
] as const;

/**
 * How recently an object may have been written and still be spared.
 *
 * A presigned PUT completes *before* the database row that references it is
 * written — `POST /storage/presign` hands back a key, the browser uploads, and
 * only then does `POST /evidence` land. Anything inside this window is
 * indistinguishable from an upload in flight, and deleting customer evidence on
 * a bad match is unrecoverable.
 */
export const UPLOAD_GRACE_MS = 48 * 60 * 60 * 1000;

/** How many orphan keys are named in the audit row; the count carries the rest. */
const SAMPLE_SIZE = 10;

/** What one prefix's pass did, for the log line, the audit row and the spec. */
export interface PrefixSweepResult {
  prefix: string;
  listed: number;
  /** Unreferenced and past the grace window — the delete set. */
  orphans: number;
  /** Unreferenced but still inside the 48 h window, so spared this pass. */
  spared: number;
  deleted: number;
  dry_run: boolean;
}

/**
 * Turns a stored URL into the R2 key it points at.
 *
 * `Evidence.url`, `ProductMedia.url` and `Asset.url` hold public URLs
 * (`R2_PUBLIC_URL` + `/` + key) while `ExportRecord.r2_key` and
 * `Conversation.avatar_key` hold bare keys, so the sweep has to compare like
 * with like. Returns `null` for anything that yields no key at all.
 */
export function storageKeyFromUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutOrigin = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  const path = withoutOrigin.split(/[?#]/)[0];
  const key = path.replace(/^\/+/, '');
  return key || null;
}

/**
 * SPEC §8 / RUN-06 — weekly R2 hygiene.
 *
 * An upload that is presigned and completed but whose database row never lands
 * (a browser tab closed mid-form, a failed validation, a rolled-back
 * transaction) leaves a paid-for object nothing will ever reference again.
 * Nothing else in this system deletes from the bucket, so without this job the
 * bucket only ever grows.
 *
 * Two guards make it safe to run unattended, and both are proven by specs: a
 * key referenced by *any* of the five columns is never deleted, and neither is
 * anything written in the last 48 hours. A third guard is human:
 * `SystemSetting['maintenance_mode']` turns the whole thing into a dry run.
 *
 * The body runs under `ADVISORY_LOCK.R2_ORPHAN_SWEEP` so N API instances run it
 * once between them, and it never rejects — an unhandled rejection out of a
 * `@Cron` method would take the process down.
 */
@Injectable()
export class OrphanSweepCron {
  private readonly logger = new Logger(OrphanSweepCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly node: NodeService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Sunday 04:00 node-local — an hour after `NotificationsCleanupCron`
   * (`0 3 * * 0`) so the two weeklies never overlap. A decorator cannot await
   * `NodeService`, so the zone is pinned to the seeded default exactly as
   * `readiness.cron.ts` pins it.
   */
  @Cron('0 4 * * 0', { timeZone: DEFAULT_NODE_TIMEZONE })
  async weeklySweep(): Promise<void> {
    try {
      const results = await withAdvisoryLock(
        this.prisma,
        ADVISORY_LOCK.R2_ORPHAN_SWEEP,
        () => this.sweep(),
        this.logger,
      );

      if (results === null) {
        this.logger.log(
          'R2 orphan sweep skipped — lock held by another instance',
        );
        return;
      }

      for (const result of results) {
        this.logger.log(
          `${result.dry_run ? '[dry run] ' : ''}${result.prefix}: ` +
            `listed ${result.listed}, orphaned ${result.orphans}, ` +
            `spared ${result.spared} inside the 48h window, ` +
            `deleted ${result.deleted}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `R2 orphan sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Lists, filters and deletes. Separated from the `@Cron` wrapper so a manual
   * run (and a spec) can call it without the lock.
   *
   * Listing happens *before* the referenced set is loaded, so a row written
   * while the listing is in flight is still counted as a reference — the
   * cheapest possible protection against a race that would cost real data.
   */
  async sweep(now: Date = new Date()): Promise<PrefixSweepResult[]> {
    const dryRun = await this.settings.get('maintenance_mode');
    const nodeId = await this.node.currentId();

    const listings = new Map<string, StoredObject[]>();
    for (const prefix of SWEPT_PREFIXES) {
      listings.set(prefix, await this.storage.listKeys(prefix));
    }

    const referenced = await this.loadReferencedKeys();
    const cutoff = new Date(now.getTime() - UPLOAD_GRACE_MS);
    const results: PrefixSweepResult[] = [];

    for (const [prefix, objects] of listings) {
      const unreferenced = objects.filter((o) => !referenced.has(o.key));
      // A missing `LastModified` is an unknown age, and an unknown age is not
      // evidence that the object is old enough to delete.
      const orphans = unreferenced.filter(
        (o) => o.lastModified !== null && o.lastModified < cutoff,
      );
      const keys = orphans.map((o) => o.key);

      let deleted = 0;
      if (keys.length > 0 && !dryRun) {
        deleted = await this.storage.deleteKeys(keys);
        await this.prisma.$transaction((tx) =>
          this.audit.record(tx, {
            entity_type: 'storage',
            entity_id: prefix,
            action: 'storage.orphan_swept',
            node_id: nodeId,
            ...AuditService.user(null),
            after: {
              prefix,
              deleted,
              sample_keys: keys.slice(0, SAMPLE_SIZE),
            },
          }),
        );
      } else if (keys.length > 0) {
        this.logger.warn(
          `[dry run] ${prefix}: would delete ${keys.length} orphaned objects, ` +
            `starting with ${keys.slice(0, SAMPLE_SIZE).join(', ')}`,
        );
      }

      results.push({
        prefix,
        listed: objects.length,
        orphans: keys.length,
        spared: unreferenced.length - orphans.length,
        deleted,
        dry_run: dryRun,
      });
    }

    return results;
  }

  /**
   * Every R2 key any row still points at, across the five columns that hold one.
   *
   * Both the raw stored string and the key parsed out of it go into the set: the
   * two `*_key` columns already hold keys, the three `url` columns hold public
   * URLs, and a set that carries both forms cannot be defeated by a column
   * changing its mind about which it stores.
   */
  async loadReferencedKeys(): Promise<Set<string>> {
    const [evidence, exports, media, assets, conversations] = await Promise.all(
      [
        this.prisma.evidence.findMany({ select: { url: true } }),
        this.prisma.exportRecord.findMany({ select: { r2_key: true } }),
        this.prisma.productMedia.findMany({ select: { url: true } }),
        this.prisma.asset.findMany({ select: { url: true } }),
        this.prisma.conversation.findMany({ select: { avatar_key: true } }),
      ],
    );

    const referenced = new Set<string>();
    const add = (value: string | null | undefined): void => {
      if (!value) return;
      const trimmed = value.trim();
      if (trimmed) referenced.add(trimmed);
      const key = storageKeyFromUrl(value);
      if (key) {
        referenced.add(key);
        try {
          referenced.add(decodeURIComponent(key));
        } catch {
          // A malformed escape sequence is not a reason to skip the raw form,
          // which is already in the set.
        }
      }
    };

    for (const row of evidence) add(row.url);
    for (const row of exports) add(row.r2_key);
    for (const row of media) add(row.url);
    for (const row of assets) add(row.url);
    for (const row of conversations) add(row.avatar_key);

    return referenced;
  }
}
