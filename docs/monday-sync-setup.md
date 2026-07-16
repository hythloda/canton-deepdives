# Monday to GitHub Sync

This repo can update itself when the Monday board changes.

The flow is:

1. Monday board sends a webhook to a Cloudflare Worker.
2. The Worker triggers a GitHub `repository_dispatch` event.
3. GitHub Actions runs `scripts/sync-monday.mjs`.
4. The script reads the Monday board through the Monday API, filters rows where `Valid` is yes, rewrites `deepdives-data.js`, and bumps the script version in `index.html`.
5. The Action commits to `main`.
6. Cloudflare sees the new GitHub commit and deploys.

## 1. Create a Monday API Token

Create a Monday API token that can read the board.

Required scope:

- `boards:read`

Add it to GitHub:

1. Open `hythloda/canton-deepdives` on GitHub.
2. Go to Settings > Secrets and variables > Actions.
3. Add a repository secret named `MONDAY_API_TOKEN`.
4. Paste the Monday API token as the value.

## 2. Confirm the Board ID

The workflow is configured for board `18422413776`.

If the board changes, update `MONDAY_BOARD_ID` in `.github/workflows/sync-monday.yml`.

## 3. Create a GitHub Token for the Worker

Create a fine-grained GitHub personal access token.

Repository access:

- `hythloda/canton-deepdives`

Repository permissions:

- Contents: Read and write

The Worker uses this token only to call GitHub's `repository_dispatch` endpoint.

## 4. Deploy the Cloudflare Worker Webhook

Use `workers/monday-github-dispatch.js` as the Worker source.

Add these Worker secrets:

- `GITHUB_DISPATCH_TOKEN`: the GitHub token from step 3.
- `MONDAY_WEBHOOK_SECRET`: any long random string you choose.

The Monday webhook URL should include the secret as a query param:

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/?secret=YOUR_LONG_RANDOM_SECRET
```

The Worker handles Monday's URL verification challenge automatically by echoing the `challenge` field.

## 5. Add the Monday Webhook

In Monday:

1. Open the Canton Deep Dive Presentations board.
2. Open Automations / Integrations.
3. Add the Webhooks integration.
4. Choose events that should update the site, such as item created, item changed, status changed, and item moved.
5. Paste the Worker URL from step 4.

Monday will send a verification request. The Worker should return the challenge and the webhook should save.

## 6. Test Manually

In GitHub, open Actions > Sync Monday data > Run workflow.

Expected result:

- `deepdives-data.js` is rewritten from Monday.
- `index.html` gets a fresh asset version.
- A commit named `Sync Monday deep dives` appears if anything changed.
- Cloudflare deploys the new commit automatically.

## Column Mapping

The sync script maps columns by their visible titles.

Expected board columns:

- `Topic`
- `Name of Speaker and Company`
- `Date`
- `Time`
- `Presentation Link`
- `Recording Link`
- `Valid`

Rows are published only when `Valid` is yes/true/valid. If the `Valid` column is missing, only rows in `Coming Soon` and `Past` are included.

## Notes

- Cloudflare deploy hooks are not enough by themselves. They redeploy current GitHub content but do not update `deepdives-data.js`.
- The GitHub Action is also scheduled hourly as a backstop in case a webhook is missed.
- The site remains static. Visitors never call Monday directly.
