// Copy only deliverable source to an external build directory, without touching repository node_modules.
// Used by this worker; normal continuation jobs can use npm ci in their checkout.
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const destination = process.argv[2];
if (!destination || !resolve(destination).startsWith("/tmp/"))
  throw new Error("Supply a build folder under /tmp");
mkdirSync(destination, { recursive: true });
for (const name of [
  "src",
  "public",
  "tests",
  "scripts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
])
  cpSync(name, resolve(destination, name), { recursive: true });
