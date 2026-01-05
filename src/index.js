const { EmbedBuilder } = require("discord.js");

const appConfig = require("./config");
const { DISCORD_TOKEN, GUILD_ID, STATUS_COLORS } = require("./config");

const { createDiscordClient } = require("./discordClient");
const { handleInteraction } = require("./discord/interactions");
const { startWebPanel } = require("./web/server");
const { startScheduler } = require("./scheduler");

const { getBooking, markAcceptanceSent } = require("./bookingLogic");
const { ensureGuildConfig, initDb } = require("./db");
const { createOrUpdateTicketChannel } = require("./discord/tickets");
const { ensureBookingPanelMessage } = require("./discord/panelPoster");

// Updated banner image
const EVENT_BANNER_IMAGE = "https://i.postimg.cc/g2p5CNHt/Event-Supervised-By.png";

function buildAcceptanceEmbeds({ booking, staffUsername }) {
  const clientMention = `<@${booking.requester_id}>`;
  const staffName = staffUsername || "staff";

  // ✅ Acceptance embed
  const acceptanceEmbed = new EmbedBuilder()
    .setTitle("📬 Event Request Accepted")
    .setColor(STATUS_COLORS?.ACCEPTED ?? 0x2bd576)
    .setDescription(
`Hello ${clientMention},

Thank you again for requesting our service.

We have looked over your event details and are happy to announce that your request has been **accepted**.

**P.S.** If you have any requirements please post them below.

We will now send you all the information you require for your event page.

Kind regards,  
**Elite Convoys | ${staffName}**`
    )
    .setFooter({ text: `Booking #${booking.id} • ${booking.vtc_name}` });

  // ✅ Rules embed (clean blocks + rules in code blocks)
  const participantRules =
`The Event Staff are recognized as; “Elite | Staff" or similar.

Impersonating Event Staff using the aforementioned tags is forbidden.

Double trailers, Triple trailers, HCT trailers and Heavy Haul configurations are prohibited. (Except Event Staff)

Cars and Buses are prohibited except for event staff showing a clear tag.

Participants must haul a trailer. (Except Event Staff)

Advertising is prohibited. (Except Event Staff)

Overtaking is prohibited.

Participants must follow Event Staff instructions.

Participants should park at their designated slots. If you do not have a designated slot you are required to park in the 'Public Parking' area.

Participants must only leave the starting location when instructed to do so in an orderly (one by one) manner.

All other TruckersMP rules apply.`;

  const staffRules =
`Event Staff overtaking the convoy cannot be performed by more than 2 members at a time.

Event Staff can drive the incorrect way where roads have a central reservation barrier ONLY. In accordance with the rule above.

Event Staff can block junctions and roads approaching junctions in order to direct the convoy.

Event Staff can park out of bounds. Providing this is on the ground and not on top of buildings or other inappropriate places deemed unsuitable by TruckersMP Staff

All other TruckersMP rules apply.`;

  const rulesEmbed = new EmbedBuilder()
    .setTitle("📜 Event Rules")
    .setColor(STATUS_COLORS?.REVIEW ?? 0xffcc66)
    .addFields(
      {
        name: "🫂 Event Rules for Participants",
        value: "```" + participantRules + "```"
      },
      {
        name: "⭐ Event Rules for Event Staff",
        value: "```" + staffRules + "```"
      }
    );

  // ✅ Banner embed (image)
  const bannerEmbed = new EmbedBuilder()
    .setTitle("Event Supervised By Elite Convoys")
    .setColor(STATUS_COLORS?.ACCEPTED ?? 0x2bd576)
    .setImage(EVENT_BANNER_IMAGE);

  return { acceptanceEmbed, rulesEmbed, bannerEmbed };
}

async function sendAcceptancePackIfNeeded(client, bookingId, staffUsername, prevStatus, newStatus) {
  // Only when it becomes ACCEPTED
  if (newStatus !== "ACCEPTED") return;
  if (prevStatus === "ACCEPTED") return;

  const booking = await getBooking(GUILD_ID, bookingId);
  if (!booking) return;
  if (!booking.ticket_channel_id) return;

  // Only send once ever (prevents spam if staff clicks save multiple times)
  const shouldSend = await markAcceptanceSent(GUILD_ID, bookingId, staffUsername);
  if (!shouldSend) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const ch = await guild.channels.fetch(booking.ticket_channel_id).catch(() => null);
  if (!ch) return;

  const { acceptanceEmbed, rulesEmbed, bannerEmbed } =
    buildAcceptanceEmbeds({ booking, staffUsername });

  // Ping requester safely
  await ch.send({
    content: `<@${booking.requester_id}>`,
    allowedMentions: { users: [booking.requester_id] },
    embeds: [acceptanceEmbed]
  }).catch(() => {});

  await ch.send({ embeds: [rulesEmbed] }).catch(() => {});
  await ch.send({ embeds: [bannerEmbed] }).catch(() => {});
}

(async () => {
  await initDb();

  const client = createDiscordClient();

  client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    startWebPanel(client);
    startScheduler(client);

    await ensureBookingPanelMessage(client);
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      await handleInteraction(client, interaction);
    } catch (e) {
      console.error(e);
      if (interaction.isRepliable()) {
        try { await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true }); } catch {}
      }
    }
  });

  client.on("bookingUpdated", async ({ bookingId, prevStatus, newStatus, staffUsername }) => {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      const booking = await getBooking(GUILD_ID, bookingId);
      if (!booking) return;

      const cfgRow = await ensureGuildConfig(GUILD_ID, appConfig);
      await createOrUpdateTicketChannel({ guild, booking, configPrefix: cfgRow.category_prefix });

      // ✅ If accepted, post acceptance + rules + banner (once)
      await sendAcceptancePackIfNeeded(client, bookingId, staffUsername, prevStatus, newStatus);
    } catch (e) {
      console.error("bookingUpdated handler error:", e);
    }
  });

  await client.login(DISCORD_TOKEN);
})();
