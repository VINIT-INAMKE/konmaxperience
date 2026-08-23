/**
 * Guide sections carry an author-chosen accent colour. The picker offers the brand
 * and status tokens from `app/tokens.css` rather than raw hues, so a section's
 * colour follows the theme in light and dark (SPEC §7).
 *
 * Values are stored on the section row, so rows authored before the sweep still
 * hold a bare hex string — every helper here accepts both.
 */

export const GUIDE_ACCENT_TOKENS: { label: string; value: string }[] = [
  { label: 'Terracotta', value: 'var(--accent)' },
  { label: 'Olive', value: 'var(--leaf)' },
  { label: 'Amber', value: 'var(--gold)' },
  { label: 'Blue', value: 'var(--status-info)' },
  { label: 'Green', value: 'var(--status-good)' },
  { label: 'Ochre', value: 'var(--status-warning)' },
  { label: 'Rose', value: 'var(--status-serious)' },
  { label: 'Stone', value: 'var(--ink-muted)' },
];

/**
 * A 12% wash of the section's accent, for the icon tile behind its glyph.
 * `color-mix` accepts both a `var(--token)` and a legacy `#rrggbb`, which the old
 * `accent_color + '20'` string concatenation did not.
 */
export function guideAccentTint(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  return `color-mix(in oklab, ${color} 12%, transparent)`;
}
