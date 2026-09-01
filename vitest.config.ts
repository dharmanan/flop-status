import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const webRoot = fileURLToPath(new URL("./web/", import.meta.url));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    // The browser modules are served from the site root, so they import each
    // other with absolute paths. Map those to web/ so tests can execute the
    // real capability modules instead of only reading their source.
    alias: [
      {
        find: /^\/(identity-crypto\.js|capability-copy\.js|capabilities\/.+\.js)$/,
        replacement: `${webRoot}$1`,
      },
    ],
  },
});
