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
        // The optional (?:\?.*)? tolerates a cache-busting "?v=..." suffix, used
        // by dynamic `import("/foo.js?v=...")` calls elsewhere in web/ — plain
        // static imports never carry one, so this only widens what already matches.
        find: /^\/(identity-crypto\.js|capability-copy\.js|capabilities\/.+\.js|tclk-deal-refresh\.js)(?:\?.*)?$/,
        replacement: `${webRoot}$1`,
      },
    ],
  },
});
