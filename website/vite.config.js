import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, "index.html"),
        privacy: path.resolve(rootDir, "privacy.html"),
        support: path.resolve(rootDir, "support.html"),
      },
    },
  },
});
