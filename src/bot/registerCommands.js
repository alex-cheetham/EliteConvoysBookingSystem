const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { DISCORD_CLIENT_ID, DEFAULT_GUILD_ID } = require("../config");

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("convoy-panel")
      .setDescription("Post the Elite Convoys booking panel in this channel.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DEFAULT_GUILD_ID),
    { body: commands }
  );

  console.log("✅ Guild slash commands registered");
}

module.exports = { registerCommands };
