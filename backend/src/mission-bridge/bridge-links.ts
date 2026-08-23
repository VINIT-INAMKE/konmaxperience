import { TaskSubjectType } from '@prisma/client';

/**
 * SPEC §4.2 — the `url` on bridge evidence is an app-relative deep link
 * (P3 decision 2), rendered by the frontend as an internal <Link> rather than
 * an `<a href>` to a presigned R2 object. The paths below are the routes that
 * exist today; Phase 32 may rename them, in which case only this file changes.
 */
const SUBJECT_PATH: Record<TaskSubjectType, (id: string) => string> = {
  recipe: (id) => `/operations/recipes/${id}`,
  product: (id) => `/operations/menu?product=${id}`,
  event: (id) => `/operations/events/${id}`,
  vendor: (id) => `/operations/vendors/${id}`,
  purchase_order: (id) => `/operations/purchase-orders/${id}`,
  prep_batch: (id) => `/operations/kitchen/prep-batches?batch=${id}`,
  order: (id) => `/orders/${id}`,
  decision: (id) => `/decisions?decision=${id}`,
};

export function bridgeDeepLink(
  subjectType: TaskSubjectType,
  subjectId: string,
): string {
  return SUBJECT_PATH[subjectType](subjectId);
}

/**
 * Renders the human-readable note stored on the evidence row. `values` are the
 * event payload fields the rule chose to surface; unknown keys render as an
 * em-dash so a payload change can never crash the bridge.
 */
export function renderBridgeNote(
  template: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = values[key];
    return v === undefined || v === null ? '—' : String(v);
  });
}
