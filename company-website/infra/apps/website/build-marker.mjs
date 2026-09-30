#!/usr/bin/env node
// Final step of `npm run build`: writes dist/website-build.json, the source
// marker `website.mjs verify` compares with the reviewed checkout.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeBuildMarker } from "./build-support.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
writeBuildMarker(root, resolve(root, process.argv[2] ?? "dist"));
