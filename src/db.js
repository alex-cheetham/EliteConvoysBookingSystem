const path = require("path");
const fs = require("fs");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");

const dbFile = path.join(__dirname, "data", "db.json");
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const adapter = new JSONFile(dbFile);

const defaultData = {
  bookings: [],
  blackouts: [],
  config: {},
  audit: []
};

const db = new Low(adapter, defaultData);

async function initDb() {
  await db.read();
  db.data ||= defaultData;
  db.data.bookings ||= [];
  db.data.blackouts ||= [];
  db.data.config ||= {};
  db.data.audit ||= [];
  await db.write();
}

function nowIso() {
  return new Date().toISOString();
}

async function ensureGuildConfig(guild_id, defaults) {
  await db.read();
  db.data.config ||= {};

  if (!db.data.config[guild_id]) {
    db.data.config[guild_id] = {
      guild_id,
      default_duration_minutes: defaults.DEFAULT_DURATION_MINUTES,
      buffer_minutes: defaults.BUFFER_MINUTES,
      review_enabled: 0,
      category_prefix: defaults.CATEGORY_PREFIX,
      panel_message_id: null
    };
    await db.write();
  } else {
    // Backwards-compatible: add missing keys if you already have config saved
    const cfg = db.data.config[guild_id];
    if (cfg.panel_message_id === undefined) cfg.panel_message_id = null;
    if (cfg.category_prefix === undefined) cfg.category_prefix = defaults.CATEGORY_PREFIX;
    if (cfg.review_enabled === undefined) cfg.review_enabled = 0;
    if (cfg.default_duration_minutes === undefined) cfg.default_duration_minutes = defaults.DEFAULT_DURATION_MINUTES;
    if (cfg.buffer_minutes === undefined) cfg.buffer_minutes = defaults.BUFFER_MINUTES;
    await db.write();
  }

  return db.data.config[guild_id];
}

async function setPanelMessageId(guild_id, messageId) {
  await db.read();
  db.data.config ||= {};
  if (!db.data.config[guild_id]) return;
  db.data.config[guild_id].panel_message_id = messageId;
  await db.write();
}

async function addAudit({ guild_id, actor_id, actor_tag, action, details }) {
  await db.read();
  db.data.audit.push({
    id: db.data.audit.length + 1,
    guild_id,
    actor_id,
    actor_tag,
    action,
    details,
    created_at: nowIso()
  });
  await db.write();
}

module.exports = {
  db,
  initDb,
  ensureGuildConfig,
  setPanelMessageId,
  addAudit
};
