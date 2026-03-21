# Phase 06: Operations Management - Research

**Researched:** 2026-03-21
**Domain:** NestJS CRUD modules + React Query frontend for Zones, Brands, Channels, Assets
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Zone Management**
- D-01: 8 default zones seeded: Main Kitchen (kitchen), Prep Station (kitchen), Dining Hall (dining), Garden Terrace (outdoor), Workshop Studio (workspace), Cold Storage (storage), Office (workspace), Lounge (leisure)
- D-02: Zone statuses: planned → setup → active → inactive (4-state lifecycle)
- D-03: Admin creates zones and assigns an owner. Owner can edit their zone's details and status. Admin can reassign ownership.
- D-04: Zone page shows a grid/list of all zones with status badges, owner name, and zone type

**Brand Lifecycle**
- D-05: 2 brands seeded: Konma Food (food, active), Just Craves (food, active)
- D-06: Brand statuses: idea → planning → development → active → paused (5-state lifecycle)
- D-07: Brand types from schema: food, art, lifestyle
- D-08: Brands have an owner (owner_user_id). Admin assigns owner. Owner can edit brand details and manage its assets.

**Sales Channels**
- D-09: All 7 channels seeded with status=planned: Dine-in, Delivery, Takeaway, Retail, Event, Workshop, Online
- D-10: Channel statuses: planned → active → inactive. Admin toggles activation.
- D-11: Channels are simple entities — name, type, status. No complex configuration in v1.

**Asset Library**
- D-12: Asset types: recipe, sop, menu, cost_sheet, training_doc
- D-13: Asset status workflow: draft → in_review → approved / rejected. Simple status toggle by admin or creator — no formal Approval record. Only approved assets are candidates for customer-facing display.
- D-14: Asset upload reuses R2 presigned URL flow from Phase 3 (StorageService). Same MIME/size validation.
- D-15: Assets link to a brand (linked_brand_id) and optionally to a task (linked_task_id) — both already in schema.

**Navigation**
- D-16: New "Operations" sidebar section between Intelligence and Admin: Zones, Brands, Channels, Assets — 4 pages.

### Claude's Discretion
- Zone/brand/channel page layouts (cards vs table, responsive breakpoints)
- Asset list filtering and sorting options
- Zone type icons/colors
- Brand status transition UI (dropdown vs button flow)
- Channel activation toggle design
- Asset preview behavior (inline preview vs new tab)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Manage 6+ villa zones with type, owner, and status | Zone model confirmed in schema (lines 274-282). 8 zones, 4-state status (D-01, D-02). Owner-edit RBAC via owner_user_id check. |
| OPS-02 | Manage brands with type (food/art/lifestyle) and status lifecycle (idea to active) | Brand model confirmed in schema (lines 284-293). 5-state lifecycle (D-06). Owner-edit pattern same as zones. |
| OPS-03 | Manage sales channels (dine-in, delivery, takeaway, retail, event, workshop, online) | Channel model confirmed (lines 295-300). 7 channels seeded. Simple 3-state status (D-10). Admin-only toggle. |
| OPS-04 | Asset library for recipes, SOPs, menus, cost sheets, training docs with status workflow | Asset model confirmed (lines 302-315). StorageService (R2) available for presigned upload. Status: draft → in_review → approved/rejected. |
</phase_requirements>

---

## Summary

Phase 6 is a pure CRUD + lifecycle phase. All four models (Zone, Brand, Channel, Asset) exist in `backend/prisma/schema.prisma` with correct fields and relations. No migrations are required — all needed columns are already there. The work is: (1) four NestJS modules with controller/service/DTO, (2) four frontend pages with create/edit sheets and status management, (3) a new "Operations" sidebar section, (4) seed replacement for zones + new brands/channels, and (5) a new asset presigned URL endpoint that adapts StorageService for assets (not tasks).

The key departure from the evidence upload pattern is that assets are not task-scoped. The existing `POST /storage/presign` endpoint requires a `taskId` and validates task ownership — a new endpoint (or modified DTO path) must be introduced for asset uploads. This is the only genuinely new integration concern.

RBAC for this phase uses a new `MANAGE_OPS` permission (admin-only) for create/delete operations, while owner-edit is handled via an in-service ownership check — matching the established pattern from evidence and tasks.

