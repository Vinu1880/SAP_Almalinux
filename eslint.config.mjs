import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    rules: {
      // Désactive le blocage sur `any`
      "@typescript-eslint/no-explicit-any": "off",

      // Les hooks React : mets en "warn" au lieu de "error"
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
