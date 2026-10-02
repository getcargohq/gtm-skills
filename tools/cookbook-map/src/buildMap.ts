// Draws the cookbook map from src/cookbooks.json (synced from the repo and its
// open pull requests) and src/paths.json (the editorial lanes). Every shape it
// creates carries meta.generated, so a rebuild deletes only what it drew and
// leaves your own notes, arrows and stickies alone.
import {
  AssetRecordType,
  createShapeId,
  toRichText,
  type Editor,
  type TLDefaultColorStyle,
  type TLRichText,
  type TLShapeId,
} from "tldraw";
import data from "./cookbooks.json";
import config from "./paths.json";

type Review = {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  author?: string;
};
type Cookbook = {
  name: string;
  title?: string;
  owner?: string;
  job: string;
  status: "main" | "pr" | "planned";
  state: string;
  composesInto: string[];
  infra: Record<string, string[]>;
  reviews: Review[];
};
type Lane = {
  name: string;
  why: string;
  after?: string;
  parallel?: boolean;
  linked?: boolean;
  steps: string[];
};
type Planned = { name: string; title: string; source: string; owner: string };

const owners: Record<string, string> = config.owners ?? {};
const hidden = new Set<string>(config.hidden ?? []);
const cookbooks: Cookbook[] = [
  ...(data.cookbooks as unknown as Cookbook[])
    .filter((c) => !hidden.has(c.name))
    .map((c) => ({ ...c, owner: owners[c.name] })),
  // Planned cookbooks exist only in paths.json; one already in the repo wins.
  ...(config.planned as Planned[])
    .filter((p) => !data.cookbooks.some((c) => c.name === p.name))
    .map((p): Cookbook => ({
      name: p.name,
      title: p.title,
      owner: p.owner,
      job: `Planned signal: ${p.title.toLowerCase()} from ${p.source}.`,
      status: "planned",
      state: "planned",
      composesInto: [],
      infra: {},
      reviews: [],
    })),
];
const byName = new Map(cookbooks.map((c) => [c.name, c]));
const GEN = { generated: true };
const REPO = "https://github.com/getcargohq/gtm-skills";

// Graph
const NODE = { w: 320, h: 104 };
const COL = NODE.w + 130;
const ROW = NODE.h + 80;
const LANE_W = 360;
// Details
const CARD_W = 440;
const CARD_GAP = { x: 70, y: 120 };
const PER_ROW = 5;
const PAD = 24;
const RESOURCE_ORDER = [
  ".",
  "agents",
  "plays",
  "tools",
  "models",
  "segments",
  "connectors",
  "mailboxes",
  "domains",
  "apps",
  "folders",
];

const color = (c: Cookbook): TLDefaultColorStyle =>
  (({ main: "green", pr: "yellow", planned: "grey" }) as const)[c.status];
const dash = (c: Cookbook) => (c.status === "main" ? "solid" : "dashed");
const label = (c: Cookbook) => c.title ?? c.name;
const isLive = (name: string) => byName.get(name)?.status === "main";

export const hasMap = (editor: Editor) =>
  editor.getCurrentPageShapes().some((s) => s.meta.generated);

export function clearMap(editor: Editor) {
  editor.deleteShapes(
    editor.getCurrentPageShapes().filter((s) => s.meta.generated),
  );
}

