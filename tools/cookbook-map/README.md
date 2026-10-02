# Cookbook map

A tldraw canvas of the cookbooks in this repo, in Cargo's colours: how they chain (recommended
paths and "Composes into" links), and the `infra/` files each one adds to a CDK project.
Cookbooks in an open pull request show dashed amber; planned ones dashed grey. Repo tooling
only: nothing here ships to a customer.

```sh
cd tools/cookbook-map
npm install
npm run dev                  # sync origin/main + open PRs, serve on http://localhost:55010
npm run sync -- --no-prs     # main only (offline, or gh not signed in)
```

- **Data**: `src/cookbooks.json` (gitignored), written by `scripts/sync.mjs` from git objects in
  this repository, so the branch you have checked out does not matter. Open PRs come from
  `gh pr list`; each PR head is fetched as `refs/remotes/origin/pr/<n>`.
- **Paths**: `src/paths.json` is editorial and the only file to edit by hand:
  - `lanes`: one row each, grouped by job. `after` starts a lane one column right of a cookbook;
    `parallel` draws no arrows between its steps; `linked` draws a two-headed arc between every
    pair of its steps (signals: no order, they stack). Consecutive steps get an arrow: green when both
    are live on main (what runs today), orange when one is still a pull request or planned (the
    recommended path).
  - `planned`: cookbooks that do not exist yet. A real cookbook with the same name replaces it.
  - `owners`: who is building what. `hidden`: cookbooks left off the map.
  - "Composes into" links that a path already implies are not drawn.
- **Rebuild** redraws only generated shapes; your own notes and arrows survive.
- **Download .tldr** saves a file you can import on tldraw.com (main menu, Import file). There it
  renders in tldraw's palette and fonts: same colour roles, not Cargo's exact hexes.
- The canvas persists in IndexedDB under `gtm-cookbooks-map`.
