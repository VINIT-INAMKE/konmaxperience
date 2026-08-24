/**
 * DESIGN-02 enforcement without a new dependency.
 *
 * `tokens.css` is the single source of colour. Anything that names a Tailwind
 * palette hue (`bg-red-500`), an arbitrary colour value (`text-[#c2410c]`,
 * `bg-[rgb(…)]`, `border-[oklch(…)]`) or a bare hex string in a JSX prop or an
 * inline style bypasses it and breaks the dark theme.
 *
 * The rules are expressed as `no-restricted-syntax` selectors so no plugin has
 * to be authored, published or resolved — ESLint matches the esquery attribute
 * regexes against string literal *values* and template chunks.
 *
 * Known gap (accepted, plan §Risks 8): a class assembled at runtime — e.g.
 * `` `bg-${hue}-500` `` — has no static chunk containing the hue, so it slips
 * through. The `TemplateElement` selector catches every static chunk; runtime
 * colour assembly is forbidden by convention and replaced by a `STATUS_BADGE`
 * lookup wherever a sweep found one.
 */

/**
 * A Tailwind colour utility naming a raw palette hue or an arbitrary colour.
 *
 * The leading `(?:^|[\s:])` accepts a variant prefix (`hover:`, `dark:`,
 * `md:`, `group-hover:`) as well as the start of the string or a space, which
 * is where the class actually appears in a `className`.
 *
 * Deviation from the plan text: the plan wrote `(?:^|\s)`, which misses every
 * variant-prefixed class (`hover:bg-red-500`). `[\s:]` closes that hole.
 */
const RAW_COLOR =
  '/(?:^|[\\s:])(?:bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|divide|caret|accent)-(?:\\[#|\\[rgb|\\[hsl|\\[oklch|\\[color|slate-|gray-|zinc-|neutral-|stone-|red-|orange-|amber-|yellow-|lime-|green-|emerald-|teal-|cyan-|sky-|blue-|indigo-|violet-|purple-|fuchsia-|pink-|rose-)/';

/** A bare hex colour in a JSX prop or an inline style: fill="#fff", { color: '#c2410c' }. */
const BARE_HEX = '/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/';

const MESSAGE =
  'No raw colour values (DESIGN-02). Use a token: bg-surface / text-ink / border-line / text-brand, ' +
  'or a STATUS_BADGE key from lib/status-styles. Arbitrary values must wrap in var(): bg-[var(--accent-soft)].';

/** @type {import('eslint').Linter.RulesRecord['no-restricted-syntax']} */
const SELECTORS = [
  { selector: `Literal[value=${RAW_COLOR}]`, message: MESSAGE },
  { selector: `TemplateElement[value.raw=${RAW_COLOR}]`, message: MESSAGE },
  { selector: `Literal[value=${BARE_HEX}]`, message: MESSAGE },
];

/** Error level — the surfaces P4 owns and Phase 34 does not rewrite. */
export const noRawColorRules = {
  'no-restricted-syntax': ['error', ...SELECTORS],
};

/** Warn level — slices Phase 34 rewrites wholesale; the debt stays visible, not silent. */
export const noRawColorWarnRules = {
  'no-restricted-syntax': ['warn', ...SELECTORS],
};

/**
 * SPEC §6.4 motion allowlist: BorderBeam, NumberTicker, confetti and the theme
 * toggler survive. Everything else in the Magic-UI set was deleted in Task 19;
 * this rule stops it being re-added by a `shadcn add` or a copy-paste.
 */
const BANNED_PRIMITIVES = [
  'blur-fade',
  'magic-card',
  'shimmer-button',
  'shine-border',
  'pulsating-button',
  'interactive-hover-button',
  'animated-list',
  'avatar-circles',
  'animated-circular-progress-bar',
  'text-animate',
  'hyper-text',
  'cool-mode',
];

const PRIMITIVE_MESSAGE =
  'Banned motion primitive (SPEC §6.4). The allowlist is BorderBeam (new KDS / Pick & Pack orders), ' +
  'NumberTicker, confetti and AnimatedThemeToggler. Use <Card>, <Button> and a token class instead.';

export const noBannedPrimitiveRules = {
  'no-restricted-imports': [
    'error',
    {
      paths: [
        ...BANNED_PRIMITIVES.flatMap((name) => [
          { name: `@/components/ui/${name}`, message: PRIMITIVE_MESSAGE },
          { name: `./${name}`, message: PRIMITIVE_MESSAGE },
          { name: `../ui/${name}`, message: PRIMITIVE_MESSAGE },
        ]),
        {
          name: 'framer-motion',
          message: 'framer-motion is not a dependency — import from `motion/react`.',
        },
        {
          name: 'shadcn',
          message:
            'shadcn is a devDependency (the component-registry CLI). Its runtime CSS is vendored in app/base-ui-variants.css.',
        },
      ],
      patterns: [
        {
          group: ['**/components/spectrumui/**', '**/components/patterns/**'],
          message: 'Deleted in P4 (SPEC §3.5). Use the shadcn primitives in components/ui.',
        },
      ],
    },
  ],
};
