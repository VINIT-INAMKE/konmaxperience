import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import {
  noRawColorRules,
  noRawColorWarnRules,
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
    // Phase 34 rewrites the storefront wholesale; the rule warns there so the
    // debt is visible, not silent. The CI --max-warnings ceiling ratchets down
    // when Phase 34 lands.
    files: [
      "app/(public)/**/*.tsx",
      "components/public/**/*.tsx",
      "app/(auth)/**/*.tsx",
    ],
    rules: noRawColorWarnRules,
  },
  {
    // Frozen by the P4 brief and SPEC §7: the homepage owns its scoped styles.
    files: ["app/page.tsx", "components/public/ScrollVideoStory.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
]);

export default eslintConfig;