**Primary recommendation:** Build each entity as a self-contained NestJS module (zone, brand, channel, asset) following the decisions module structure. Frontend pages follow the decisions page pattern (BlurFade, Tabs filter, ShimmerButton create, Sheet form). Asset upload adapts EvidenceUploadZone into a reusable AssetUploadZone component.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | (project) | Module/Controller/Service pattern | Established in all prior phases |
| Prisma | v6 | Database ORM | Project constraint — Prisma 6 not v7 |
| class-validator | (project) | DTO validation with @IsIn, @IsString | Used in all existing DTOs |
| @tanstack/react-query | (project) | Server state, mutation, cache invalidation | All frontend data fetching |
| shadcn/ui Sheet | (project) | Create/edit slide-over forms | Used in decisions, tasks, KPIs |
| Sonner | (project) | Toast notifications | Mounted in root layout from Phase 3 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/s3-request-presigner | (project) | R2 presigned PUT URLs | Asset upload via StorageService |
| lucide-react | (project) | Icons for zone types, status badges | Zone type glyphs, status indicators |
| MagicCard | (project) | Entity cards with spotlight effect | Zone/Brand card grids |
| BlurFade | (project) | Page entrance animation | All four new pages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sheet for create/edit | Dialog | Sheet is already the project pattern for all CRUD forms — stay consistent |
| Inline status dropdown | Separate status-change button | Dropdown inside the edit Sheet keeps the surface clean for operations pages |

**No new packages required.** This phase reuses the entire existing stack.

---

## Architecture Patterns

### Recommended Project Structure

**Backend — four new modules:**
```
backend/src/
├── zones/
│   ├── dto/create-zone.dto.ts
│   ├── dto/update-zone.dto.ts
│   ├── zones.controller.ts
│   ├── zones.service.ts
│   └── zones.module.ts
├── brands/
│   ├── dto/create-brand.dto.ts
│   ├── dto/update-brand.dto.ts
│   ├── brands.controller.ts
│   ├── brands.service.ts
│   └── brands.module.ts
├── channels/
│   ├── dto/create-channel.dto.ts
│   ├── dto/update-channel.dto.ts
│   ├── channels.controller.ts
│   ├── channels.service.ts
│   └── channels.module.ts
├── assets/
│   ├── dto/create-asset.dto.ts
│   ├── dto/update-asset.dto.ts
│   ├── assets.controller.ts
│   ├── assets.service.ts
│   └── assets.module.ts
```

**Frontend — four new pages + component folders:**
```
frontend/
├── app/(ops)/
│   ├── operations/
│   │   ├── zones/page.tsx
│   │   ├── brands/page.tsx
│   │   ├── channels/page.tsx
│   │   └── assets/page.tsx
├── components/ops/operations/
│   ├── zones/
│   │   ├── ZoneCard.tsx
│   │   ├── ZoneForm.tsx
│   │   └── ZoneStatusBadge.tsx
│   ├── brands/
│   │   ├── BrandCard.tsx
│   │   ├── BrandForm.tsx
│   │   └── BrandStatusBadge.tsx
│   ├── channels/
│   │   ├── ChannelRow.tsx
│   │   ├── ChannelForm.tsx
│   │   └── ChannelStatusToggle.tsx
│   └── assets/
│       ├── AssetRow.tsx
│       ├── AssetForm.tsx
│       ├── AssetUploadZone.tsx
│       └── AssetStatusBadge.tsx
├── lib/types/
│   ├── zone.ts
│   ├── brand.ts
│   ├── channel.ts
│   └── asset.ts
```

### Pattern 1: NestJS Module Structure (follow decisions module exactly)

**What:** Controller → Service → Prisma, module exports service.
**When to use:** All four new entities.

```typescript
// Source: backend/src/decisions/decisions.module.ts (existing)
@Module({
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
```

Register in `app.module.ts` imports array alongside existing modules.

### Pattern 2: Owner-Edit RBAC (in-service check, not decorator)

**What:** Admin can do anything; entity owner can update their own entity's details and status.
**When to use:** Zones (D-03) and Brands (D-08).

The project already does this for tasks (task type-based permission check in controller, not decorator). For zones/brands the check is simpler — owner_user_id match OR isAdmin:

