require("dotenv").config();

function parseIdList(val) {
  return (val || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function parseNumberList(val) {
  return (val || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n));
}

module.exports = {
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  BOOKING_PANEL_CHANNEL_ID: process.env.BOOKING_PANEL_CHANNEL_ID || "",

  // Web panel
  WEB_PORT: Number(process.env.WEB_PORT || 3050),
  SESSION_SECRET: process.env.SESSION_SECRET || "change-me",

  // OAuth
  OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
  OAUTH_CALLBACK_URL: process.env.OAUTH_CALLBACK_URL,

  // Roles allowed on web panel (comma separated IDs)
  WEB_ALLOWED_ROLE_IDS: parseIdList(process.env.WEB_ALLOWED_ROLE_IDS),

  // Ticket visibility roles by stage (comma separated IDs)
  STAGE_REQUESTED_ROLE_IDS: parseIdList(process.env.STAGE_REQUESTED_ROLE_IDS),
  STAGE_REVIEW_ROLE_IDS: parseIdList(process.env.STAGE_REVIEW_ROLE_IDS),
  STAGE_ACCEPTED_ROLE_IDS: parseIdList(process.env.STAGE_ACCEPTED_ROLE_IDS),
  STAGE_DECLINED_ROLE_IDS: parseIdList(process.env.STAGE_DECLINED_ROLE_IDS),
  STAGE_CANCELLED_ROLE_IDS: parseIdList(process.env.STAGE_CANCELLED_ROLE_IDS),
  STAGE_COMPLETED_ROLE_IDS: parseIdList(process.env.STAGE_COMPLETED_ROLE_IDS),

  // Booking defaults
  DEFAULT_DURATION_MINUTES: Number(process.env.DEFAULT_DURATION_MINUTES || 120),
  BUFFER_MINUTES: Number(process.env.BUFFER_MINUTES || 30),
  CATEGORY_PREFIX: process.env.CATEGORY_PREFIX || "Bookings",

  // ✅ Reminder timings (minutes before meetup time)
  REMINDER_MINUTES: parseNumberList(process.env.REMINDER_MINUTES || "10080,2880,360,60"),

  // Status icons
  STATUS_ICONS: {
    REQUESTED: "📩",
    REVIEW: "🕵️",
    ACCEPTED: "✅",
    DECLINED: "❌",
    CANCELLED: "🛑",
    COMPLETED: "🏁"
  },

  // Status colors (Discord embeds)
  STATUS_COLORS: {
    REQUESTED: 0x4f8cff,
    REVIEW: 0xffcc66,
    ACCEPTED: 0x2bd576,
    DECLINED: 0xff5a67,
    CANCELLED: 0x9aa4b2,
    COMPLETED: 0x6ee7ff
  }
};
