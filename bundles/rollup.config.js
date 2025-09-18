// bundles/rollup.config.js
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "codemirror-bundle.js",
  output: {
    file: "../lib/codemirror-bundle.js",
    format: "es", // Changed from 'iife' to 'es'
    inlineDynamicImports: true,
  },
  plugins: [nodeResolve()],
};
