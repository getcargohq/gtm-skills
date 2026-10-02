/**
 * Read the company's web presence into the cadence layer.
 *
 * The deterministic half of web capture. Every run it reads the same pages
 * the same way and asks one news question for a fixed window, then writes one
 * JSON snapshot under `cadence/log/raw/web/` with what changed since the
 * previous one: pages added, removed and changed, and news not seen before.
 * The baseline is the last snapshot committed to the repository, so the news
 * window runs from its date to today. It makes no judgement: no positioning,
 * no ICP, no insight. That is the
 * agent's job, and keeping the two apart is the point: a fetch loop an LLM
 * re-derives each week is a fetch loop that silently changes shape, and the
 * snapshot is what next week is diffed against.
 *
 * Run from the repo root:
 *
 *   npx tsx scripts/web-capture/collect/web.ts --dry-run
 *   npx tsx scripts/web-capture/collect/web.ts
 *   npx tsx scripts/web-capture/collect/web.ts --domain=acme.com
 *
 * `--dry-run` prints the domain, the pages, the window and what the run will
 * bill, without fetching or writing. `--domain=` overrides config.ts for one
 * run.
 *
 * Spend: pages are fetched like any visitor, for nothing. A page that comes
 * back as an empty JavaScript shell is read again through `parallel.extract`
 * (billed per URL), and the news is one `parallel.createTask` on the `lite`
 * processor. A normal week is that one task.
 *
 * One file per day, overwritten on a re-run: the snapshot is the web at that
 * moment, not an archive to append to.
 */
import { checkFlags, ConfigError, execute, whoami } from "./cli";
import {
  DOMAIN,
  FIRST_RUN_NEWS_DAYS,
  MIN_PAGE_CHARS,
  NEWS_PROCESSOR,
  PAGE_CHARS,
  PAGES,
} from "./config";
import {
  buildSnapshot,
  htmlToText,
  previousSnapshot,
  readExtract,
  readNews,
  resolveDomain,
  sha256,
  writeSnapshot,
  type Page,
} from "./snapshot";

const FETCH_TIMEOUT_MS = 15000;

const isoDate = (offsetDays = 0): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

async function readPage(url: string): Promise<Page> {
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; cargo-web-capture)" },
    });
  } catch (error) {
    return {
      url,
      status: "error",
      via: null,
      title: null,
      hash: null,
      text: "",
      error: (error as Error).message,
    };
  }
  if (response.status === 404 || response.status === 410) {
    return {
      url,
      status: "missing",
      via: null,
      title: null,
      hash: null,
      text: "",
    };
  }
  if (!response.ok) {
    return {
      url,
      status: "error",
      via: null,
      title: null,
      hash: null,
      text: "",
      error: `HTTP ${response.status}`,
    };
  }
  const { title, text } = htmlToText(await response.text(), PAGE_CHARS);
  if (text.length >= MIN_PAGE_CHARS) {
    return { url, status: "ok", via: "fetch", title, hash: sha256(text), text };
  }
  // An empty shell: the page is rendered by JavaScript. Read it rendered.
  const rendered = readExtract(
    execute("parallel", "extract", {
      urls: [url],
      objective: "The full text of this page, as a visitor reads it",
    }),
  ).slice(0, PAGE_CHARS);
  return rendered === ""
    ? { url, status: "ok", via: "fetch", title, hash: sha256(text), text }
    : {
        url,
        status: "ok",
        via: "extract",
        title,
        hash: sha256(rendered),
        text: rendered,
      };
}

try {
  const argv = process.argv.slice(2);
  checkFlags(argv, ["--dry-run", "--domain="]);
  const dryRun = argv.includes("--dry-run");
  const resolved = resolveDomain(
    argv.find((a) => a.startsWith("--domain="))?.slice("--domain=".length),
    DOMAIN,
  );
  if ("error" in resolved) throw new ConfigError(resolved.error);
  const { domain } = resolved;

  const workspace = whoami();
  console.error(`workspace: ${workspace.name}`);

  const today = isoDate();
  // The last committed snapshot is the baseline: the news window starts at
  // its date, so a quiet week that opened no pull request is not skipped.
  const previous = previousSnapshot(today);
  const from =
    previous === null
      ? isoDate(-FIRST_RUN_NEWS_DAYS)
      : previous.snapshot.collectedAt.slice(0, 10);
  const days = Math.round((Date.parse(today) - Date.parse(from)) / 86_400_000);
  const window = { from, to: today, days };
  const urls = PAGES.map(
    (path) => `https://${domain}${path === "/" ? "" : path}`,
  );

  if (dryRun) {
    console.log(
      JSON.stringify({
        domain,
        firstRun: previous === null,
        previous: previous?.path ?? null,
        pages: urls,
        newsWindow: window,
        bills: `1 parallel.createTask (${NEWS_PROCESSOR}), plus parallel.extract per page that renders in JavaScript`,
      }),
    );
    process.exit(0);
  }

  const pages: Page[] = [];
  for (const url of urls) pages.push(await readPage(url));

  const news = readNews(
    execute("parallel", "createTask", {
      input:
        `What did ${domain} announce, launch or get covered for between ${window.from} and ${window.to}? ` +
        "Product launches and changes, pricing changes, funding, partnerships, named customers, executive hires, " +
        "and press coverage. Only items dated inside that window, each with the page that reports it. " +
        "Nothing about other companies with a similar name.",
      processor: NEWS_PROCESSOR,
      outputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                title: { type: "string" },
                url: { type: "string" },
                kind: { type: "string" },
                summary: { type: "string" },
              },
              required: ["title", "url"],
            },
          },
        },
        required: ["items"],
      },
    }),
  ).filter((item) => item.date === null || item.date >= window.from);

  const snapshot = buildSnapshot({ domain, window, pages, news, previous });
  const path = writeSnapshot(snapshot, today);
  console.log(
    JSON.stringify({
      path,
      firstRun: snapshot.firstRun,
      pages: {
        ok: pages.filter((p) => p.status === "ok").length,
        missing: pages.filter((p) => p.status === "missing").length,
        error: pages.filter((p) => p.status === "error").length,
      },
      changes: {
        pagesAdded: snapshot.changes.pagesAdded.length,
        pagesRemoved: snapshot.changes.pagesRemoved.length,
        pagesChanged: snapshot.changes.pagesChanged.length,
        newsNew: snapshot.changes.newsNew.length,
      },
      spend: snapshot.spend,
    }),
  );
} catch (error) {
  console.error(
    error instanceof ConfigError
      ? `config: ${error.message}`
      : `error: ${(error as Error).message}`,
  );
  process.exit(1);
}
