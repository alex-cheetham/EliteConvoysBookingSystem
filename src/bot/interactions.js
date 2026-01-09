const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionType
} = require("discord.js");

const { prisma } = require("../db/prisma");
const { validateBooking } = require("../util/validate");
const { panelMessage } = require("./registerPanels");
const { ensureTicketForBooking, updateTicketForBooking } = require("./tickets");
const { findConflicts, decideOutcome } = require("../util/conflicts");

async function handleSlash(interaction) {
  if (interaction.commandName === "convoy-panel") {
    await interaction.reply({ ...panelMessage(), ephemeral: false });
  }
}

function bookingModal() {
  const modal = new ModalBuilder()
    .setCustomId("ec_booking_modal")
    .setTitle("Convoy Control Booking");

  const vtcName = new TextInputBuilder()
    .setCustomId("vtcName")
    .setLabel("VTC Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  const eventDate = new TextInputBuilder()
    .setCustomId("eventDate")
    .setLabel("Event Date (UTC) — YYYY-MM-DD")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("2026-01-20");

  const meetupTime = new TextInputBuilder()
    .setCustomId("meetupTime")
    .setLabel("Meetup Time (UTC) — HH:mm")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("18:30");

  const departureTime = new TextInputBuilder()
    .setCustomId("departureTime")
    .setLabel("Departure Time (UTC) — HH:mm")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("19:00");

  const serverName = new TextInputBuilder()
    .setCustomId("serverName")
    .setLabel("Server (e.g. Simulation 1)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);

  modal.addComponents(
    new ActionRowBuilder().addComponents(vtcName),
    new ActionRowBuilder().addComponents(eventDate),
    new ActionRowBuilder().addComponents(meetupTime),
    new ActionRowBuilder().addComponents(departureTime),
    new ActionRowBuilder().addComponents(serverName)
  );

  return modal;
}

function bookingModal2() {
  const modal = new ModalBuilder()
    .setCustomId("ec_booking_modal2")
    .setTitle("Convoy Details");

  const startLocation = new TextInputBuilder()
    .setCustomId("startLocation")
    .setLabel("Start Location")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(120);

  const destination = new TextInputBuilder()
    .setCustomId("destination")
    .setLabel("Destination")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(120);

  const requiredDlcs = new TextInputBuilder()
    .setCustomId("requiredDlcs")
    .setLabel("Required DLCs")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("None / Scandinavia / Iberia ...")
    .setMaxLength(200);

  const tmpEventLink = new TextInputBuilder()
    .setCustomId("tmpEventLink")
    .setLabel("TruckersMP Event Link (URL)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const notes = new TextInputBuilder()
    .setCustomId("notes")
    .setLabel("Optional Notes")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(startLocation),
    new ActionRowBuilder().addComponents(destination),
    new ActionRowBuilder().addComponents(requiredDlcs),
    new ActionRowBuilder().addComponents(tmpEventLink),
    new ActionRowBuilder().addComponents(notes)
  );

  return modal;
}

// Draft storage
async function saveDraft(guildId, userId, payload) {
  await prisma.bookingDraft.deleteMany({ where: { guildId, userId } });
  await prisma.bookingDraft.create({
    data: { guildId, userId, payloadJson: JSON.stringify(payload) }
  });
}

async function loadDraft(guildId, userId) {
  const draft = await prisma.bookingDraft.findFirst({
    where: { guildId, userId },
    orderBy: { createdAt: "desc" }
  });
  if (!draft) return null;
  try { return JSON.parse(draft.payloadJson); } catch { return null; }
}

async function clearDraft(guildId, userId) {
  await prisma.bookingDraft.deleteMany({ where: { guildId, userId } });
}

function continueRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ec_continue_to_step2")
      .setLabel("Continue to Step 2")
      .setStyle(ButtonStyle.Success)
  );
}

