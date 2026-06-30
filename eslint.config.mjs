import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Vendored third-party code (MIT pandoc-wasm wrapper) — not ours to lint.
    "lib/pandoc/pandoc-core.js",
    // Vendored/minified browser assets — not ours to lint.
    "public/lib/imagetracer_v1.2.6.js",
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
