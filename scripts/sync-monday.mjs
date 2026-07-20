import { readFile, writeFile } from "node:fs/promises";

const BOARD_ID = process.env.MONDAY_BOARD_ID || "18422413776";
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN;
const SOURCE_URL =
  process.env.MONDAY_SOURCE_URL ||
  "https://view.monday.com/18422413776-807b632953d4194954ade5ac45ec89e7?r=use1&is_sharable_link=true";

if (!MONDAY_API_TOKEN) {
  throw new Error("MONDAY_API_TOKEN is required");
}

const columnAliases = {
  date: ["date"],
  nameSpeakerCompany: ["name of speaker and company", "speaker", "speaker and company"],
  presentationLink: ["presentation link"],
  recordingLink: ["recording link"],
  time: ["time"],
  valid: ["valid"],
};

const query = `
  query CantonDeepDives($boardId: [ID!]) {
    boards(ids: $boardId) {
      id
      name
      groups {
        id
        title
      }
      columns {
        id
        title
        type
      }
      items_page(limit: 500) {
        items {
          id
          name
          group {
            id
            title
          }
          column_values {
            id
            text
            type
            value
            column {
              title
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.monday.com/v2", {
  method: "POST",
  headers: {
    Authorization: MONDAY_API_TOKEN,
    "Content-Type": "application/json",
    "API-Version": "2026-04",
  },
  body: JSON.stringify({
    query,
    variables: { boardId: [BOARD_ID] },
  }),
});

const payload = await response.json();

if (!response.ok || payload.errors) {
  throw new Error(JSON.stringify(payload.errors || payload, null, 2));
}

const board = payload.data?.boards?.[0];
if (!board) {
  throw new Error(`Monday board ${BOARD_ID} was not returned`);
}

const columnsByPurpose = mapColumns(board.columns || []);
const items = board.items_page?.items || [];
const sessions = items
  .map((item) => toSession(item, columnsByPurpose))
  .filter((session) => session.valid)
  .sort(compareSessions);

const current = await readCurrentData();
const next = {
  updatedAt: new Date().toISOString(),
  sourceUrl: SOURCE_URL,
  zoom: current.zoom,
  sessions,
};

await writeFile("deepdives-data.js", `window.DEEPDIVES_DATA = ${JSON.stringify(next, null, 2)};\n`);
await bumpAssetVersion();

console.log(`Synced ${sessions.length} valid sessions from Monday board ${BOARD_ID}`);

function mapColumns(columns) {
  const normalized = columns.map((column) => ({
    ...column,
    key: normalize(column.title),
  }));

  return Object.fromEntries(
    Object.entries(columnAliases).map(([purpose, aliases]) => [
      purpose,
      normalized.find((column) => aliases.some((alias) => column.key.includes(alias)))?.id,
    ]),
  );
}

function toSession(item, columns) {
  const values = Object.fromEntries((item.column_values || []).map((value) => [value.id, value]));
  const group = normalizeGroup(item.group?.title || "");
  const speakerCompany = cellText(values[columns.nameSpeakerCompany]);
  const speakerParts = parseSpeakerCompany(speakerCompany);
  const time = normalizeTime(cellText(values[columns.time]));
  const presentationUrl = extractUrl(values[columns.presentationLink]);
  const recordingUrl = extractUrl(values[columns.recordingLink]);

  return {
    title: item.name || "Untitled",
    speaker: speakerParts.speaker,
    role: speakerParts.role,
    company: speakerParts.company,
    group,
    date: extractDate(values[columns.date]),
    day: "Tuesday",
    time,
    ...zoomFields(time),
    presentationUrl,
    recordingUrl,
    valid: isValid(values[columns.valid], group),
  };
}

function isValid(value, group) {
  if (!value) {
    return ["coming soon", "future", "past"].includes(normalize(group));
  }

  const raw = `${value.text || ""} ${value.value || ""}`.toLowerCase();
  if (/\bno\b|false|invalid/.test(raw)) return false;
  if (/\byes\b|true|valid/.test(raw)) return true;
  return false;
}

function extractDate(value) {
  if (!value) return "";
  const raw = parseJson(value.value);
  if (raw?.date) return raw.date;
  if (raw?.from) return raw.from;

  const text = cellText(value);
  const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  const parsed = Date.parse(`${text} ${new Date().getFullYear()}`);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

function extractUrl(value) {
  if (!value) return "";
  const raw = parseJson(value.value);
  if (raw?.url) return raw.url;
  if (raw?.link) return raw.link;
  if (Array.isArray(raw?.files)) return "";

  const text = cellText(value);
  return text.match(/https?:\/\/\S+/)?.[0] || "";
}

function parseSpeakerCompany(value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return { speaker: "", role: "", company: "" };

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2) return { speaker: parts[0], role: "", company: parts[1] };
  if (parts.length === 3) return { speaker: parts[0], role: parts[1], company: parts[2] };

  return { speaker: text, role: "", company: "" };
}

function normalizeTime(value) {
  return value
    .replace(/\bEST\b/gi, "ET")
    .replace(/\s+/g, " ")
    .trim() || "TBD";
}

function zoomFields(time) {
  if (/6am\s*\/\s*10am/i.test(time)) return { zoomSlots: ["6am ET", "10am ET"] };
  if (/6am/i.test(time)) return { zoomSlot: "6am ET" };
  return { zoomSlot: "10am ET" };
}

function compareSessions(left, right) {
  const leftGroup = normalize(left.group);
  const rightGroup = normalize(right.group);
  if (leftGroup === "past" && rightGroup !== "past") return 1;
  if (rightGroup === "past" && leftGroup !== "past") return -1;

  const leftTime = left.date ? Date.parse(`${left.date}T12:00:00Z`) : Number.MAX_SAFE_INTEGER;
  const rightTime = right.date ? Date.parse(`${right.date}T12:00:00Z`) : Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || left.title.localeCompare(right.title);
}

function cellText(value) {
  return String(value?.text || "").trim();
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeGroup(value) {
  const normalized = normalize(value);
  if (normalized === "future") return "Coming Soon";
  if (normalized === "coming soon") return "Coming Soon";
  if (normalized === "past") return "Past";
  return String(value || "").trim();
}

async function readCurrentData() {
  const source = await readFile("deepdives-data.js", "utf8");
  const window = {};
  Function("window", source)(window);
  return window.DEEPDIVES_DATA;
}

async function bumpAssetVersion() {
  const version = `monday-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12)}`;
  const html = await readFile("index.html", "utf8");
  const next = html.replace(
    /(deepdives-data\.js|app\.js)\?v=[^"]+/g,
    (match, file) => `${file}?v=${version}`,
  );
  await writeFile("index.html", next);
}
