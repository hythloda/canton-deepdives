# Canton Deep Dives

Static site for the Canton Foundation deep-dive calendar.

The page uses a lightweight Canton/member-site inspired design and publishes data from the Canton Deep Dive Monday board.

## Local Preview

Open `index.html` in a browser, or run any static file server from this directory.

## Publish

Cloudflare is configured to build from the GitHub repository root using `wrangler.jsonc`.

## Monday Sync

The repo includes automation for Monday board updates:

- `.github/workflows/sync-monday.yml` runs the sync.
- `scripts/sync-monday.mjs` reads Monday's API and rewrites `deepdives-data.js`.
- `workers/monday-github-dispatch.js` is a Cloudflare Worker webhook template that lets Monday trigger the GitHub Action.

See [docs/monday-sync-setup.md](docs/monday-sync-setup.md) for the setup steps and required secrets.
