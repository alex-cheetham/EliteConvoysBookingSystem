const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

function panelMessage() {
  const embed = new EmbedBuilder()
    .setTitle("🚚 Elite Convoys — Booking Requests")
    .setDescription("Click below to request convoy control. You’ll receive a dedicated ticket channel automatically.")
    .setColor(0x111827);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ec_request_convoy_control")
      .setLabel("Request Convoy Control")
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { panelMessage };
