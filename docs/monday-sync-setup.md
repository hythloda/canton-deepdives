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

You do not need to paste a token in this step. This step only confirms which Monday board the GitHub Action will read.

## 3. Create a GitHub Token for the Worker

This token is different from the Monday API token in step 1.

- The Monday API token goes in GitHub Actions as `MONDAY_API_TOKEN`.
- The GitHub token from this step goes in Cloudflare as `GITHUB_DISPATCH_TOKEN`.

Create a fine-grained GitHub personal access token:

1. Open GitHub.
2. Click your avatar in the top right.
3. Go to Settings > Developer settings > Personal access tokens > Fine-grained tokens.
4. Click Generate new token.
5. Use these values:
   - Token name: `canton-deepdives monday dispatch`
   - Resource owner: `hythloda`
   - Repository access: Only select repositories
   - Selected repository: `hythloda/canton-deepdives`
   - Expiration: choose the longest allowed value you are comfortable with
6. Under Repository permissions, set:
   - Contents: Read and write
   - Metadata: Read-only, which GitHub adds automatically
7. Click Generate token.
8. Copy the token immediately. GitHub only shows it once.

Keep this copied token ready for step 4. Do not add this token to GitHub repository secrets.

The Worker uses this token only to call GitHub's `repository_dispatch` endpoint, which starts the GitHub Action.

## 4. Deploy the Cloudflare Worker Webhook

Use `workers/monday-github-dispatch.js` as a separate Cloudflare Worker whose only job is to receive Monday webhook calls and trigger GitHub.

Dashboard setup:

1. Open Cloudflare.
2. Go to Workers & Pages.
3. Click Create application.
4. Choose Worker.
5. Name it something like `canton-deepdives-monday-webhook`.
6. Deploy the starter Worker.
7. Open the Worker, then click Edit code.
8. Replace the starter code with the contents of `workers/monday-github-dispatch.js`.
9. Click Deploy.

Add the GitHub token to Cloudflare:

1. Open the `canton-deepdives-monday-webhook` Worker in Cloudflare.
2. Go to Settings > Variables and secrets.
3. Click Add.
4. Choose Secret.
5. Name: `GITHUB_DISPATCH_TOKEN`
6. Value: paste the GitHub fine-grained token from step 3.
7. Save.

Add a webhook secret to Cloudflare:

1. Create any long random string. A password manager works well. If you prefer Terminal, run:

   ```bash
   openssl rand -hex 32
   ```

2. Copy that random string.
3. In the same Cloudflare Worker, go to Settings > Variables and secrets.
4. Click Add.
5. Choose Secret.
6. Name: `MONDAY_WEBHOOK_SECRET`
7. Value: paste the random string.
8. Save.

This `MONDAY_WEBHOOK_SECRET` is not from Monday or GitHub. It is just a shared password between your Monday webhook URL and the Cloudflare Worker.

The Monday webhook URL should include the secret as a query param:

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/?secret=YOUR_LONG_RANDOM_SECRET
```

Use the same random string you saved as `MONDAY_WEBHOOK_SECRET`.

The Worker handles Monday's URL verification challenge automatically by echoing the `challenge` field.

## 5. Add the Monday Webhook

In Monday:

1. Open the Canton Deep Dive Presentations board.
2. Open Automations / Integrations.
3. Add the Webhooks integration.
4. Choose an event that should update the site, such as item created, item changed, status changed, or item moved.
5. Paste the Worker URL from step 4.

Monday will send a verification request. The Worker should return the challenge and the webhook should save.

If Monday only lets you choose one event per webhook, create multiple webhook automations that all point to the same Worker URL:

- Item created
- Item changed
- Status changed
- Item moved to group

## 6. Test Manually

First test the GitHub Action directly:

1. Open `hythloda/canton-deepdives` on GitHub.
2. Go to Actions.
3. Open Sync Monday data.
4. Click Run workflow.
5. Run it on the `main` branch.

Expected result:

- `deepdives-data.js` is rewritten from Monday.
- `index.html` gets a fresh asset version.
- A commit named `Sync Monday deep dives` appears if anything changed.
- Cloudflare deploys the new commit automatically.

Then test the full Monday to Cloudflare to GitHub path:

1. Change a harmless field on a valid Monday row.
2. Wait for the GitHub Action to start.
3. Check GitHub > Actions > Sync Monday data.
4. If the Action commits a change, Cloudflare should deploy from that commit automatically.

If the manual GitHub Action works but a Monday edit does not start the Action, the issue is in the Monday webhook or Cloudflare Worker secrets.

If the GitHub Action starts but cannot read Monday, check the GitHub repository secret named `MONDAY_API_TOKEN`.

If the Worker logs show a GitHub `401` or `403`, check the Cloudflare Worker secret named `GITHUB_DISPATCH_TOKEN` and confirm the token has access to `hythloda/canton-deepdives` with Contents read/write permission.

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
