const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

function getCommands() {
  return [
    new SlashCommandBuilder()
      .setName("setup-booking-panel")
      .setDescription("Post the booking panel message with buttons.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON()
  ];
}

module.exports = { getCommands };
