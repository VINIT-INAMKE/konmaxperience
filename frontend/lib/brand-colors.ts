/**
 * The only colour constants allowed outside tokens.css. `BorderBeam` takes its
 * colours as *props*, not classes, so it cannot use a Tailwind utility — the
 * values below read brand tokens instead.
 *
 * SPEC §6.4 allows BorderBeam on new KDS / Pick & Pack orders only, so this
 * pair is the whole file. The Magic-UI prop defaults that used to live under a
 * deprecation line here were deleted in Task 19 together with the components
 * that consumed them (MagicCard, ShimmerButton, ShineBorder, PulsatingButton).
 *
 * Adding anything here needs a matching reason: if a value can be expressed as
 * a class, it belongs in tokens.css and a Tailwind utility, not in this file.
 */

export const BEAM_FROM = 'var(--accent)';
export const BEAM_TO = 'var(--gold)';
