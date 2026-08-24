import { ImageResponse } from 'next/og';

/**
 * The brand's default social card (`STORE-01`), served at `/opengraph-image`.
 *
 * `lib/seo/metadata.ts` points `DEFAULT_OG_IMAGE` here, so every storefront page
 * without artwork of its own — `/shop`, `/experiences`, `/search`, a product
 * whose media library is still empty — shares as a designed card rather than as
 * a bare link with the site name.
 *
 * **The colours are literals, and they have to be.** This runs in the OG
 * renderer (Satori), which rasterises the tree with no browser, no stylesheet
 * and therefore no CSS custom properties: `var(--public-terracotta)` resolves to
 * nothing and paints black. The values below are the `--public-*` palette from
 * `app/tokens.css` transcribed by hand, and they must be updated together with
 * it. The single non-hex source value, `--public-bg: oklch(0.98 0.005 80)`, is
 * written as its sRGB equivalent `#faf8f5` — the same figure `app/layout.tsx`
 * already uses for the light `themeColor`, so the card and the browser chrome
 * agree.
 *
 * **No custom font is loaded on purpose.** Fetching Plus Jakarta Sans here would
 * put a network round-trip inside image generation and a failure would render an
 * empty card; the renderer's bundled sans is close enough in a 1200×630 crop and
 * cannot fail. Satori also lays out with flexbox only, which is why every
 * container below declares `display: 'flex'` explicitly.
 */

/** The `--public-*` palette, transcribed from `app/tokens.css`. */
const PALETTE = {
  bg: '#faf8f5',
  surface: '#f0ebe3',
  border: '#e8e0d4',
  fg: '#1c1917',
  muted: '#78716c',
  terracotta: '#c2410c',
  olive: '#365314',
  accent: '#a16207',
} as const;

export const alt = 'Konma — food, pantry and experiences from the villa kitchen';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '72px 80px',
          backgroundColor: PALETTE.bg,
          // A warm plate behind the wordmark, so the card reads as a surface
          // rather than as a screenshot of a blank page.
          backgroundImage: `radial-gradient(circle at 85% 12%, ${PALETTE.surface} 0%, ${PALETTE.bg} 55%)`,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              width: 22,
              height: 22,
              borderRadius: 22,
              backgroundColor: PALETTE.terracotta,
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              letterSpacing: 10,
              textTransform: 'uppercase',
              color: PALETTE.muted,
            }}
          >
            Konma
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 88,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: -2,
              color: PALETTE.fg,
              maxWidth: 900,
            }}
          >
            From the villa kitchen
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 34,
              lineHeight: 1.35,
              color: PALETTE.muted,
              maxWidth: 860,
            }}
          >
            Food cooked to order, pantry jars shipped across India, and a seat at
            the table.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 32,
            borderTop: `2px solid ${PALETTE.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {(['Shop', 'Pantry', 'Experiences'] as const).map((label, index) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 28,
                  color: PALETTE.fg,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    backgroundColor: [PALETTE.terracotta, PALETTE.accent, PALETTE.olive][index],
                  }}
                />
                {label}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: PALETTE.muted }}>
            konma.store
          </div>
        </div>
      </div>
    ),
    size,
  );
}