export function buildMap(editor: Editor, logoSrc: string) {
  const id = (key: string) => createShapeId(`gen-${key}`);
  const count = (s: Cookbook["status"]) =>
    cookbooks.filter((c) => c.status === s).length;

  // ── Header ─────────────────────────────────────────────────────────────
  const logo = AssetRecordType.createId("cargo-logo");
  if (!editor.getAsset(logo))
    editor.createAssets([
      {
        id: logo,
        typeName: "asset",
        type: "image",
        meta: {},
        props: {
          name: "cargo-logo.svg",
          src: logoSrc,
          w: 256,
          h: 256,
          mimeType: "image/svg+xml",
          isAnimated: false,
        },
      },
    ]);
  editor.createShape({
    id: id("logo"),
    type: "image",
    x: 0,
    y: -560,
    meta: GEN,
    props: { assetId: logo, w: 96, h: 96 },
  });
  text(editor, id("title"), 128, -566, 1600, "xl", rich("GTM cookbooks"));
  text(
    editor,
    id("subtitle"),
    128,
    -490,
    2000,
    "m",
    plain(
      `getcargohq/gtm-skills: ${count("main")} cookbooks on main, ${count("pr")} in open pull requests, ${count("planned")} planned. Synced from ${data.source} on ${data.syncedAt.slice(0, 10)}.`,
    ),
    "grey",
  );

  // Legend
  const ly = -380;
  node(
    editor,
    id("legend-main"),
    0,
    ly,
    { w: 200, h: 56 },
    "green",
    "solid",
    rich("On main"),
  );
  node(
    editor,
    id("legend-pr"),
    230,
    ly,
    { w: 200, h: 56 },
    "yellow",
    "dashed",
    rich("In a pull request"),
  );
  node(
    editor,
    id("legend-planned"),
    460,
    ly,
    { w: 200, h: 56 },
    "grey",
    "dashed",
    rich("Planned"),
  );
  looseArrow(editor, id("legend-path"), 720, ly + 28, 110, {
    color: "green",
    size: "m",
    dash: "solid",
  });
  text(
    editor,
    id("legend-path-t"),
    850,
    ly + 12,
    280,
    "s",
    plain("Next step, both live on main"),
  );
  looseArrow(editor, id("legend-next"), 1130, ly + 28, 110, {
    color: "orange",
    size: "m",
    dash: "solid",
  });
  text(
    editor,
    id("legend-next-t"),
    1260,
    ly + 12,
    320,
    "s",
    plain("Recommended next step, not live yet"),
  );
  looseArrow(editor, id("legend-rel"), 1600, ly + 28, 110, {
    color: "grey",
    size: "s",
    dash: "dashed",
    opacity: 0.6,
  });
  text(
    editor,
    id("legend-rel-t"),
    1730,
    ly + 12,
    420,
    "s",
    plain('"Composes into" in the SKILL.md'),
  );

  // ── How they connect ───────────────────────────────────────────────────
  text(editor, id("graph-title"), 0, -230, 1600, "l", rich("How they connect"));
  text(
    editor,
    id("graph-sub"),
    0,
    -170,
    2000,
    "s",
    plain(
      "Rows group cookbooks by job (src/paths.json). Green arrows are the path that runs today, between cookbooks live on main; orange ones are the recommended next steps that wait on a pull request or a planned cookbook. A dashed outline groups cookbooks with no order between them, like signals that stack on the same account.",
    ),
    "grey",
  );

  const lanes = [...(config.lanes as Lane[])];
  const pos = new Map<string, { col: number; row: number }>();
  const named = new Set(
    lanes.flatMap((l) => [...l.steps, ...(l.after ? [l.after] : [])]),
  );
  const unplaced = cookbooks
    .filter((c) => !named.has(c.name))
    .map((c) => c.name);
  if (unplaced.length)
    lanes.push({
      name: "Not on a path yet",
      why: "Add these to src/paths.json.",
      steps: unplaced,
    });

  const RIGHT = { x: 1, y: 0.5 },
    LEFT = { x: 0, y: 0.5 },
    BOTTOM = { x: 0.5, y: 1 };
  const pathEdges: { from: string; to: string; live: boolean }[] = [];
  lanes.forEach((lane, row) => {
    const y = row * ROW;
    text(
      editor,
      id(`lane-${row}`),
      0,
      y + 4,
      LANE_W - 50,
      "m",
      rich(lane.name),
    );
    text(
      editor,
      id(`lane-why-${row}`),
      0,
      y + 42,
      LANE_W - 50,
      "s",
      plain(lane.why),
      "grey",
    );
    let col =
      lane.after && pos.has(lane.after) ? pos.get(lane.after)!.col + 1 : 0;
    let prev = lane.after && pos.has(lane.after) ? lane.after : undefined;
    for (const name of lane.steps) {
      const c = byName.get(name);
      if (!c) {
        console.warn(
          `paths.json names "${name}", which is not a cookbook on main or in an open PR`,
        );
        continue;
      }
      if (!pos.has(name)) {
        pos.set(name, { col, row });
        node(
          editor,
          id(name),
          LANE_W + col * COL,
          y,
          NODE,
          color(c),
          dash(c),
          rich(label(c), statusLine(c, true)),
          link(c),
          "m",
        );
      }
      // Green is what runs today (both ends live); orange is where the path is
      // headed but a pull request or a planned cookbook still stands in the way.
      if (!lane.parallel && !lane.linked && prev)
        pathEdges.push({
          from: prev,
          to: name,
          live: isLive(prev) && isLive(name),
        });
      prev = name;
      col = pos.get(name)!.col + 1;
    }
  });

  // Pin the sides elbow arrows leave and enter by, so a step to another row
  // turns in the empty gutter instead of running through the cards beside it.
  for (const { from: a, to: b, live } of pathEdges) {
    const ra = pos.get(a)!.row,
      rb = pos.get(b)!.row;
    // Down or across: leave right, drop in the column gutter, enter left.
    // Dropping from a card's bottom would cut through the rows in between.
    const anchors =
      rb < ra ? { start: RIGHT, end: BOTTOM } : { start: RIGHT, end: LEFT };
    boundArrow(editor, id(a), id(b), {
      color: live ? "green" : "orange",
      size: "m",
      dash: "solid",
      kind: "elbow",
      anchors,
    });
  }

  // A linked lane has no order: every step stacks with every other (a new hire
  // at an account that also visits the site beats either alone). Pairwise arcs
  // turn five cards into ten crossing lines, so one outline around the row says
  // "any combination" instead, and drawing nothing between the cards keeps the
  // row readable.
  const linkedPairs = new Set<string>();
  lanes.forEach((lane, row) => {
    if (!lane.linked) return;
    const steps = lane.steps.filter((n) => pos.get(n)?.row === row);
    if (steps.length < 2) return;
    steps.forEach((a, i) =>
      steps
        .slice(i + 1)
        .forEach((b) => linkedPairs.add([a, b].sort().join("|"))),
    );
    const boxes = steps.map((n) => editor.getShapePageBounds(id(n))!);
    const PAD_X = 22,
      PAD_TOP = 18,
      LABEL_H = 40;
    const x = Math.min(...boxes.map((b) => b.minX)) - PAD_X;
    const y = Math.min(...boxes.map((b) => b.minY)) - PAD_TOP;
    const w = Math.max(...boxes.map((b) => b.maxX)) + PAD_X - x;
    const h = Math.max(...boxes.map((b) => b.maxY)) + LABEL_H - y;
    const group = id(`linked-${row}`);
    editor.createShape({
      id: group,
      type: "geo",
      x,
      y,
      meta: GEN,
      props: {
        geo: "rectangle",
        w,
        h,
        color: steps.every(isLive) ? "green" : "orange",
        labelColor: steps.every(isLive) ? "green" : "orange",
        fill: "none",
        dash: "dashed",
        size: "s",
        font: "sans",
        align: "end",
        verticalAlign: "end",
        richText: plain("Stack: any combination on the same account"),
      },
    });
    editor.sendToBack([group]);
  });

  // A "Composes into" link the recommended paths already imply (one cookbook
  // reaches the other by path arrows) adds a line and no information.
  const next = new Map<string, string[]>();
  for (const { from: a, to: b } of pathEdges)
    next.set(a, [...(next.get(a) ?? []), b]);
  const reaches = (
    from: string,
    to: string,
    seen = new Set<string>(),
  ): boolean =>
    (next.get(from) ?? []).some(
      (n) => n === to || (!seen.has(n) && (seen.add(n), reaches(n, to, seen))),
    );
  const relations = new Map<
    string,
    { from: string; to: string; both: boolean }
  >();
  for (const c of cookbooks)
    for (const t of c.composesInto) {
      if (t === c.name || !pos.has(t) || !pos.has(c.name)) continue;
      if (reaches(c.name, t) || reaches(t, c.name)) continue;
      if (linkedPairs.has([c.name, t].sort().join("|"))) continue;
      const key = [c.name, t].sort().join("|");
      const seen = relations.get(key);
      if (seen) seen.both ||= seen.from !== c.name;
      else relations.set(key, { from: c.name, to: t, both: false });
    }
  for (const { from, to, both } of relations.values()) {
    const a = pos.get(from)!,
      b = pos.get(to)!;
    // Arc away from the straight path arrows; flip the bend with direction so
    // a pair of relations between the same rows don't sit on top of each other.
    const bend = (a.row === b.row ? 70 : 40) * (a.col <= b.col ? 1 : -1);
    boundArrow(editor, id(from), id(to), {
      color: "grey",
      size: "s",
      dash: "dashed",
      both,
      bend,
      opacity: 0.4,
    });
  }

  // ── Inside each cookbook ───────────────────────────────────────────────
  const graphBottom = lanes.length * ROW;
  const top = graphBottom + 220;
  text(
    editor,
    id("details-title"),
    0,
    top,
    1600,
    "l",
    rich("Inside each cookbook"),
  );
  text(
    editor,
    id("details-sub"),
    0,
    top + 60,
    2000,
    "s",
    plain(
      "The infra/ files each cookbook adds to your CDK project, grouped by resource kind.",
    ),
    "grey",
  );

  const order = [...pos.entries()]
    .sort(([, a], [, b]) => a.row - b.row || a.col - b.col)
    .map(([n]) => n);
  let y = top + 200;
  for (let i = 0; i < order.length; i += PER_ROW) {
    const heights = order
      .slice(i, i + PER_ROW)
      .map((name, j) =>
        card(editor, byName.get(name)!, LANE_W + j * (CARD_W + CARD_GAP.x), y),
      );
    y += Math.max(...heights) + CARD_GAP.y;
  }
}

