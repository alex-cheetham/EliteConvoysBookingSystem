const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { DISCORD_TOKEN } = require("../config");
const { logger } = require("../logger");
const { registerCommands } = require("./registerCommands");
const { attachInteractionHandlers } = require("./interactions");
const { startReminderLoop } = require("./reminders");

let client;

async function startBot() {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ],
    partials: [Partials.Channel]
  });

  // ✅ Prevent node from crashing on Discord client errors
  client.on("error", (err) => {
    logger.error("Discord client error:", err);
  });

  client.once("ready", async () => {
    logger.info(`Bot logged in as ${client.user.tag}`);
    await registerCommands(client);
    attachInteractionHandlers(client);
    startReminderLoop(client);
    logger.info("Bot ready.");
  });

  await client.login(DISCORD_TOKEN);
  return client;
}

function getBotClient() {
  return client;
}

module.exports = { startBot, getBotClient };
