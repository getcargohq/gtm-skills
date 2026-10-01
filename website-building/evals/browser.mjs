import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// The exported site in a real browser, served the way Cargo's static routing
// serves it. See evals/acceptance.md for how to run it.
const source = fileURLToPath(new URL("../infra/apps/website", import.meta.url));
if (!process.env.WEBSITE_PLAYWRIGHT_MODULE)
  throw Error("Set WEBSITE_PLAYWRIGHT_MODULE to Playwright index.mjs.");
const { chromium } = await import(
  pathToFileURL(process.env.WEBSITE_PLAYWRIGHT_MODULE)
);
const fixture = mkdtempSync(join(tmpdir(), "website-building-browser-"));
const root = join(fixture, "app");
cpSync(source, root, {
  recursive: true,
  filter: (p) =>
    !/\/(node_modules|dist|out|\.next)(\/|$)/.test(p.slice(source.length)),
});
// A clean install from the committed lockfile. Turbopack refuses a
// node_modules symlinked from outside the app, so the fixture gets its own.
execFileSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], {
  cwd: root,
  stdio: "ignore",
});
// The package's own build: next build, then out/ -> dist/.
execFileSync("npm", ["run", "build"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
for (const page of [
  "index.html",
  "about/index.html",
  "robots.txt",
  "sitemap.xml",
])
  assert.ok(existsSync(join(root, "dist", page)), page);
const outcomes = ["The export writes home, about, robots.txt and sitemap.xml"];

// /about and /about/ read about/index.html; a file path is served as itself.
const distFile = (pathname) =>
  pathname.endsWith("/") || !extname(pathname)
    ? join(root, "dist", pathname, "index.html")
    : join(root, "dist", pathname);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const browser = await chromium.launch({
  ...(process.env.WEBSITE_CHROME
    ? { executablePath: process.env.WEBSITE_CHROME }
    : {}),
  headless: true,
});
const origin = "https://preview.fixture.test";
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) throw Error("Unexpected remote request: " + url.origin);
  const file = distFile(url.pathname);
  try {
    await route.fulfill({
      status: 200,
      body: readFileSync(file),
      contentType: types[extname(file)] ?? "text/plain",
    });
  } catch {
    await route.fulfill({ status: 404, body: "not found" });
  }
});

await page.goto(origin + "/");
assert.match(await page.title(), /\|/);
assert.equal(
  await page.locator('meta[name="robots"]').first().getAttribute("content"),
  "noindex, nofollow",
);
outcomes.push("A draft home page carries its own title and noindex");
await page.getByRole("link", { name: "About", exact: true }).first().click();
await page.waitForURL(/\/about\/$/);
await page.getByRole("heading", { level: 1 }).waitFor();
assert.match(await page.title(), /^About/);
outcomes.push("Client navigation reaches the prerendered about page");
await page.goto(origin + "/about");
assert.match(await page.title(), /^About/);
outcomes.push("Direct /about entry serves about/index.html under static routing");
await page.getByRole("button", { name: /Use (dark|light) theme/ }).click();
const dark = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
);
await page.reload();
assert.equal(
  await page.evaluate(() => document.documentElement.classList.contains("dark")),
  dark,
);
outcomes.push("Theme control persists across reloads");
await page.setViewportSize({ width: 390, height: 844 });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
outcomes.push("No horizontal overflow at 390px");
await page.screenshot({ path: join(fixture, "about-mobile.png"), fullPage: true });
assert.deepEqual(errors, []);
await browser.close();

writeFileSync(
  join(fixture, "results.json"),
  JSON.stringify({ kind: "local export in a browser", outcomes, fixture }, null, 2) +
    "\n",
);
console.log(JSON.stringify({ outcomes, evidence: fixture }, null, 2));
