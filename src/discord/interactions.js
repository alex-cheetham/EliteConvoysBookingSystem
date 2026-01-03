const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { Routes } = require("discord-api-types/v10");
const { nanoid } = require("nanoid");

const { createBooking, getBooking, setTicketInfo } = require("../bookingLogic");
const { createOrUpdateTicketChannel } = require("./tickets");
const { ensureGuildConfig } = require("../db");
const appConfig = require("../config");

// token -> { prefill, createdAt }
const PREFILL_STORE = new Map();

// Cleanup old tokens occasionally (10 min)
setInterval(() => {
  const now = Date.now();
  for (const [token, obj] of PREFILL_STORE.entries()) {
    if (now - obj.createdAt > 10 * 60 * 1000) PREFILL_STORE.delete(token);
  }
}, 60 * 1000);

/**
 * Show a modal using the raw interaction callback.
 * IMPORTANT: Only use this for BUTTON interactions (MESSAGE_COMPONENT).
 * Discord rejects modal responses for MODAL_SUBMIT interactions (your error).
 */
async function rawShowModalFromButton(client, interaction, modal) {
  // type: 9 = MODAL (valid for button interactions)
  await client.rest.post(
    Routes.interactionCallback(interaction.id, interaction.token),
    { body: { type: 9, data: modal.toJSON() } }
  );
}