```typescript
// Source: pattern from backend/src/decisions/decisions.service.ts + tasks pattern
async update(id: string, dto: UpdateZoneDto, userId: string, isAdmin: boolean) {
  const zone = await this.findOne(id); // throws NotFoundException if not found
  const isOwner = zone.owner_user_id === userId;
  if (!isAdmin && !isOwner) {
    throw new ForbiddenException('Only admin or the zone owner can edit this zone');
  }
  return this.prisma.zone.update({ where: { id }, data: { ...dto } });
}
```

For PATCH routes, use `@RequiresPermission(Permission.MANAGE_OPS)` for admin-only operations (create, delete, reassign owner). Owner-edit via in-service check requires no permission decorator — any authenticated user can attempt, service validates.

**Key decision:** A new `MANAGE_OPS` permission must be added to `backend/src/types/permissions.ts` and assigned to `FOUNDER_ADMIN` and `TECH_LEAD` in the seed. This is consistent with `MANAGE_KPIS` added in Phase 4.

### Pattern 3: Asset Presigned URL — New Endpoint

**What:** Asset upload cannot reuse `POST /storage/presign` because that endpoint validates `taskId`. Assets are not task-scoped at upload time (brand association is made separately).
**When to use:** Asset file upload in AssetForm / AssetUploadZone.

Two options:
1. Add a second endpoint `POST /storage/presign-asset` in StorageController — validates MIME/size, builds key under `assets/` prefix, returns presignedUrl + publicUrl. No entity ownership check needed at presign time (the asset record is created with `created_by` in the subsequent POST /assets call).
2. Make taskId optional in the existing PresignDto and branch the key builder.

**Recommendation:** Option 1 — separate endpoint. Cleaner, avoids conditional branching in existing code.

```typescript
// New endpoint in storage.controller.ts
@Post('presign-asset')
@RequiresPermission(Permission.UPLOAD_EVIDENCE)  // reuse same upload permission
async presignAsset(@Body() dto: PresignAssetDto, @Req() req: express.Request) {
  this.storageService.validatePresignRequest(dto.contentType, dto.fileSize);
  const key = `assets/${Date.now()}-${dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const presignedUrl = await this.storageService.generatePresignedPutUrl(key, dto.contentType);
  const publicUrl = this.storageService.getPublicUrl(key);
  return { presignedUrl, key, publicUrl };
}
```

The frontend then calls `POST /assets` to create the asset record with the publicUrl.

### Pattern 4: Frontend Page Structure (follow decisions page)

**What:** BlurFade wrapper, header with title + ShimmerButton, optional Tabs filter, data list, Sheet form.
**When to use:** All four pages.

```typescript
// Source: frontend/app/(ops)/decisions/page.tsx (existing pattern)
export default function ZonesPage() {
  const [formOpen, setFormOpen] = useState(false);
  const { data: zones, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiClient.get<Zone[]>('/zones'),
  });
  return (
    <BlurFade>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-[28px] font-semibold leading-tight">Zones</h1>
          {isAdmin && <ShimmerButton onClick={() => setFormOpen(true)}>Add Zone</ShimmerButton>}
        </div>
        {/* grid or table */}
        <ZoneForm open={formOpen} onOpenChange={setFormOpen} onCreated={...} />
      </div>
    </BlurFade>
  );
}
```

### Pattern 5: Sidebar "Operations" Section

**What:** New section between Intelligence and Admin with 4 nav items.
**When to use:** Sidebar.tsx modification (D-16).

The Sidebar renders sections as grouped nav arrays. Add `operationsNav` array between `intelligenceNav` and `adminNav`. The section renders for all authenticated users (not admin-gated like adminNav) because zone/brand/channel/asset pages are visibility-level for all roles — edit rights enforced per-entity.

```typescript
// Insert after intelligenceNav block, before adminNav block in Sidebar.tsx
const operationsNav: NavItem[] = [
  { label: 'Zones',    href: '/operations/zones',    icon: <MapPin className="size-4" /> },
  { label: 'Brands',   href: '/operations/brands',   icon: <Tag className="size-4" /> },
  { label: 'Channels', href: '/operations/channels', icon: <Radio className="size-4" /> },
  { label: 'Assets',   href: '/operations/assets',   icon: <FolderOpen className="size-4" /> },
];
```

### Pattern 6: Seed Replacement

**What:** Replace existing 8 ZONES with D-01 zones, add brands, add channels.
**When to use:** `backend/prisma/seed.ts` update.

Current seed does `deleteMany + create` for zones (idempotent). Keep that pattern for the new zones. Brands and channels should use `upsert` on a stable unique key. Since neither has a unique field besides id, use `name` as the upsert key (add `@@unique([name])` to Brand and Channel schema if needed, or do deleteMany + create like zones).

**Recommendation:** Use `deleteMany + create` for all three (zones, brands, channels) since they are reference data that should be reset clean. Brands and channels have no foreign keys from other tables at this point in the build.

```typescript
// Seed data for D-01 zones
const ZONES_V2 = [
  { name: 'Main Kitchen',      zone_type: 'kitchen' },
  { name: 'Prep Station',      zone_type: 'kitchen' },
  { name: 'Dining Hall',       zone_type: 'dining' },
  { name: 'Garden Terrace',    zone_type: 'outdoor' },
  { name: 'Workshop Studio',   zone_type: 'workspace' },
  { name: 'Cold Storage',      zone_type: 'storage' },
  { name: 'Office',            zone_type: 'workspace' },
  { name: 'Lounge',            zone_type: 'leisure' },
];