/** One cookbook's detail card: a frame holding its status, job, infra files and relations. Returns its height. */
function card(editor: Editor, c: Cookbook, x: number, y: number) {
  const frame = createShapeId(`gen-card-${c.name}`);
  editor.createShape({
    id: frame,
    type: "frame",
    x,
    y,
    meta: GEN,
    props: { name: label(c), w: CARD_W, h: 400, color: color(c) },
  });
  const inner = CARD_W - PAD * 2;
  let cy = PAD;
  const stack = (sid: TLShapeId, gap = 14) => {
    cy += editor.getShapePageBounds(sid)!.h + gap;
  };

  const status = createShapeId(`gen-card-status-${c.name}`);
  text(
    editor,
    status,
    PAD,
    cy,
    inner,
    "s",
    rich(statusLine(c)),
    color(c),
    frame,
  );
  stack(status, 6);

  const job = createShapeId(`gen-card-job-${c.name}`);
  text(
    editor,
    job,
    PAD,
    cy,
    inner,
    "s",
    plain(clip(c.job, 230)),
    "black",
    frame,
  );
  stack(job, 18);

  const infra = createShapeId(`gen-card-infra-${c.name}`);
  if (c.status !== "planned")
    editor.createShape({
      id: infra,
      type: "geo",
      parentId: frame,
      x: PAD,
      y: cy,
      meta: GEN,
      props: {
        geo: "rectangle",
        w: inner,
        h: 40,
        color: "grey",
        labelColor: "black",
        fill: "semi",
        dash: "solid",
        size: "s",
        font: "mono",
        align: "start",
        verticalAlign: "start",
        richText: infraTree(c.infra),
      },
    });
  if (c.status !== "planned") stack(infra, 16);

  const peers = c.composesInto.filter((n) => byName.has(n) && n !== c.name);
  if (peers.length) {
    const rel = createShapeId(`gen-card-rel-${c.name}`);
    text(
      editor,
      rel,
      PAD,
      cy,
      inner,
      "s",
      plain(`Composes into ${peers.join(", ")}`),
      "grey",
      frame,
    );
    stack(rel, 0);
  }
  const h = cy + PAD;
  editor.updateShape({ id: frame, type: "frame", props: { h } });
  return h;
}

