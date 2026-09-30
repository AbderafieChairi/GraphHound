<div align="center">

#  GraphHound

![Logo](assets/graphhound.png)

**Open Source Data Network Analysis.**

Upload your SharpHound collection data, write Cypher, hunt attack paths, tag high-value targets, and build shareable analysis reports — all running locally, no external server required.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![React](https://img.shields.io/badge/React-19-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)
![TanStack Start](https://img.shields.io/badge/TanStack%20Start-1.x-ff4154)
![Cypher](https://img.shields.io/badge/query-Cypher-008cc1)

</div>

---

## Table of Contents

- [What is GraphHound?](#what-is-graphhound)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Supported Data Formats](#supported-data-formats)
- [Production Build & Deployment](#production-build--deployment)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Development](#development)
- [FAQ & Troubleshooting](#faq--troubleshooting)
- [License](#license)
- [Contributing](#contributing)

---

## What is GraphHound?

GraphHound is a self-contained web application for **offensive and defensive Active Directory analysis**. It ingests the JSON produced by [SharpHound](https://github.com/SpecterOps/SharpHound) (Community Edition **and** legacy formats), stores it in a local embedded graph database, and lets you explore it interactively:

- Run **Cypher** queries and visualize the results on an interactive graph canvas.
- Find **attack paths** between any two principals with BFS/DFS traversal.
- **Tag** nodes (Owned, High Value, High Privileged…) and query them as first-class labels.
- Assemble reusable, multi-cell **analysis reports** and export them as standalone HTML.

Everything runs on your machine. Your collection data never leaves your computer — it lives in local SQLite files under `./data`.

> ⚠️ **Intended for authorized security testing, red/blue-team engagements, CTFs, and education.** Only analyze data from environments you are authorized to assess.

---

## Features

| | |
|---|---|
| 🔎 **Cypher workspace** | Full query editor with autocomplete, search history, and saved queries. |
| 🕸️ **Interactive graph** | Cytoscape.js canvas with dagre layouts, kind-specific icons, and status badges. |
| 🧭 **Path Finder** | Shortest-path (BFS) and all-paths (DFS) traversal between two nodes, with live results and HTML export. |
| 🏷️ **Analyst tags** | Mark nodes as `Owned`, `High Value`, `High Privileged`, etc. — mirrored to graph labels for querying (`MATCH (u:Owned) RETURN u`). |
| 📓 **Report notebooks** | Multi-section report cards with templated queries, per-cell inputs, and one-click **standalone HTML export**. |
| 🗂️ **Environments** | Keep multiple isolated datasets (e.g. per engagement); each maps to its own database file. |
| 🎨 **Themes & icons** | Built-in color themes, a **custom theme color-picker**, and importable FontAwesome icon sets. |
| 📥 **Flexible ingest** | Drag-and-drop SharpHound JSON (CE or legacy) — parsed entirely in the browser/server, no external services. |
| ⚡ **Runs anywhere** | Pure JS/TS SQLite (no native compilation) — clone, install, run. |

---

## Requirements

You need **one** of the following runtimes:

- **[Bun](https://bun.sh) ≥ 1.1** — recommended (the repo is set up for it), **or**
- **[Node.js](https://nodejs.org) ≥ 22** — required for the built-in `node:sqlite` module that powers the storage layer.

That's it. GraphHound uses a pure-JS SQLite shim, so there is **no native build step** (no `node-gyp`, no C++ toolchain).

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/graphhound.git
cd graphhound

# 2. Install dependencies
bun install
# — or, with npm —
npm install
```

---

## Getting Started

Start the development server:

```bash
bun run dev
```

<sub>(or `npm run dev`)</sub>

Then open **http://localhost:5173** in your browser.

On first launch GraphHound creates a `./data` directory and seeds a default environment, a baseline report, a set of predefined analysis queries, and the built-in themes.

### Your first analysis in 3 steps

1. **Upload data** — click the **Upload** button and drop your SharpHound `.json` files (see [Supported Data Formats](#supported-data-formats)).
2. **Query** — type a Cypher query in the composer and press **Ctrl/⌘ + Enter**, e.g.:
   ```cypher
   MATCH (u:Base)-[r:MemberOf]->(g:Base)
   WHERE g.name CONTAINS 'DOMAIN ADMINS'
   RETURN u AS source, type(r) AS edge, g AS target
   LIMIT 100
   ```
3. **Explore** — click nodes to inspect properties, tag interesting principals, and open the **Paths** tab to hunt for attack paths.

---

## Usage Guide

### Cypher Workspace
The main panel is a Cypher editor backed by [LeanGraph](https://www.npmjs.com/package/leangraph). Every node carries a universal `:Base` label plus its kind label (`:User`, `:Computer`, `:Group`, `:GPO`, `:OU`, `:Domain`, …), so most queries start from `(:Base)`. Query history and saved queries are kept per environment.

### Path Finder (Paths tab)
Pick a **start** and **end** node, choose **BFS** (shortest path) or **DFS**, set a max depth, and run. Discovered paths stream in live and render on the canvas. Export the full set as a self-contained HTML report.

### Analyst Tags
Tag any node from its detail view. Tags are stored locally and mirrored into the graph as labels, so you can immediately query them:
```cypher
MATCH (n:Owned)-[r]->(m) RETURN n, r, m
```

### Report Notebooks (Reports tab)
Reports are notebooks of query "cells", each with a Markdown description, a templated Cypher query (`%var1` is replaced by the cell input), and an input control (node search, string, number, date, or none). Reports can be **imported/exported as JSON** and **exported as standalone HTML** (graph + tables, fully offline).

### Environments
Use the environment selector (top-left) to create isolated datasets. Each environment maps to its own `./data/<project>.db` file; the default **Shared** environment uses `./data/bh.db`.

### Themes & Icons (Settings)
Choose from built-in themes, define your own with the **Custom** color-picker, and import FontAwesome **icon sets** to restyle graph nodes per kind.

---

## Supported Data Formats

GraphHound parses SharpHound output on ingest and auto-detects the format:

- **Community Edition (CE)** — files with a `graph.nodes` / `graph.edges` structure.
- **Legacy SharpHound** — the classic `data[]` collection files (`users.json`, `computers.json`, `groups.json`, `gpos.json`, `ous.json`, `containers.json`, `domains.json`, and ADCS files).

Recognized node kinds include: `User`, `Computer`, `Group`, `GPO`, `OU`, `Container`, `Domain`, `AIACA`, `RootCA`, `EnterpriseCA`, `NTAuthStore`, `CertTemplate`. Relationships such as `MemberOf`, `AdminTo`, `HasSession`, `Contains`, `GpLink`, `HasSIDHistory`, `AllowedToDelegate`, `CanRDP`, and ACE rights (`GenericAll`, `WriteDacl`, …) are derived automatically.

> You can drop multiple files at once — they are merged into the active environment.

---

## Production Build & Deployment

Build the optimized bundle:

```bash
bun run build
```

This produces a `dist/` directory containing a **self-contained Node server**:

```bash
cd dist
npm install        # installs the single runtime dependency (srvx)
node server.js     # serves on http://localhost:3000 (override with PORT)
```

```bash
PORT=8080 node server.js
```

The standalone server serves the client assets and handles server functions; your data continues to persist in `./data`.

### CI/CD & Releases

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request to `main`. It installs dependencies, typechecks, runs the tests (`bun run test`), builds the production bundle and smoke-tests the server.
- **Release** (`.github/workflows/release.yml`) runs when you push a `v*` tag. It builds the app and publishes a GitHub Release with `graphhound-<tag>.tar.gz`/`.zip`. After extracting, run `npm install` then `npm start` inside the `graphhound` folder.

```bash
git tag v0.0.1
git push origin v0.0.1
```

Requires **Node.js 22.5+** at runtime (uses `node:sqlite`).

---

## Project Structure

```
graphhound/
├── data/                 # Local SQLite databases (git-ignored, created at runtime)
├── examples/             # Sample Cypher query packs & icon/edge definitions
├── kb/docs.md            # In-depth architecture & data-model documentation
├── src/
│   ├── components/       # React UI (graph canvas, sidebar, report, settings…)
│   ├── hooks/            # Reusable React hooks
│   ├── lib/              # Data & logic layer
│   │   ├── registry/     # Registry DB, split per domain (env, themes, reports…)
│   │   ├── graph.server.ts   # LeanGraph store, ingest, Cypher execution
│   │   ├── graph.functions.ts# TanStack server-function RPC surface
│   │   └── sharphound.ts     # SharpHound JSON → graph model
│   ├── routes/           # TanStack Start file-based routes
│   └── vendor/           # Pure-JS better-sqlite3 → node:sqlite shim
└── vite.config.ts
```

📖 For architecture, the data models, and the registry schema, see **[`kb/docs.md`](kb/docs.md)**.

---

## Tech Stack

- **Framework:** [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router + Vite + Nitro)
- **Graph database:** [LeanGraph](https://www.npmjs.com/package/leangraph) over embedded SQLite (`node:sqlite` via a JS shim)
- **Visualization:** [Cytoscape.js](https://js.cytoscape.org/) + dagre layout
- **UI:** Radix UI + Tailwind CSS v4 + shadcn-style components
- **Tables:** TanStack Table · **Validation:** Zod · **Icons:** Lucide + FontAwesome

---

## Development

```bash
bun run dev          # start the dev server (http://localhost:5173)
bun run build        # production build → dist/
bun run preview      # preview the production build
bun run lint         # ESLint
bun run format       # Prettier
```

Type-check with:

```bash
npx tsc --noEmit
```

---

## FAQ & Troubleshooting

**The dev server won't start / SQLite errors.**
Make sure you're on **Node.js ≥ 22** (for `node:sqlite`) or using **Bun**. No native build tools are required.

**Where is my data stored?**
In `./data/*.db` (one file per environment). Delete a file to reset that environment. The directory is git-ignored.

**Can I use it offline?**
Yes — the app runs fully locally. Note that the **exported HTML reports** load Cytoscape from a CDN, so viewing an exported report needs internet (the app itself does not).

**Nothing shows in the graph after a query.**
Ensure your `RETURN` includes node columns (or `source`/`edge`/`target`). Node-only results render as a grid; path/relationship results render with edges.

---

## License

GraphHound is licensed under the [Apache License 2.0](LICENSE).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

---

<div align="center">
<sub>Built for authorized security analysis. Use responsibly.</sub>
</div>
