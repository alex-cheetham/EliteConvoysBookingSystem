const { buildPanelEmbed, buildPanelRows } = require("./panel");
const { ensureGuildConfig, setPanelMessageId } = require("../db");
const appConfig = require("../config");

async function ensureBookingPanelMessage(client) {
  const { GUILD_ID, BOOKING_PANEL_CHANNEL_ID } = appConfig;

  if (!BOOKING_PANEL_CHANNEL_ID) {
    console.log("BOOKING_PANEL_CHANNEL_ID not set; skipping booking panel auto-post.");
    return;
  }

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(BOOKING_PANEL_CHANNEL_ID).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.log("BOOKING_PANEL_CHANNEL_ID is not a valid text channel; skipping.");
    return;
  }

  const cfg = await ensureGuildConfig(GUILD_ID, appConfig);

  // If we have an existing message ID, try to edit it
  if (cfg.panel_message_id) {
    const existing = await channel.messages.fetch(cfg.panel_message_id).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [buildPanelEmbed()], components: buildPanelRows() });
      console.log("Booking panel message updated.");
      return;
    }
  }

  // Otherwise, post a new panel message
  const msg = await channel.send({ embeds: [buildPanelEmbed()], components: buildPanelRows() });
  await setPanelMessageId(GUILD_ID, msg.id);
  console.log("Booking panel message posted.");
}

module.exports = { ensureBookingPanelMessage };
