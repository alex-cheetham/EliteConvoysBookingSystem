const { DISCORD_TOKEN, GUILD_ID, BOOKING_PANEL_CHANNEL_ID } = require("./config");
const { createDiscordClient } = require("./discordClient");
const { handleInteraction } = require("./discord/interactions");
const { startWebPanel } = require("./web/server");
const { startScheduler } = require("./scheduler");
const { getBooking } = require("./bookingLogic");
const { ensureGuildConfig, initDb } = require("./db");
const appConfig = require("./config");
const { createOrUpdateTicketChannel } = require("./discord/tickets");
const { ensureBookingPanelMessage } = require("./discord/panelPoster");

(async () => {
  await initDb();

  const client = createDiscordClient();

  client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Start web panel + reminders
    startWebPanel(client);
    startScheduler(client);

    // Auto-post/update the booking panel message
    await ensureBookingPanelMessage(client);

    if (!BOOKING_PANEL_CHANNEL_ID) {
      console.log("BOOKING_PANEL_CHANNEL_ID not set. Set it in .env to use the panel message channel.");
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      await handleInteraction(client, interaction);
    } catch (e) {
      console.error(e);
      if (interaction.isRepliable()) {
        try {
          await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
        } catch {}
      }
    }
  });

  // Fired by the web panel whenever something changes
  client.on("bookingUpdated", async ({ bookingId }) => {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);

      // Pull latest booking data
      const booking = await getBooking(GUILD_ID, bookingId);
      if (!booking) return;

      const cfgRow = await ensureGuildConfig(GUILD_ID, appConfig);

      // This function now also updates/creates the pinned summary embed message
      await createOrUpdateTicketChannel({
        guild,
        booking,
        configPrefix: cfgRow.category_prefix
      });
    } catch (e) {
      console.error("bookingUpdated handler error:", e);
    }
  });

  await client.login(DISCORD_TOKEN);
})();