const BRANDS = [
  { name: 'Konma Food',   brand_type: 'food', status: 'active' },
  { name: 'Just Craves',  brand_type: 'food', status: 'active' },
];

const CHANNELS = [
  { name: 'Dine-in',   channel_type: 'dine_in',   status: 'planned' },
  { name: 'Delivery',  channel_type: 'delivery',  status: 'planned' },
  { name: 'Takeaway',  channel_type: 'takeaway',  status: 'planned' },
  { name: 'Retail',    channel_type: 'retail',    status: 'planned' },
  { name: 'Event',     channel_type: 'event',     status: 'planned' },
  { name: 'Workshop',  channel_type: 'workshop',  status: 'planned' },
  { name: 'Online',    channel_type: 'online',    status: 'planned' },
];
```

### Anti-Patterns to Avoid

- **Reusing POST /storage/presign for assets:** That endpoint validates taskId and will 404 on asset uploads. Create a dedicated presign-asset endpoint.
- **Gating Operations nav section as admin-only:** Zones/brands/channels are viewable by all; admin-gating hides operational context from non-admin users who need it.
- **Using MANAGE_SYSTEM permission for ops CRUD:** Too broad. Add a targeted `MANAGE_OPS` permission to keep permission semantics clear.
- **Storing status as an enum in Prisma schema:** All existing entities use `String @default(...)` for status fields (not native Postgres enums). Match this pattern — use `@IsIn([...])` validation in DTOs instead.
- **Calling deleteMany on Assets in seed:** Assets are user-created data, not reference data. Only zones/brands/channels get reset. Assets table starts empty.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| R2 file upload | Custom upload handler | StorageService.generatePresignedPutUrl() | Phase 3 implementation handles MIME validation, size limit, R2 presigning, public URL construction |
| File progress UI | XMLHttpRequest wrapper | EvidenceUploadZone.tsx pattern | Drag-drop, XHR upload progress, BorderBeam active state already implemented |
| Toast notifications | Custom toast | Sonner (already mounted in root layout) | Phase 3+ standard, `toast.success()` / `toast.error()` available everywhere |
| Status badge variants | Custom badge logic | Badge component + tailwind color variants | Status badges follow ZoneStatusBadge → same pattern as KpiStatusBadge, DecisionStatusBadge |
| Auth context | JWT re-decode | `(req as any).user` from JwtAuthGuard | Guard already attaches user with id, roleCode, permissions to every request |
| Query cache invalidation | Manual refetch | `queryClient.invalidateQueries({ queryKey: ['zones'] })` | React Query handles stale-while-revalidate automatically |

**Key insight:** Phase 6 is fundamentally a repetition of the decisions + KPI + evidence patterns applied to four new entities. The codebase already has working templates for every concern — copy, adapt names, ship.

---

## Common Pitfalls

### Pitfall 1: Schema vs. CONTEXT.md Status Mismatch

**What goes wrong:** The `schema.prisma` (line 280) uses `status String @default("planned")` for Zone, and the dev_spec §7.12 shows `enum(planned,active,ready,needs_work)`. But CONTEXT.md D-02 defines a different 4-state lifecycle: `planned → setup → active → inactive`. CONTEXT.md wins — it is the locked decision.

**Why it happens:** dev_spec was written before the discuss-phase conversation that locked the statuses.

**How to avoid:** Use CONTEXT.md D-02 values in all DTOs, seed data, and frontend badges. `@IsIn(['planned', 'setup', 'active', 'inactive'])` in the DTO. Do not reference the dev_spec enum values for zones.

**Same issue for brands:** dev_spec §7.13 shows `idea,onboarding,testing,active,paused`. CONTEXT.md D-06 defines `idea,planning,development,active,paused`. Use D-06. For channels, dev_spec §7.14 shows `planned,testing,active,paused`. CONTEXT.md D-10 defines `planned,active,inactive`. Use D-10.

### Pitfall 2: Asset Status Discrepancy

**What goes wrong:** dev_spec §7.15 shows `draft,approved,archived`. CONTEXT.md D-13 defines `draft → in_review → approved / rejected`. These are different sets.

**How to avoid:** Use D-13 values: `['draft', 'in_review', 'approved', 'rejected']`. The `in_review` intermediate state is the key addition from the discussion.

### Pitfall 3: Zone deleteMany Breaks Foreign Keys

**What goes wrong:** Future phases (7+) will link recipes to zones via `linked_zone_id`. If seed is re-run after recipes exist, `deleteMany` on zones would cascade-fail or leave orphaned records.

**Why it happens:** deleteMany + recreate is fine for an empty database but not idempotent once downstream references exist.

**How to avoid:** For Phase 6, the seed approach is safe because Zone has no outbound foreign keys currently and no other tables reference Zone yet. Document that post-Phase 7 the zone seed strategy should switch to upsert-by-name. The Zone model has no `@unique` constraint on name — add `@@unique([name])` to the Prisma model to enable upsert, or leave deleteMany with a code comment warning.

### Pitfall 4: Missing MANAGE_OPS Permission

**What goes wrong:** Using `MANAGE_SYSTEM` (too broad) or `VIEW_ALL` (read permission, not write) for zone/brand/channel create/delete. Or trying to use `MANAGE_KPIS` as a proxy.

**How to avoid:** Add `MANAGE_OPS = 'MANAGE_OPS'` to `Permission` enum in `backend/src/types/permissions.ts`. Add display name and description. Assign to `FOUNDER_ADMIN` (already gets all permissions via `Object.values(Permission)`) and optionally `TECH_LEAD` (same). Update seed's TECH_LEAD permissions array if needed.

### Pitfall 5: Asset presign-asset Endpoint Needs No Task Scope

**What goes wrong:** Copying the storage presign DTO with `taskId` required field — assets don't belong to tasks at upload time.

**How to avoid:** Create `PresignAssetDto` with only `filename`, `contentType`, `fileSize`. The brand/task linkage is captured in the subsequent `POST /assets` request body. The presign step is purely about getting upload credentials.

### Pitfall 6: Sidebar path collision

**What goes wrong:** Using `/zones`, `/brands`, `/channels`, `/assets` as top-level routes conflicts with potential future naming. The existing routes use flat paths (`/missions`, `/decisions`).

**How to avoid:** Group under `/operations/zones`, `/operations/brands`, etc. (matching D-16's "Operations section"). This also makes `isActive('/operations')` work cleanly for any nested route. The `app/(ops)/operations/` folder nests correctly under the existing `(ops)` layout.

### Pitfall 7: Asset Upload — Two-Step Create

**What goes wrong:** Creating the Asset record in the database before the file actually exists in R2 (if the presign succeeds but the PUT fails).

**How to avoid:** Match the evidence pattern exactly:
1. Call `POST /storage/presign-asset` → get presignedUrl + publicUrl
2. XHR PUT to presignedUrl (file upload)
3. Only on XHR success: call `POST /assets` with `{ name, asset_type, url: publicUrl, linked_brand_id?, linked_task_id?, status: 'draft' }`

The asset record should never be created if step 2 fails.

---

## Code Examples

### Backend: CreateZoneDto

```typescript
// Pattern: backend/src/decisions/dto/create-decision.dto.ts
import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['kitchen', 'dining', 'outdoor', 'workspace', 'storage', 'leisure'])
  zone_type: string;

  @IsOptional()
  @IsString()
  owner_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['kitchen', 'dining', 'outdoor', 'workspace', 'storage', 'leisure'])
  zone_type?: string;

  @IsOptional()
  @IsIn(['planned', 'setup', 'active', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  owner_user_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

### Backend: ZonesService owner-edit check

```typescript
// Pattern derived from decisions.service.ts + tasks RBAC pattern
async update(id: string, dto: UpdateZoneDto, userId: string, isAdmin: boolean) {
  const zone = await this.findOne(id); // NotFoundException if not found
  const isOwner = zone.owner_user_id === userId;
  if (!isAdmin && !isOwner) {
    throw new ForbiddenException('Only admin or the zone owner can edit this zone');
  }
  return this.prisma.zone.update({
    where: { id },
    data: {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.zone_type !== undefined && { zone_type: dto.zone_type }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.owner_user_id !== undefined && { owner_user_id: dto.owner_user_id }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    },
    include: { owner: { select: { id: true, name: true } } },
  });
}
```

### Backend: ZonesController pattern

```typescript
// Pattern: decisions.controller.ts
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  findAll() { return this.zonesService.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonesService.findOne(id);
  }

  @Post()
  @RequiresPermission(Permission.MANAGE_OPS)
  create(@Body() dto: CreateZoneDto) { return this.zonesService.create(dto); }

  @Patch(':id')
  // No permission decorator — ownership check inside service
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateZoneDto, @Req() req: express.Request) {
    const user = (req as any).user;
    return this.zonesService.update(id, dto, user.id, user.roleCode === 'FOUNDER_ADMIN');
  }

  @Delete(':id')
  @RequiresPermission(Permission.MANAGE_OPS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.zonesService.remove(id);
  }
}
```

### Backend: PresignAssetDto

```typescript
import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class PresignAssetDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentType: string;

  @IsNumber()
  @Min(1)
  @Max(10 * 1024 * 1024)
  fileSize: number;
}
```

### Frontend: Zone TypeScript type

```typescript
// Pattern: frontend/lib/types/decisions.ts
export type ZoneStatus = 'planned' | 'setup' | 'active' | 'inactive';
export type ZoneType = 'kitchen' | 'dining' | 'outdoor' | 'workspace' | 'storage' | 'leisure';

export interface Zone {
  id: string;
  name: string;
  zone_type: ZoneType;
  owner_user_id: string | null;
  owner?: { id: string; name: string } | null;
  status: ZoneStatus;
  notes: string | null;
}

export const ZONE_STATUS_LABELS: Record<ZoneStatus, string> = {
  planned: 'Planned',
  setup: 'Setup',
  active: 'Active',
  inactive: 'Inactive',
};

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  kitchen: 'Kitchen',
  dining: 'Dining',
  outdoor: 'Outdoor',
  workspace: 'Workspace',
  storage: 'Storage',
  leisure: 'Leisure',
};
```

### Frontend: Asset type

```typescript
export type AssetStatus = 'draft' | 'in_review' | 'approved' | 'rejected';
export type AssetType = 'recipe' | 'sop' | 'menu' | 'cost_sheet' | 'training_doc';

export interface Asset {
  id: string;
  name: string;
  asset_type: AssetType;
  linked_task_id: string | null;
  linked_brand_id: string | null;
  linked_brand?: { id: string; name: string } | null;
  url: string;
  status: AssetStatus;
  created_by: string;
  creator?: { id: string; name: string };
  created_at: string;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zones seeded with 8 placeholder operational zones | 8 physical villa zones (D-01 names/types) | Phase 6 seed update | Seed must replace existing zones — old data is stale |
| No brands/channels in DB | 2 brands + 7 channels seeded | Phase 6 | Downstream phases (7, 10) reference these records |
| StorageService only used for task evidence | StorageService extended to serve asset uploads | Phase 6 | New presign-asset endpoint added to StorageController |

**Deprecated/outdated:**
- Old zone seed data (Food Innovation Lab, Production Kitchen, etc.): replaced in Phase 6 seed. Do not reference in any new code.

---

## Open Questions

1. **PATCH /zones/:id — no permission decorator**
   - What we know: The owner-edit pattern uses in-service ownership checks. Any authenticated user can call PATCH; the service enforces ownership.
   - What's unclear: Should there be a minimum permission level (e.g., `UPLOAD_EVIDENCE` as a proxy for "active user") to prevent unauthenticated access? The JWT guard already handles this at the route level — all routes in this app require valid JWT.
   - Recommendation: No permission decorator needed on PATCH; JWT guard + in-service ownership check is sufficient. This matches how tasks handle owner-update.

2. **Channel activation — admin-only in service or in controller?**
   - What we know: D-10 says "Admin toggles activation." Channels have no owner.
   - What's unclear: Whether PATCH /channels/:id should be fully locked to MANAGE_OPS (admin-only) or if there's a future case for non-admin channel editing.
   - Recommendation: Require MANAGE_OPS on PATCH /channels/:id. Channels are simpler than zones — no owner-edit concept.

3. **Asset in_review state — who can set it?**
   - What we know: D-13 says "Simple status toggle by admin or creator — no formal Approval record."
   - What's unclear: Can creator set status to `in_review` themselves, or does admin do it?
   - Recommendation: Creator can set draft → in_review. Admin can set any status. This matches the "creator submits, admin approves" pattern from evidence.

4. **Zone type icon mapping**
   - Left to Claude's discretion. Recommend: kitchen → ChefHat, dining → UtensilsCrossed, outdoor → Leaf, workspace → Monitor, storage → Archive, leisure → Coffee (all from lucide-react).

---

## Validation Architecture

`nyquist_validation` is enabled. This is a CRUD phase with no complex business logic — tests should validate the happy path for each entity's create/read/update flow.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (NestJS default, configured in backend) |
| Config file | `backend/jest.config.js` or `backend/package.json` jest field |
| Quick run command | `cd backend && npm test -- --testPathPattern zones` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Zone CRUD: create, read, update status, owner-edit check | unit (service) | `npm test -- --testPathPattern zones.service` | ❌ Wave 0 |
| OPS-02 | Brand CRUD: create, read, update status lifecycle | unit (service) | `npm test -- --testPathPattern brands.service` | ❌ Wave 0 |
| OPS-03 | Channel CRUD: create, read, admin-toggle status | unit (service) | `npm test -- --testPathPattern channels.service` | ❌ Wave 0 |
| OPS-04 | Asset CRUD: create with url, update status draft→in_review→approved | unit (service) | `npm test -- --testPathPattern assets.service` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npm test -- --testPathPattern "(zones|brands|channels|assets)"`
- **Per wave merge:** `cd backend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/zones/__tests__/zones.service.spec.ts` — covers OPS-01
- [ ] `backend/src/brands/__tests__/brands.service.spec.ts` — covers OPS-02
- [ ] `backend/src/channels/__tests__/channels.service.spec.ts` — covers OPS-03
- [ ] `backend/src/assets/__tests__/assets.service.spec.ts` — covers OPS-04

---

## Sources

### Primary (HIGH confidence)
- `backend/prisma/schema.prisma` lines 274-315 — confirmed all four model definitions (Zone, Brand, Channel, Asset) with exact field names and types
- `backend/src/storage/storage.service.ts` — confirmed StorageService API: validatePresignRequest, buildStorageKey, generatePresignedPutUrl, getPublicUrl
- `backend/src/decisions/` — canonical pattern for NestJS module structure (module, controller, service, DTO)
- `frontend/app/(ops)/decisions/page.tsx` — canonical pattern for operations page (BlurFade, Tabs, ShimmerButton, Sheet form)
- `frontend/components/ops/evidence/EvidenceUploadZone.tsx` — canonical two-step presign + XHR upload pattern for asset uploads
- `frontend/components/ops/Sidebar.tsx` — confirmed sidebar section structure; Operations section inserts between intelligenceNav and adminNav
- `backend/src/types/permissions.ts` — confirmed MANAGE_OPS does not yet exist; MANAGE_KPIS is the reference for adding new management permissions

### Secondary (MEDIUM confidence)
- `contextdocs/dev_spec.md` §7.12-7.15 — original schema spec; CONTEXT.md status values override where they conflict

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture patterns: HIGH — derived from reading actual implementations of decisions, KPIs, evidence modules
- Pitfalls: HIGH — all derived from concrete schema analysis and existing code reading, not speculation

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable — no fast-moving external dependencies)
