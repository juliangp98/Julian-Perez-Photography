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
  ]),
  {
    // API routes render JSX to strings on the server (React Email layouts,
    // react-pdf documents) inside try/catch — which is correct there: render()
    // and renderToBuffer() are awaited in the same block and their failures
    // ARE caught and reported to Sentry. The error-boundaries rule targets
    // client component trees, where deferred rendering escapes try/catch.
    files: ["src/app/api/**"],
    rules: {
      "react-hooks/error-boundaries": "off",
    },
  },
]);

export default eslintConfig;
