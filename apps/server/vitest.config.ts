import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    // Each test starts a real server, so a busy machine can make one slow without anything being wrong
    test: { testTimeout: 15_000, hookTimeout: 15_000 },
    resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
});
