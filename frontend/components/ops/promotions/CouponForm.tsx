'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PRODUCT_TYPE_LABELS, type ProductType } from '@/lib/types/catalog';
import {
  COUPON_STATUSES,
  COUPON_STATUS_LABELS,
  COUPON_TYPES,
  COUPON_TYPE_LABELS,
  type Coupon,
  type CreateCouponPayload,
  type UpdateCouponPayload,
} from '@/lib/types/promotions';

const PRODUCT_TYPES: ProductType[] = [
  'prepared_food',
  'packaged',
  'experience',
  'merchandise',
];

/**
 * The staff coupon form.
 *
 * Every rule below is one the server already enforces — this is a mirror, not a
 * second opinion, and the server stays the authority:
 *
 * | Rule | Server |
 * |---|---|
 * | `code` 3–32 chars, upper-cased | `CreateCouponDto` `@Length(3,32)` + `normaliseCode` |
 * | `description` ≤ 280 | `@MaxLength(280)` |
 * | money ≥ 0 with ≤ 2dp | `@IsNumber({ maxDecimalPlaces: 2 }) @Min(0)` |
 * | a `percent` value ≤ 100 | `assertValueForType` → `400` |
 * | `ends_at` strictly after `starts_at` | `assertWindow` → `400` |
 * | limits are whole numbers ≥ 1 | `@IsInt() @Min(1)` |
 * | at most four `applies_to` members | `@ArrayMaxSize(4)` |
 *
 * A duplicate `code` is the one failure that cannot be predicted here — it is a
 * `409` from the `code @unique` violation, and the sheet renders the server's
 * message.
 */

const IST = 'Asia/Kolkata';
/** IST has no DST, so the offset is a constant and the round-trip below is exact. */
const IST_OFFSET = '+05:30';

const IST_INPUT_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * An ISO instant → the `YYYY-MM-DDTHH:mm` an `<input type="datetime-local">`
 * wants, read in **IST**.
 *
 * A coupon window is a business fact ("live from Monday 9am"), so both
 * directions are pinned to the business timezone rather than the browser's:
 * a manager on a laptop still set to UTC would otherwise create a window five
 * and a half hours away from the one they typed.
 */
