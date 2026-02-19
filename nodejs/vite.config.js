import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const websiteRoot = resolve(rootDir, "../src");
const websitePublic = resolve(rootDir, "../public");
const websiteDist = resolve(rootDir, "../dist");

export default defineConfig(({ command }) => ({
  root: websiteRoot,
  publicDir: websitePublic,
  base: command === "build" ? "/Website/" : "/",
  build: {
    outDir: websiteDist,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(rootDir, "../src/index.html"),
        resources: resolve(rootDir, "../src/resources/index.html"),
        credit: resolve(rootDir, "../src/credit/index.html"),
        ninconvert: resolve(rootDir, "../src/ninconvert/index.html"),
        placeholder: resolve(rootDir, "../src/placeholder/index.html")
      }
    }
  }
}));
