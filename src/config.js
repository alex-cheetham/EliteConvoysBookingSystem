require("dotenv").config();

function parseIds(value) {
  if (!value) return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,

  OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
  OAUTH_CALLBACK_URL: process.env.OAUTH_CALLBACK_URL,

  WEB_PORT: Number(process.env.WEB_PORT || 3000),
  SESSION_SECRET: process.env.SESSION_SECRET || "change-me",

  WEB_ALLOWED_ROLE_IDS: parseIds(process.env.WEB_ALLOWED_ROLE_IDS),

  ROLE_DISPATCH_IDS: parseIds(process.env.ROLE_DISPATCH_IDS),
  ROLE_CCSTAFF_IDS: parseIds(process.env.ROLE_CCSTAFF_IDS),
  ROLE_ONDUTY_IDS: parseIds(process.env.ROLE_ONDUTY_IDS),

  BOOKING_PANEL_CHANNEL_ID: process.env.BOOKING_PANEL_CHANNEL_ID,

  CATEGORY_PREFIX: process.env.CATEGORY_PREFIX || "📅",

  DEFAULT_DURATION_MINUTES: Number(process.env.DEFAULT_DURATION_MINUTES || 180),
  BUFFER_MINUTES: Number(process.env.BUFFER_MINUTES || 30),

  REMINDER_MINUTES: parseIds(process.env.REMINDER_MINUTES).map(n => Number(n)).filter(n => !Number.isNaN(n)),

  // Status icons
  STATUS_ICONS: {
    REQUESTED: "🟡",
    ACCEPTED: "✔️",
    COMPLETED: "✅",
    DECLINED: "❌",
    CANCELLED: "❌"
  }
};