function attachInteractionHandlers(client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      // Slash
      if (interaction.isChatInputCommand?.()) return handleSlash(interaction);

      // Button: open step 1 modal
      if (interaction.type === InteractionType.MessageComponent && interaction.customId === "ec_request_convoy_control") {
        return interaction.showModal(bookingModal());
      }

      // Button: open step 2 modal (after step 1 saved)
      if (interaction.type === InteractionType.MessageComponent && interaction.customId === "ec_continue_to_step2") {
        const guildId = interaction.guildId;
        if (!guildId) return interaction.reply({ ephemeral: true, content: "❌ This must be used in a server." });

        const prefill = await loadDraft(guildId, interaction.user.id);
        if (!prefill) {
          return interaction.reply({
            ephemeral: true,
            content: "❌ Your booking session expired. Please click **Request Convoy Control** again."
          });
        }

        return interaction.showModal(bookingModal2());
      }

      // Modal submits
      if (interaction.type === InteractionType.ModalSubmit) {
        // Step 1: save then show continue button
        if (interaction.customId === "ec_booking_modal") {
          const guildId = interaction.guildId;
          if (!guildId) return interaction.reply({ ephemeral: true, content: "❌ This must be used in a server." });

          const prefill = {
            vtcName: interaction.fields.getTextInputValue("vtcName"),
            eventDate: interaction.fields.getTextInputValue("eventDate"),
            meetupTime: interaction.fields.getTextInputValue("meetupTime"),
            departureTime: interaction.fields.getTextInputValue("departureTime"),
            serverName: interaction.fields.getTextInputValue("serverName"),
          };

          await saveDraft(guildId, interaction.user.id, prefill);

          return interaction.reply({
            ephemeral: true,
            content: "✅ Step 1 saved. Click **Continue to Step 2** to finish your booking.",
            components: [continueRow()]
          });
        }

        // Step 2: create booking
        if (interaction.customId === "ec_booking_modal2") {
          const guildId = interaction.guildId;
          if (!guildId) return interaction.reply({ ephemeral: true, content: "❌ This must be used in a server." });

          // ✅ ACK immediately so Discord never expires the interaction
          await interaction.deferReply({ ephemeral: true });

          const prefill = await loadDraft(guildId, interaction.user.id);
          if (!prefill) {
            return interaction.editReply("❌ Your booking session expired. Please click **Request Convoy Control** again.");
          }

          const data = {
            ...prefill,
            startLocation: interaction.fields.getTextInputValue("startLocation"),
            destination: interaction.fields.getTextInputValue("destination"),
            requiredDlcs: interaction.fields.getTextInputValue("requiredDlcs"),
            tmpEventLink: interaction.fields.getTextInputValue("tmpEventLink"),
            notes: interaction.fields.getTextInputValue("notes"),
          };

          await clearDraft(guildId, interaction.user.id);

          let bookingInput;
          try {
            bookingInput = validateBooking(data);
          } catch (e) {
            return interaction.editReply(`❌ Validation failed. Check date/time and TMP link.\n\nDetails: ${e.message}`);
          }

          const config = await prisma.guildConfig.upsert({
            where: { id: guildId },
            update: {},
            create: { id: guildId }
          });

          const conflicts = await findConflicts(
            guildId,
            bookingInput,
            config.defaultEventDurationM,
            config.bufferTimeM
          );

          const decision = decideOutcome(conflicts, config.reviewMode);

          let initialStatus = "REQUESTED";
          if (decision.auto === "DECLINED") initialStatus = "DECLINED";
          else if (decision.auto === "REVIEW") initialStatus = "REVIEW";

          const requesterId = interaction.user.id;
          const requesterTag = interaction.user.tag;

          const history = [{ status: initialStatus, at: new Date().toISOString(), by: requesterId }];

          const autoDeclineFields =
            initialStatus === "DECLINED"
              ? {
                  declineReason: String(decision.reason || "Declined").slice(0, 900),
                  declineReasonSource: String(decision.reasonSource || "SYSTEM")
                }
              : {};

          const booking = await prisma.booking.create({
            data: {
              guildId,
              requesterId,
              requesterTag,
              ...bookingInput,
              notes: bookingInput.notes || null,
              status: initialStatus,
              statusHistory: JSON.stringify(history),
              ...autoDeclineFields
            }
          });

          await ensureTicketForBooking(client, booking.id);
          await updateTicketForBooking(client, booking.id);

          const extra =
            initialStatus === "DECLINED"
              ? `\n\n⚠ Auto-declined: **${decision.reason}**`
              : initialStatus === "REVIEW"
                ? `\n\n🕵️ Your request is in **REVIEW**.`
                : `\n\n📩 Your request is **REQUESTED**.`;

          return interaction.editReply(`✅ Booking submitted and ticket created.${extra}`);
        }
      }
    } catch (err) {
      console.error(err);
      try {
        if (interaction.isRepliable?.()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ ephemeral: true, content: "❌ Something went wrong." }).catch(() => {});
          } else {
            await interaction.reply({ ephemeral: true, content: "❌ Something went wrong." }).catch(() => {});
          }
        }
      } catch {}
    }
  });
}

module.exports = { attachInteractionHandlers };
