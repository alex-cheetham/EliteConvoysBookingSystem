const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("Elite Convoys — Convoy Control Bookings")
    .setDescription(
      [
        "Use the buttons below to request convoy control supervision for your event.",
        "",
        "**What you can do:**",
        "• Request Convoy Control",
        "• Check Availability",
        "• View Your Requests",
        "",
        "_Bookings are automatically accepted if no conflicts exist._"
      ].join("\n")
    );
}

function buildPanelRows() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("book_request").setLabel("Request Convoy Control").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("book_availability").setLabel("Check Availability").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("book_my").setLabel("My Requests").setStyle(ButtonStyle.Secondary),
  );

  return [row];
}

module.exports = { buildPanelEmbed, buildPanelRows };
