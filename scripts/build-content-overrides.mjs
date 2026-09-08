#!/usr/bin/env node
// Public overrides and pages are built together so drafts cannot leak.
import { buildSite } from "./build-site.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";
console.log(buildSite(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")));
