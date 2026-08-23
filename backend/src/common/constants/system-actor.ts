/**
 * The identity the MissionBridge writes as. Seeded by `seed:reference`
 * (`prisma/seed-data/system-actor.ts`) with a fixed id so services never
 * have to look it up. `status: 'system'` keeps it out of every screen that
 * filters `status: 'active'` (leaderboard, chat, activity, notifications).
 */
export const SYSTEM_USER_ID = '11111111-1111-4111-8111-111111111112';
export const SYSTEM_ROLE_CODE = 'SYSTEM';
export const SYSTEM_USER_EMAIL = 'system@konma.local';
export const SYSTEM_USER_NAME = 'Konma Bridge';
export const SYSTEM_USER_STATUS = 'system';
/** Never a valid bcrypt digest, so `bcrypt.compare()` can never succeed. */
export const SYSTEM_USER_PASSWORD_HASH = '!';
