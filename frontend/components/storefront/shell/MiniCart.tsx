'use client';

/**
 * ⚠️ PLACEHOLDER — this file belongs to **P5b Task 8** (`p5b-cart-engine`), not
 * to Task 4.
 *
 * Task 4 (the storefront shell) owns `components/storefront/shell/**` *except*
 * this one file, and needs a module to import so the shell compiles and the
 * mini-cart mount point is real. Task 8 replaces the whole file with the actual
 * sheet — lines with thumbnails, variant names, quantity steppers, per-line
 * prices, "Subtotal (incl. GST)" and **no grand total** (P5b decision 6), plus a
 * "View cart" link to `/cart` and a "Checkout" link to `/checkout`, with
 * unavailable lines dimmed and carrying their `unavailable_reason`.
 *
 * **At merge, Task 8's version wins.** The only thing that must survive from
 * here is the contract below, which `MiniCartTrigger` calls:
 *
 *     export function MiniCart(props: MiniCartProps): ReactNode
 *     interface MiniCartProps { open: boolean; onOpenChange: (open: boolean) => void }
 *
 * That is the standard controlled-`Sheet` shape, so Task 8's implementation can
 * pass `open`/`onOpenChange` straight through to `<Sheet>`. Rendering `null`
 * here is deliberate: an empty drawer is obviously unfinished, whereas a
 * half-built one would look shipped.
 */
export interface MiniCartProps {
  /** Whether the drawer is open. Owned by `MiniCartTrigger`. */
  open: boolean;
  /** Called with the next open state — pass straight to `<Sheet onOpenChange>`. */
  onOpenChange: (open: boolean) => void;
}

export function MiniCart(props: MiniCartProps) {
  void props;
  return null;
}
