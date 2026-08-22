/**
 * The single seeded node. `node_id` carries this as a Prisma-level @default so the
 * ~100 existing create() call sites need no edit (SPEC §1.2 makes multi-node
 * operation a non-goal for v2.0). Drop the @default when a second node is added.
 */
export const DEFAULT_NODE_ID = '11111111-1111-4111-8111-111111111111';
export const DEFAULT_NODE_CODE = 'KX-VILLA-1';
export const DEFAULT_NODE_NAME = 'Konma Xperience Villa 1';
export const DEFAULT_NODE_TIMEZONE = 'Asia/Kolkata';
export const DEFAULT_NODE_CURRENCY = 'INR';