function buildModalStep1() {
  const modal = new ModalBuilder()
    .setCustomId("modal_booking_1")
    .setTitle("Request Convoy Control (1/2)");

  const vtc = new TextInputBuilder()
    .setCustomId("vtc_name")
    .setLabel("VTC Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const date = new TextInputBuilder()
    .setCustomId("event_date")
    .setLabel("Event Date (YYYY-MM-DD)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const meetup = new TextInputBuilder()
    .setCustomId("meetup_time")
    .setLabel("Event Meetup Time (HH:mm)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const depart = new TextInputBuilder()
    .setCustomId("departure_time")
    .setLabel("Event Departure Time (HH:mm)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const server = new TextInputBuilder()
    .setCustomId("server")
    .setLabel("Server")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(vtc),
    new ActionRowBuilder().addComponents(date),
    new ActionRowBuilder().addComponents(meetup),
    new ActionRowBuilder().addComponents(depart),
    new ActionRowBuilder().addComponents(server)
  );

  return modal;
}

function buildModalStep2(token) {
  const modal = new ModalBuilder()
    .setCustomId(`modal_booking_2:${token}`)
    .setTitle("Request Convoy Control (2/2)");

  const start = new TextInputBuilder()
    .setCustomId("start_location")
    .setLabel("Start Location")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const dest = new TextInputBuilder()
    .setCustomId("destination")
    .setLabel("Destination")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const dlc = new TextInputBuilder()
    .setCustomId("dlcs_required")
    .setLabel("DLC's Required (type None if none)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const tmp = new TextInputBuilder()
    .setCustomId("tmp_event_link")
    .setLabel("TMP Event Link")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const notes = new TextInputBuilder()
    .setCustomId("other_notes")
    .setLabel("Other Notes (Optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(start),
    new ActionRowBuilder().addComponents(dest),
    new ActionRowBuilder().addComponents(dlc),
    new ActionRowBuilder().addComponents(tmp),
    new ActionRowBuilder().addComponents(notes)
  );

  return modal;
}

function validateStep1(prefill) {
  if (!prefill.vtc_name?.trim()) return "VTC Name cannot be empty.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prefill.event_date)) return "Event Date must be YYYY-MM-DD.";
  if (!/^\d{2}:\d{2}$/.test(prefill.meetup_time)) return "Event Meetup Time must be HH:mm (24h).";
  if (!/^\d{2}:\d{2}$/.test(prefill.departure_time)) return "Event Departure Time must be HH:mm (24h).";
  if (prefill.meetup_time >= prefill.departure_time) return "Meetup Time must be before Departure Time.";
  if (!prefill.server?.trim()) return "Server cannot be empty.";
  return null;
}

function validateAll(fields) {
  const err1 = validateStep1(fields);
  if (err1) return err1;

  if (!fields.start_location?.trim()) return "Start Location cannot be empty.";
  if (!fields.destination?.trim()) return "Destination cannot be empty.";
  if (!fields.dlcs_required?.trim()) return "DLC's Required cannot be empty (use 'None' if needed).";
  if (!fields.tmp_event_link || !/^https?:\/\//i.test(fields.tmp_event_link)) {
    return "TMP Event Link must start with http:// or https://";
  }
  return null;
}

async function handleInteraction(client, interaction) {
  if (!interaction.inGuild()) return;

  // =========================
  // BUTTONS
  // =========================
  if (interaction.isButton()) {
    // Start booking flow
    if (interaction.customId === "book_request") {
      const modal1 = buildModalStep1();
      // modal response allowed for button interactions
      return rawShowModalFromButton(client, interaction, modal1);
    }

    // Continue to step 2 (button created after step 1 submit)
    if (interaction.customId.startsWith("book_continue:")) {
      const token = interaction.customId.split(":")[1];
      const stored = PREFILL_STORE.get(token);

      if (!stored) {
        return interaction.reply({
          content: "❌ Session expired. Please click **Request Convoy Control** again.",
          ephemeral: true
        });
      }

      const modal2 = buildModalStep2(token);
      return rawShowModalFromButton(client, interaction, modal2);
    }

    if (interaction.customId === "book_availability") {
      return interaction.reply({
        content: "Availability checker: use the web panel for now (Dashboard shows all bookings + blackouts).",
        ephemeral: true
      });
    }

    if (interaction.customId === "book_my") {
      return interaction.reply({
        content: "My Requests: coming soon in Discord UI. For now, management can view everything in the web panel.",
        ephemeral: true
      });
    }
  }

  // =========================
  // MODAL SUBMITS
  // =========================

  // Step 1 submit: store prefill and reply with a Continue button (we cannot open a modal directly here)
  if (interaction.isModalSubmit() && interaction.customId === "modal_booking_1") {
    const prefill = {
      vtc_name: interaction.fields.getTextInputValue("vtc_name"),
      event_date: interaction.fields.getTextInputValue("event_date"),
      meetup_time: interaction.fields.getTextInputValue("meetup_time"),
      departure_time: interaction.fields.getTextInputValue("departure_time"),
      server: interaction.fields.getTextInputValue("server"),
      timezone: "UTC"
    };

    const err = validateStep1(prefill);
    if (err) {
      return interaction.reply({ content: `❌ ${err}`, ephemeral: true });
    }

    const token = nanoid(12);
    PREFILL_STORE.set(token, { prefill, createdAt: Date.now() });

    const continueBtn = new ButtonBuilder()
      .setCustomId(`book_continue:${token}`)
      .setLabel("Continue (2/2)")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(continueBtn);

    return interaction.reply({
      content: "✅ Step **1/2** saved. Click **Continue (2/2)** to finish the form.",
      components: [row],
      ephemeral: true
    });
  }

  // Step 2 submit: create booking + ticket
  if (interaction.isModalSubmit() && interaction.customId.startsWith("modal_booking_2:")) {
    const token = interaction.customId.split(":")[1];
    const stored = PREFILL_STORE.get(token);

    if (!stored) {
      return interaction.reply({
        content: "❌ Session expired. Please click **Request Convoy Control** again.",
        ephemeral: true
      });
    }

    PREFILL_STORE.delete(token);

    const fields = {
      ...stored.prefill,
      start_location: interaction.fields.getTextInputValue("start_location"),
      destination: interaction.fields.getTextInputValue("destination"),
      dlcs_required: interaction.fields.getTextInputValue("dlcs_required"),
      tmp_event_link: interaction.fields.getTextInputValue("tmp_event_link"),
      other_notes: interaction.fields.getTextInputValue("other_notes")
    };

    const err = validateAll(fields);
    if (err) return interaction.reply({ content: `❌ ${err}`, ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const requesterId = interaction.user.id;
    const requesterTag = interaction.user.tag;

    const result = await createBooking({
      guildId,
      requesterId,
      requesterTag,
      fields
    });

    const booking = await getBooking(guildId, result.bookingId);
    const guild = await interaction.guild.fetch();

    const cfgRow = await ensureGuildConfig(guildId, appConfig);

    const { channel, category } = await createOrUpdateTicketChannel({
      guild,
      booking,
      configPrefix: cfgRow.category_prefix
    });

    await setTicketInfo(guildId, booking.id, channel.id, category.id);

    const statusMsg =
      booking.status === "ACCEPTED"
        ? "✅ Your booking has been **auto-accepted** and a ticket channel has been created."
        : booking.status === "DECLINED"
          ? "❌ Your booking was **declined** due to a schedule conflict or blackout."
          : "🟡 Your booking is **under review**.";

    const eb = new EmbedBuilder()
      .setTitle(`Booking #${booking.id} — ${booking.vtc_name}`)
      .setDescription(statusMsg)
      .addFields(
        { name: "Ticket Channel", value: `<#${channel.id}>` },
        { name: "Event Date", value: booking.event_date, inline: true },
        { name: "Meetup Time", value: `${booking.meetup_time} ${booking.timezone}`, inline: true },
        { name: "Departure Time", value: `${booking.departure_time} ${booking.timezone}`, inline: true }
      );

    return interaction.editReply({ embeds: [eb] });
  }
}

module.exports = { handleInteraction };
