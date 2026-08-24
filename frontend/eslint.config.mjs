import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import {
  noRawColorRules,
  noBannedPrimitiveRules,
} from "./eslint-rules/no-raw-colors.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler diagnostics: tracked as warnings until each component is refactored (P4).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/incompatible-library": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      // Hard correctness rules stay errors:
      "react-hooks/rules-of-hooks": "error",
      "prefer-const": "error",
    },
  },
  {
    // DESIGN-02 + DESIGN-04 + QA-04: the surfaces P4 owns. Errors, not warnings.
    files: [
      "app/(ops)/**/*.ts",
      "app/(ops)/**/*.tsx",
      "components/ops/**/*.ts",
      "components/ops/**/*.tsx",
      "components/ui/**/*.ts",
      "components/ui/**/*.tsx",
      "lib/**/*.ts",
      "lib/**/*.tsx",
    ],
    rules: {
      ...noRawColorRules,
      ...noBannedPrimitiveRules,
      // QA-04: no new `any` on the surfaces P4 owns.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // The customer-facing surface, all of it (P5b Task 20).
    //
    // P4 left a **warn-level** block over `app/(public)/**`, `components/public/**`
    // and `app/(auth)/**` as a debt ledger: Phase 34 was going to rewrite the
    // storefront wholesale, so raw colours there were visible but not fatal, and
    // only the not-yet-written `components/storefront/**` was held to an error.
    // Phase 34 has now landed — `components/storefront/**` *is* the storefront,
    // the superseded `components/public/*` shelves and the `app/(public)/profile`
    // page are gone, and what is left under `app/(public)/` is the new routes plus
    // thin redirects. There is nothing left for the ledger to excuse, so the two
    // blocks collapse into this one and the rule is an error everywhere a
    // customer can see. The CI `--max-warnings` ceiling ratchets down with it.
    //
    // `noBannedPrimitiveRules` rides along because the storefront is new ground
    // the P4 block (ops · ui · lib) does not cover, and the SPEC §6.4 motion
    // allowlist applies to it just as much.
    files: [
      "app/(public)/**/*.ts",
      "app/(public)/**/*.tsx",
      "app/(auth)/**/*.ts",
      "app/(auth)/**/*.tsx",
      "components/public/**/*.ts",
      "components/public/**/*.tsx",
      "components/storefront/**/*.ts",
      "components/storefront/**/*.tsx",
    ],
    rules: {
      ...noRawColorRules,
      ...noBannedPrimitiveRules,
    },
  },
  {
    // Frozen by the P4 brief and SPEC §1.3/§7: the homepage owns its scoped
    // styles. Ordering is load-bearing — this must stay last, because
    // `components/public/ScrollVideoStory.tsx` is inside the block above and the
    // final matching config wins.
    files: ["app/page.tsx", "components/public/ScrollVideoStory.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
]);

export default eslintConfig;
