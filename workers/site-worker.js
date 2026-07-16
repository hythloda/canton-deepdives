export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      return handleMondayWebhook(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleMondayWebhook(request, env) {
  const body = await request.json().catch(() => ({}));

  if (body.challenge) {
    return Response.json({ challenge: body.challenge });
  }

  if (env.MONDAY_WEBHOOK_SECRET) {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") !== env.MONDAY_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  if (!env.GITHUB_DISPATCH_TOKEN) {
    return new Response("Missing GITHUB_DISPATCH_TOKEN", { status: 500 });
  }

  const dispatch = await fetch("https://api.github.com/repos/hythloda/canton-deepdives/dispatches", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "canton-deepdives-monday-sync",
    },
    body: JSON.stringify({
      event_type: "monday-board-updated",
      client_payload: {
        source: "monday",
        event: body.event || body,
      },
    }),
  });

  if (!dispatch.ok) {
    return new Response(await dispatch.text(), { status: dispatch.status });
  }

  return Response.json({ ok: true });
}