export function toIstLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = IST_INPUT_FMT.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** The inverse: an IST wall-clock string → the UTC ISO instant the API stores. */
export function fromIstLocalInput(local: string): string | null {
  if (!local) return null;
  const date = new Date(`${local}:00${IST_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** `Decimal(12,2)` cannot hold a third decimal place, and neither can the DTO. */
function atMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-9;
}

/** An empty number input is "not set" (`null`), never `0` and never `NaN`. */
function optionalNumber(raw: unknown): number | null {
  if (raw === '' || raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const TWO_DP_MESSAGE = 'At most two decimal places';

const couponSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Code must be at least 3 characters')
      .max(32, 'Code must be at most 32 characters'),
    description: z.string().max(280, 'Description must be at most 280 characters'),
    type: z.enum(['percent', 'fixed', 'free_shipping']),
    value: z.number().min(0, 'Value cannot be negative').nullable(),
    min_order: z.number().min(0, 'Minimum order cannot be negative').nullable(),
    max_discount: z
      .number()
      .min(0, 'Maximum discount cannot be negative')
      .nullable(),
    applies_to: z
      .array(z.enum(['prepared_food', 'packaged', 'experience', 'merchandise']))
      .max(4),
    starts_at: z.string().min(1, 'A start is required'),
    ends_at: z.string().min(1, 'An end is required'),
    usage_limit: z
      .number()
      .int('Must be a whole number')
      .min(1, 'Must be at least 1')
      .nullable(),
    per_customer_limit: z
      .number()
      .int('Must be a whole number')
      .min(1, 'Must be at least 1')
      .nullable(),
    status: z.enum(['draft', 'active', 'disabled']),
  })
  .superRefine((values, ctx) => {
    // `free_shipping` ignores `value` entirely; the other two require it.
    if (values.type !== 'free_shipping') {
      if (values.value === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'A value is required',
        });
      } else {
        if (values.type === 'percent' && values.value > 100) {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'A percent coupon value must be between 0 and 100',
          });
        }
        if (!atMostTwoDecimals(values.value)) {
          ctx.addIssue({ code: 'custom', path: ['value'], message: TWO_DP_MESSAGE });
        }
      }
    }

    if (values.min_order !== null && !atMostTwoDecimals(values.min_order)) {
      ctx.addIssue({ code: 'custom', path: ['min_order'], message: TWO_DP_MESSAGE });
    }
    if (values.max_discount !== null && !atMostTwoDecimals(values.max_discount)) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_discount'],
        message: TWO_DP_MESSAGE,
      });
    }

    const starts = fromIstLocalInput(values.starts_at);
    const ends = fromIstLocalInput(values.ends_at);
    if (values.starts_at && starts === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['starts_at'],
        message: 'Not a valid date and time',
      });
    }
    if (values.ends_at && ends === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['ends_at'],
        message: 'Not a valid date and time',
      });
    }
    if (starts !== null && ends !== null && Date.parse(ends) <= Date.parse(starts)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ends_at'],
        message: 'The end must be after the start',
      });
    }
  });

export type CouponFormValues = z.infer<typeof couponSchema>;

/** A fresh coupon opens as a `draft` percent offer over the next fortnight. */
function blankValues(now: number): CouponFormValues {
  const DAY = 86_400_000;
  return {
    code: '',
    description: '',
    type: 'percent',
    value: null,
    min_order: null,
    max_discount: null,
    applies_to: [],
    starts_at: toIstLocalInput(new Date(now).toISOString()),
    ends_at: toIstLocalInput(new Date(now + 14 * DAY).toISOString()),
    usage_limit: null,
    per_customer_limit: null,
    status: 'draft',
  };
}

function valuesFrom(coupon: Coupon): CouponFormValues {
  return {
    code: coupon.code,
    description: coupon.description ?? '',
    type: coupon.type,
    value: coupon.type === 'free_shipping' ? null : coupon.value,
    min_order: coupon.min_order,
    max_discount: coupon.max_discount,
    applies_to: coupon.applies_to ?? [],
    starts_at: toIstLocalInput(coupon.starts_at),
    ends_at: toIstLocalInput(coupon.ends_at),
    usage_limit: coupon.usage_limit,
    per_customer_limit: coupon.per_customer_limit,
    status: coupon.status,
  };
}

/**
 * `POST` body. Optional columns are **omitted** rather than sent as `null`,
 * because `CreateCouponDto` types them as `number | undefined`.
 */
export function toCreatePayload(values: CouponFormValues): CreateCouponPayload {
  const percentOrFixed = values.type !== 'free_shipping';
  return {
    code: values.code.trim().toUpperCase(),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    type: values.type,
    // `free_shipping` ignores the column but the DTO still requires the field.
    value: percentOrFixed ? (values.value ?? 0) : 0,
    ...(values.min_order === null ? {} : { min_order: values.min_order }),
    ...(values.type === 'percent' && values.max_discount !== null
      ? { max_discount: values.max_discount }
      : {}),
    applies_to: values.applies_to,
    starts_at: fromIstLocalInput(values.starts_at) ?? values.starts_at,
    ends_at: fromIstLocalInput(values.ends_at) ?? values.ends_at,
    ...(values.usage_limit === null ? {} : { usage_limit: values.usage_limit }),
    ...(values.per_customer_limit === null
      ? {}
      : { per_customer_limit: values.per_customer_limit }),
    status: values.status,
  };
}

/**
 * `PATCH` body. Here `null` is sent **deliberately** — it is the only way to
 * clear a nullable column, which `undefined` ("leave unchanged") cannot express.
 * Switching a `percent` coupon to `fixed` therefore clears the ceiling the form
 * has just hidden, rather than leaving a stale one on the row.
 */
export function toUpdatePayload(values: CouponFormValues): UpdateCouponPayload {
  const percentOrFixed = values.type !== 'free_shipping';
  return {
    code: values.code.trim().toUpperCase(),
    description: values.description.trim(),
    type: values.type,
    value: percentOrFixed ? (values.value ?? 0) : 0,
    min_order: values.min_order,
    max_discount: values.type === 'percent' ? values.max_discount : null,
    applies_to: values.applies_to,
    starts_at: fromIstLocalInput(values.starts_at) ?? values.starts_at,
    ends_at: fromIstLocalInput(values.ends_at) ?? values.ends_at,
    usage_limit: values.usage_limit,
    per_customer_limit: values.per_customer_limit,
    status: values.status,
  };
}

interface CouponFormProps {
  /** Absent = create. */
  coupon?: Coupon;
  /** Re-seeds the form whenever the sheet is (re-)opened. */
  open: boolean;
  isSubmitting: boolean;
  onSubmit: (values: CouponFormValues) => void;
  onCancel: () => void;
}

export function CouponForm({
  coupon,
  open,
  isSubmitting,
  onSubmit,
  onCancel,
}: CouponFormProps) {
  const isEditing = !!coupon;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: blankValues(Date.now()),
  });

  const type = watch('type');
  const status = watch('status');
  const appliesTo = watch('applies_to');

  useEffect(() => {
    if (!open) return;
    reset(coupon ? valuesFrom(coupon) : blankValues(Date.now()));
  }, [coupon, open, reset]);

  const showValue = type !== 'free_shipping';
  const showMaxDiscount = type === 'percent';

  const toggleProductType = (productType: ProductType, checked: boolean) => {
    const next = checked
      ? [...appliesTo, productType]
      : appliesTo.filter((t) => t !== productType);
    setValue('applies_to', next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="space-y-5 px-4 pb-6"
    >
      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="coupon-code">Code</Label>
          <Input
            id="coupon-code"
            placeholder="WELCOME10"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono uppercase"
            disabled={isSubmitting}
            {...register('code')}
          />
          <p className="text-xs text-ink-faint">
            Saved upper-cased, so <span className="font-mono">welcome10</span> and{' '}
            <span className="font-mono">WELCOME10</span> are the same coupon.
          </p>
          {errors.code && (
            <p className="text-xs text-destructive">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="coupon-status">Status</Label>
          <Select
            value={status}
            onValueChange={(next: string | null) =>
              setValue('status', (next ?? 'draft') as CouponFormValues['status'], {
                shouldDirty: true,
              })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger id="coupon-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUPON_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {COUPON_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-ink-faint">
            Only <span className="font-medium">Active</span> coupons are accepted at
            checkout, and only inside the window below.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="coupon-description">Description (optional)</Label>
        <Textarea
          id="coupon-description"
          placeholder="Internal note — what this offer is for."
          disabled={isSubmitting}
          style={{ minHeight: '64px' }}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* ── Discount ─────────────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-lg border border-line bg-surface-raised/40 p-3">
        <div className="space-y-2">
          <Label htmlFor="coupon-type">Discount type</Label>
          <Select
            value={type}
            onValueChange={(next: string | null) =>
              setValue('type', (next ?? 'percent') as CouponFormValues['type'], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            disabled={isSubmitting}
          >
            <SelectTrigger id="coupon-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUPON_TYPES.map((option) => (
                <SelectItem key={option} value={option}>
                  {COUPON_TYPE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showValue ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-value">
                {type === 'percent' ? 'Percentage off' : 'Amount off (₹)'}
              </Label>
              <Input
                id="coupon-value"
                type="number"
                inputMode="decimal"
                min={0}
                max={type === 'percent' ? 100 : undefined}
                step={0.01}
                placeholder={type === 'percent' ? '10' : '250.00'}
                disabled={isSubmitting}
                {...register('value', { setValueAs: optionalNumber })}
              />
              {errors.value && (
                <p className="text-xs text-destructive">{errors.value.message}</p>
              )}
            </div>

            {showMaxDiscount && (
              <div className="space-y-2">
                <Label htmlFor="coupon-max-discount">Maximum discount (₹)</Label>
                <Input
                  id="coupon-max-discount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  placeholder="No ceiling"
                  disabled={isSubmitting}
                  {...register('max_discount', { setValueAs: optionalNumber })}
                />
                <p className="text-xs text-ink-faint">
                  Caps what the percentage can take off. Leave empty for no ceiling.
                </p>
                {errors.max_discount && (
                  <p className="text-xs text-destructive">
                    {errors.max_discount.message}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            Free shipping zeroes the shipping charge instead of reducing the
            subtotal, so it carries no value and no ceiling. It applies to{' '}
            <span className="font-medium text-ink">shipped lines only</span> — a
            cart with nothing shipped is told so at checkout.
          </p>
        )}

        <div className="space-y-2 sm:max-w-[50%]">
          <Label htmlFor="coupon-min-order">Minimum order (₹, optional)</Label>
          <Input
            id="coupon-min-order"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="No minimum"
            disabled={isSubmitting}
            {...register('min_order', { setValueAs: optionalNumber })}
          />
          <p className="text-xs text-ink-faint">
            Measured against the whole cart subtotal (GST inclusive), not just the
            products this coupon applies to.
          </p>
          {errors.min_order && (
            <p className="text-xs text-destructive">{errors.min_order.message}</p>
          )}
        </div>
      </div>

      {/* ── Scope ────────────────────────────────────────────────────────── */}
      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">Applies to</legend>
        <p className="text-xs text-ink-faint">
          Leave every box clear to apply the discount to all four product types.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRODUCT_TYPES.map((productType) => (
            <Label
              key={productType}
              className="cursor-pointer gap-2 rounded-md border border-line px-3 py-2 font-normal hover:bg-surface-raised/60"
            >
              <Checkbox
                checked={appliesTo.includes(productType)}
                onCheckedChange={(checked: boolean) =>
                  toggleProductType(productType, checked)
                }
                disabled={isSubmitting}
              />
              {PRODUCT_TYPE_LABELS[productType]}
            </Label>
          ))}
        </div>
        {errors.applies_to && (
          <p className="text-xs text-destructive">{errors.applies_to.message}</p>
        )}
      </fieldset>

      {/* ── Window ───────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="coupon-starts-at">Starts</Label>
          <Input
            id="coupon-starts-at"
            type="datetime-local"
            disabled={isSubmitting}
            {...register('starts_at')}
          />
          {errors.starts_at && (
            <p className="text-xs text-destructive">{errors.starts_at.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-ends-at">Ends</Label>
          <Input
            id="coupon-ends-at"
            type="datetime-local"
            disabled={isSubmitting}
            {...register('ends_at')}
          />
          {errors.ends_at && (
            <p className="text-xs text-destructive">{errors.ends_at.message}</p>
          )}
        </div>
        <p className="text-xs text-ink-faint sm:col-span-2">
          Both instants are read in India Standard Time, whatever this machine is
          set to.
        </p>
      </div>

      {/* ── Limits ───────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="coupon-usage-limit">Total redemptions (optional)</Label>
          <Input
            id="coupon-usage-limit"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="Unlimited"
            disabled={isSubmitting}
            {...register('usage_limit', { setValueAs: optionalNumber })}
          />
          {errors.usage_limit && (
            <p className="text-xs text-destructive">{errors.usage_limit.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="coupon-per-customer-limit">Per customer (optional)</Label>
          <Input
            id="coupon-per-customer-limit"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="Unlimited"
            disabled={isSubmitting}
            {...register('per_customer_limit', { setValueAs: optionalNumber })}
          />
          {errors.per_customer_limit && (
            <p className="text-xs text-destructive">
              {errors.per_customer_limit.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Saving…
            </span>
          ) : isEditing ? (
            'Save changes'
          ) : (
            'Create coupon'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
