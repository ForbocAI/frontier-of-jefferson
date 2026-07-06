# Frontier of Jefferson Directory Guide

This folder is a self-contained design packet and browser viewer for **Frontier of Jefferson**, the 1899 Jefferson State frontier storybook. The higher-level world direction begins in French Gulch and expands through mining roads, company pressure, law, outlaws, work crews, ranch land, and contested routes. This directory is the working bundle for the actual Frontier of Jefferson lore packet, navigation index, and lightweight local viewer.

## What Lives Here

- `index.md`: master index for the packet. The viewer builds its sidebar from this file's `##` section headings and `- [Label](path)` entries.
- `index.html`: zero-build local viewer shell.
- `index.css`: styling for the viewer.
- `index.js`: sidebar parsing, hash routing, markdown loading, and rendering.
- `fp.js`: browser functional-programming helpers used by the viewer.
- `introduction/`, `cast/`, `regions/`, `prologue/`, `appendix/`, `rules/`, `play/`: the source markdown content organized by topic, each with a paired `images/` folder.

## How To Preview

The viewer uses `fetch()` to load markdown files, so it should be served over a local HTTP server rather than opened directly with `file://`.

```bash
cd frontier-of-jefferson
```

```bash
node scripts/serve-local.js 4173
```

Then open `http://127.0.0.1:4173/`.

This local server mirrors the Cloudflare Pages route behavior: Markdown and image assets are served directly, while clean reader routes such as `/cast/bear-sign` fall back to the app shell.

## Cloudflare Deploy

Pushes to GitHub can deploy this repo to Cloudflare Pages through [deploy-cloudflare-pages.yml](.github/workflows/deploy-cloudflare-pages.yml).

Set these repository settings before relying on the workflow:

- GitHub secret `CLOUDFLARE_API_TOKEN`: API token with Cloudflare Pages edit access for the target account.
- GitHub variable `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID that owns the Pages project.
- GitHub variable `CLOUDFLARE_PAGES_PROJECT_NAME`: existing Cloudflare Pages project name for Frontier of Jefferson.

The workflow uses direct upload with `wrangler pages deploy`, after staging a clean deploy directory that excludes repo-only files such as `.git`, `.github`, `scripts/`, and `README.md`. The staged `functions/[[path]].js` Function serves static assets first and falls back clean reader routes to `index.html`.

## Editing Workflow

1. Add or edit markdown files in the appropriate section folder.
2. Register every page in `index.md` using `- [Label](relative/path.md)`.
3. Keep top-level groups under `##` headings, since the viewer turns those into collapsible sidebar sections.
4. If a file is renamed or moved, update its entry in `index.md` and any relative links or image paths that point to it.
5. Leave `index.js` alone unless navigation or rendering behavior needs to change. Most routine work should stay in markdown.

## Authoring Notes

- Prefer focused documents over one oversized lore file.
- Keep links and image references relative to this directory so the viewer continues to work when served locally.
- The renderer is intentionally lightweight. It supports headings, lists, links, emphasis, inline code, horizontal rules, and images. More advanced markdown features may require renderer updates.
- `README.md` is the maintenance guide for this bundle, not the main in-world index. `index.md` remains the canonical table of contents for readers.

## Current Scope

The packet currently covers:

- introduction and world framing
- the cast of Jefferson: work crews, company men, lawmen, outlaws, and the Native families of Clear Creek and the Klamath
- regions: French Gulch, mining roads, camps, fords, tunnels, and contested routes
- prologue and appendix content
- rules for the table: outfitting, trail-boss guidance, asking the deck, tutorials, and contests
- frontier map generation notes
