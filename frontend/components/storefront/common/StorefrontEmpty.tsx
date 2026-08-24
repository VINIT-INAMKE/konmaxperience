import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The storefront's empty state (`DESIGN-03`).
 *
 * Deliberately prop-driven rather than generically worded: "No products in
 * Pantry yet" and "No results for 'coconut'" are different messages and the
 * component refuses to average them into "Nothing here". `action` is plain data
 * (a label and an href) so a **server** page can render this without a client
 * boundary — no `onClick` prop exists, by design.
 */
export interface StorefrontEmptyAction {
  label: string;
  href: string;
}

export interface StorefrontEmptyProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: StorefrontEmptyAction;
  secondaryAction?: StorefrontEmptyAction;
  /** `page` centres in a tall well; `inline` sits inside a card or a column. */
  density?: 'page' | 'inline';
  className?: string;
}

export function StorefrontEmpty({
  title,
  description,
  icon: Icon = PackageOpen,
  action,
  secondaryAction,
  density = 'page',
  className,
}: StorefrontEmptyProps) {
  return (
    <div
      data-slot="storefront-empty"
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-warm bg-surface/60 text-center',
        density === 'page' ? 'gap-4 px-6 py-16' : 'gap-3 px-4 py-10',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-raised text-ink-muted">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-prose space-y-1.5">
        <h2 className={cn('font-semibold text-ink-strong', density === 'page' ? 'text-lg' : 'text-base')}>
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action ? (
            <Button size="lg" nativeButton={false} render={<Link href={action.href} />}>
              {action.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href={secondaryAction.href} />}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
