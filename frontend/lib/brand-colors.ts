/**
 * The only colour constants allowed outside tokens.css. These components take colours
 * as *props*, not classes, so they cannot use a Tailwind utility — the values below
 * read brand tokens instead.
 *
 * SPEC §6.4 allows BorderBeam on new KDS / Pick & Pack orders only. `BEAM_FROM` /
 * `BEAM_TO` are the surviving pair.
 *
 * Everything under the deprecation line is a Magic-UI prop default whose call sites
 * are removed by the Wave 1 sweeps (Tasks 7–9) and whose components are deleted by
 * Task 19. They are kept here — re-pointed at tokens, never at a raw hue — so the
 * tree type-checks between Wave 0 and Wave 4. Delete them with their last call site.
 */

// ── Surviving: BorderBeam ──
export const BEAM_FROM = 'var(--accent)';
export const BEAM_TO = 'var(--gold)';

// ── Deprecated: Magic-UI prop defaults, deleted with their call sites ──

/** @deprecated MagicCard gradient border — deleted with MagicCard (Task 19). */
export const GRADIENT_FROM = 'var(--accent)';
/** @deprecated MagicCard gradient border — deleted with MagicCard (Task 19). */
export const GRADIENT_TO = 'var(--gold)';
/** @deprecated MagicCard hover overlay — deleted with MagicCard (Task 19). */
export const GRADIENT_OVERLAY = 'var(--surface-raised)';
/** @deprecated MagicCard orb glow — deleted with MagicCard (Task 19). */
export const ORB_GLOW_FROM = 'var(--accent)';
/** @deprecated MagicCard orb glow — deleted with MagicCard (Task 19). */
export const ORB_GLOW_TO = 'var(--leaf)';
/**
 * @deprecated ShimmerButton sweep. Achromatic on purpose: `shimmer-button.tsx`
 * hard-codes `text-white`, so the ground must stay dark in *both* themes or the
 * label drops below AA. Deleted with ShimmerButton (Wave 1 sweeps + Task 19).
 */
export const SHIMMER_COLOR = '#ffffff';
/** @deprecated ShimmerButton ground — see `SHIMMER_COLOR`. */
export const SHIMMER_BG = 'rgba(0, 0, 0, 1)';
/** @deprecated ShineBorder default — deleted with ShineBorder (Task 19). */
export const SHINE_COLOR = 'var(--line-strong)';
/** @deprecated PulsatingButton default — deleted with PulsatingButton (Task 19). */
export const PULSE_COLOR = 'var(--accent-soft)';
