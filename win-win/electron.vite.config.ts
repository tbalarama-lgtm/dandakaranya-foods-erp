import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": resolve("src/shared")
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
          inlineDynamicImports: true
        }
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer"),
        "@shared": resolve("src/shared")
      }
    }
  }
});