function infraTree(infra: Record<string, string[]>): TLRichText {
  const kinds = Object.keys(infra).sort((a, b) => rank(a) - rank(b));
  const lines: ReturnType<typeof para>[] = [];
  for (const kind of kinds) {
    lines.push(para(kind === "." ? "infra/" : `${kind}/`, true));
    const files = infra[kind];
    files.forEach((f, i) =>
      lines.push(para(`${i === files.length - 1 ? "└─" : "├─"} ${f}`)),
    );
  }
  return {
    type: "doc",
    content: lines.length ? lines : [para("no infra/ files")],
  };
}
const rank = (kind: string) => RESOURCE_ORDER.indexOf(kind) + 1 || 99;

/** Where the cookbook stands. `short` is the graph node's one-liner; the detail card gets the full line. */
function statusLine(c: Cookbook, short = false) {
  const by = c.owner ? ` · ${c.owner}` : "";
  return status(c, short) + by;
}

function status(c: Cookbook, short: boolean) {
  const prs = (rs: Review[]) => rs.map((r) => `#${r.number}`).join(", ");
  if (c.status === "planned") return "Planned";
  if (c.status === "pr") {
    const [first, ...more] = c.reviews;
    if (short) return `PR #${first.number}${first.isDraft ? " (draft)" : ""}`;
    return (
      `PR #${first.number}${first.isDraft ? " (draft)" : ""} · in review` +
      (more.length ? ` · also in ${prs(more)}` : "")
    );
  }
  if (short)
    return c.reviews.length
      ? `On main · update in ${prs(c.reviews)}`
      : "On main";
  return (
    `On main · ${c.state}` +
    (c.reviews.length ? ` · update in ${prs(c.reviews)}` : "")
  );
}

