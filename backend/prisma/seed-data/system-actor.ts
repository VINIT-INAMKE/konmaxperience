// The constants themselves live in `src/common/constants/system-actor.ts` so the
// runtime services and the seed can never disagree about the bridge's identity.
// This file mirrors `seed-data/settings.ts`: it wraps those consts in the exact
// row shapes `seed-reference.ts` upserts, keeping the seed self-contained and
// giving `src/prisma/seed-data.spec.ts` something to assert parity against.
import {
  SYSTEM_USER_ID,
  SYSTEM_ROLE_CODE,
  SYSTEM_USER_EMAIL,
  SYSTEM_USER_NAME,
  SYSTEM_USER_STATUS,
  SYSTEM_USER_PASSWORD_HASH,
} from '../../src/common/constants/system-actor';

/**
 * SPEC §4.2 — the MissionBridge uploads evidence as a real User because
 * `Evidence.uploaded_by` is a required FK. This role holds NO permissions and
 * the account can never log in (`password_hash` is not a bcrypt digest, and
 * `status: 'system'` fails the `status === 'active'` check in `auth.service.ts`).
 * Deliberately NOT part of ROLE_SEEDS: that list drives demo-user creation
 * with real passwords in seed-demo.ts.
 */
export const SYSTEM_ACTOR = {
  role: {
    code: SYSTEM_ROLE_CODE,
    name: 'System',
    description:
      'Automation identity for the mission bridge. Holds no permissions and cannot log in.',
    permissions: [] as string[],
  },
  user: {
    id: SYSTEM_USER_ID,
    name: SYSTEM_USER_NAME,
    email: SYSTEM_USER_EMAIL,
    function: 'automation',
    status: SYSTEM_USER_STATUS,
    password_hash: SYSTEM_USER_PASSWORD_HASH,
  },
} as const;
