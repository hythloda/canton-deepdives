import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUTPUT_DIR = "deep-dives";
const CANONICAL_ORIGIN = "https://canton-deepdives.canton.foundation";

export async function generateSessionPages(data) {
  const sessions = (Array.isArray(data.sessions) ? data.sessions : [])
    .filter((session) => session.valid !== false && session.id)
    .sort(compareSessionDates);

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const [index, session] of sessions.entries()) {
    const directory = `${OUTPUT_DIR}/${safeId(session.id)}`;
    await mkdir(directory, { recursive: true });
    await writeFile(
      `${directory}/index.html`,
      renderSessionPage(session, data.zoom || {}, sessions[index - 1], sessions[index + 1]),
    );
  }
}

function renderSessionPage(session, zoom, previousSession, nextSession) {
  const title = session.title || "Canton Deep Dive";
  const date = formatDate(session.date);
  const presenter = session.speaker || "Speaker to be announced";
  const affiliation = [session.role, session.company].filter(Boolean).join(", ");
  const description = [date, presenter, affiliation].filter(Boolean).join(" - ");
  const canonicalUrl = `${CANONICAL_ORIGIN}/deep-dives/${safeId(session.id)}/`;
  const actions = renderActions(session, zoom);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | Canton Deep Dives</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Canton Deep Dives">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <link rel="stylesheet" href="../../styles.css?v=session-nav-20260922">
</head>
<body class="session-detail-page">
  <main class="page detail-page">
    <a class="detail-back" href="../../">&larr; All deep dives</a>
    <header class="page-head detail-head">
      <p class="eyebrow">Canton Network Deep Dive</p>
      <h1>${escapeHtml(title)}</h1>
    </header>

    <article class="detail-session">
      <div class="date-icon detail-date" aria-label="${escapeAttr(date || "Date to be announced")}">
        <span>${escapeHtml(dateMonth(session.date))}</span>
        <strong>${escapeHtml(dateDay(session.date))}</strong>
      </div>
      <div class="session-main">
        <div class="meta">
          ${pill(session.group || "Deep Dive")}
          ${pill([date, session.time].filter(Boolean).join(" / "))}
          ${session.company ? pill(session.company) : ""}
        </div>
        <p class="detail-label">Presented by</p>
        <p class="detail-speaker">${escapeHtml(presenter)}</p>
        ${affiliation ? `<p class="company">${escapeHtml(affiliation)}</p>` : ""}
        <div class="session-actions">${actions}</div>
      </div>
    </article>

    ${renderSessionNavigation(previousSession, nextSession)}
  </main>
</body>
</html>
`;
}

function renderSessionNavigation(previousSession, nextSession) {
  if (!previousSession && !nextSession) return "";

  return `<nav class="detail-pagination" aria-label="Deep dive navigation">
    ${sessionNavigationLink(previousSession, "Previous", "previous")}
    ${sessionNavigationLink(nextSession, "Next", "next")}
  </nav>`;
}

function sessionNavigationLink(session, label, position) {
  if (!session) return `<span class="detail-pagination-empty ${position}" aria-hidden="true"></span>`;

  return `<a class="detail-pagination-link ${position}" href="../${safeId(session.id)}/">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(session.title || "Canton Deep Dive")}</strong>
    </a>`;
}

function renderActions(session, zoom) {
  const links = [];
  const isPast = String(session.group || "").trim().toLowerCase() === "past";

  if (!isPast) {
    for (const entry of getZoomLinks(session, zoom)) {
      links.push(linkButton(entry.url, entry.label, true));
    }
  }

  if (session.presentationUrl) links.push(linkButton(session.presentationUrl, "Presentation", true));
  if (session.recordingUrl) links.push(linkButton(session.recordingUrl, "Recording", true));
  links.push('<a class="action-link compact" href="../../">Full list</a>');
  return links.join("");
}

function getZoomLinks(session, zoom) {
  const slots = session.zoomSlots || [session.zoomSlot || "10am ET"];
  return slots
    .map((slot) => ({ label: `Zoom ${slot}`, url: zoom.slots?.[slot] }))
    .filter((entry) => entry.url);
}

function compareSessionDates(left, right) {
  const leftTime = left.date ? Date.parse(`${left.date}T12:00:00Z`) : Number.MAX_SAFE_INTEGER;
  const rightTime = right.date ? Date.parse(`${right.date}T12:00:00Z`) : Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || String(left.title || "").localeCompare(String(right.title || ""));
}

function linkButton(url, label, external) {
  const target = external ? ' target="_blank" rel="noopener"' : "";
  return `<a class="action-link compact" href="${escapeAttr(url)}"${target}>${escapeHtml(label)}</a>`;
}

function pill(value) {
  return `<span class="pill">${escapeHtml(value)}</span>`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function dateMonth(value) {
  if (!value) return "TUE";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "TUE";
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date).toUpperCase();
}

function dateDay(value) {
  if (!value) return "TBD";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", timeZone: "UTC" }).format(date);
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

async function readData() {
  const source = await readFile("deepdives-data.js", "utf8");
  const window = {};
  Function("window", source)(window);
  return window.DEEPDIVES_DATA;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateSessionPages(await readData());
  console.log("Generated individual deep-dive pages");
}