const link = (c: Cookbook) =>
  ({ pr: c.reviews[0]?.url, main: `${REPO}/tree/main/${c.name}`, planned: "" })[
    c.status
  ] ?? "";

// ── Shape helpers ──────────────────────────────────────────────────────────

function para(t: string, bold = false) {
  return {
    type: "paragraph",
    content: [
      { type: "text", text: t, ...(bold ? { marks: [{ type: "bold" }] } : {}) },
    ],
  };
}
const plain = (t: string): TLRichText => ({ type: "doc", content: [para(t)] });
const rich = (title: string, ...lines: string[]): TLRichText => ({
  type: "doc",
  content: [para(title, true), ...lines.filter(Boolean).map((l) => para(l))],
});

function text(
  editor: Editor,
  id: TLShapeId,
  x: number,
  y: number,
  w: number,
  size: "s" | "m" | "l" | "xl",
  richText: TLRichText,
  color: TLDefaultColorStyle = "black",
  parentId?: TLShapeId,
) {
  editor.createShape({
    id,
    type: "text",
    x,
    y,
    parentId,
    meta: GEN,
    props: {
      richText,
      w,
      autoSize: false,
      size,
      color,
      font: "sans",
      textAlign: "start",
    },
  });
}

function node(
  editor: Editor,
  id: TLShapeId,
  x: number,
  y: number,
  box: { w: number; h: number },
  color: TLDefaultColorStyle,
  dash: "solid" | "dashed",
  richText: TLRichText,
  url = "",
  size: "s" | "m" = "s",
) {
  editor.createShape({
    id,
    type: "geo",
    x,
    y,
    meta: GEN,
    props: {
      geo: "rectangle",
      ...box,
      color,
      labelColor: "black",
      fill: "semi",
      dash,
      size,
      font: "sans",
      align: "start",
      verticalAlign: "middle",
      richText,
      url,
    },
  });
}

type Anchor = { x: number; y: number };
type ArrowStyle = {
  color: TLDefaultColorStyle;
  size: "s" | "m";
  dash: "solid" | "dashed";
  kind?: "arc" | "elbow";
  both?: boolean;
  bend?: number;
  opacity?: number;
  anchors?: { start: Anchor; end: Anchor };
};

function arrowProps(o: ArrowStyle) {
  return {
    color: o.color,
    size: o.size,
    dash: o.dash,
    kind: o.kind ?? "arc",
    bend: o.bend ?? 0,
    arrowheadStart: o.both ? "arrow" : "none",
    arrowheadEnd: "arrow",
    richText: toRichText(""),
  } as const;
}

function looseArrow(
  editor: Editor,
  id: TLShapeId,
  x: number,
  y: number,
  length: number,
  o: ArrowStyle,
) {
  editor.createShape({
    id,
    type: "arrow",
    x,
    y,
    opacity: o.opacity ?? 1,
    meta: GEN,
    props: {
      ...arrowProps(o),
      start: { x: 0, y: 0 },
      end: { x: length, y: 0 },
    },
  });
}

function boundArrow(
  editor: Editor,
  from: TLShapeId,
  to: TLShapeId,
  o: ArrowStyle,
) {
  const a = editor.getShapePageBounds(from)!.center;
  const b = editor.getShapePageBounds(to)!.center;
  const id = createShapeId();
  editor.createShape({
    id,
    type: "arrow",
    x: a.x,
    y: a.y,
    opacity: o.opacity ?? 1,
    meta: GEN,
    props: {
      ...arrowProps(o),
      start: { x: 0, y: 0 },
      end: { x: b.x - a.x, y: b.y - a.y },
    },
  });
  const bind = (toId: TLShapeId, terminal: "start" | "end") => ({
    type: "arrow" as const,
    fromId: id,
    toId,
    props: {
      terminal,
      normalizedAnchor: o.anchors?.[terminal] ?? { x: 0.5, y: 0.5 },
      isExact: false,
      isPrecise: !!o.anchors,
      snap: "none" as const,
    },
  });
  editor.createBindings([bind(from, "start"), bind(to, "end")]);
}

function clip(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "…";
}
