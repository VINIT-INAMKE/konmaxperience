import { z } from 'zod';

/**
 * RUN-01 — the two columns that decide whether a teammate can be reached
 * outside the app. `GET /users` and `GET /users/:id` both select them.
 *
 * They are declared here rather than on `UserProfile` because `lib/types/users.ts`
 * is shared ground across phases and this pair is P6's; a call site that needs
 * both intersects the two types (`UserProfile & StaffContact`).
 */
export interface StaffContact {
  /** Digits only, no `+` and no separators. `null` when never set. */
  phone?: string | null;
  whatsapp_opt_in?: boolean;
}

/**
 * The same rule the backend DTO enforces (`STAFF_PHONE_PATTERN`).
 *
 * `WhatsAppService.normalize` prepends `91` to whatever it is handed, so a
 * number carrying a `+`, a space or a dash would be dialled as a number that
 * does not exist. Rejecting it at the form is the difference between a nudge
 * that fails loudly here and one that silently goes nowhere for weeks.
 */
export const STAFF_PHONE_PATTERN = /^[0-9]{10,13}$/;

export const staffContactSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .refine((value) => value === '' || STAFF_PHONE_PATTERN.test(value), {
        message: 'Digits only, 10 to 13 of them — no +, spaces or dashes.',
      }),
    whatsapp_opt_in: z.boolean(),
  })
  // Belt and braces for the disabled switch: an opt-in with no number is a
  // person who believes they are being messaged and is not.
  .refine((values) => values.phone !== '' || !values.whatsapp_opt_in, {
    message: 'Add a phone number before turning WhatsApp nudges on.',
    path: ['whatsapp_opt_in'],
  });

export type StaffContactValues = z.infer<typeof staffContactSchema>;

/** Form values → request body. An emptied field is sent as an explicit `null`. */
export function toContactPayload(values: StaffContactValues): StaffContact {
  const phone = values.phone.trim();
  return {
    phone: phone === '' ? null : phone,
    whatsapp_opt_in: phone === '' ? false : values.whatsapp_opt_in,
  };
}
