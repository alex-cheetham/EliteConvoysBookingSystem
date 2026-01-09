const router = require("express").Router();
const { prisma } = require("../../db/prisma");
const { requireStaff } = require("../middleware");
const { validateBooking } = require("../../util/validate");
const { updateTicketForBooking } = require("../../bot/tickets");
const { STATUS_META } = require("../../util/constants");
const { feedbackRequestEmbed } = require("../../util/embeds");
const { sendTranscriptToChannel } = require("../../bot/transcripts");

// ✅ Channel IDs (your values)
const FEEDBACK_CHANNEL_ID = "1352358849302102117";
const TRANSCRIPT_CHANNEL_ID = "1459314280297005148";

function pushHistory(existingJson, status, by) {
  const arr = JSON.parse(existingJson || "[]");
  arr.push({ status, at: new Date().toISOString(), by });
  return JSON.stringify(arr);
}

// Helper: Only delete month categories that match "<prefix> • YYYY-MM" and are empty
async function tryDeleteEmptyMonthCategory(guild, categoryId, ticketCategoryPrefix) {
  if (!guild || !categoryId || !ticketCategoryPrefix) return;

  await guild.channels.fetch().catch(() => {});
  const category = guild.channels.cache.get(categoryId);
  if (!category) return;

  const ticketPrefix = `${ticketCategoryPrefix} • `;
  const name = category.name || "";

  // only touch categories created by this system
  const key = name.slice(ticketPrefix.length).trim();
  if (!name.startsWith(ticketPrefix) || !/^\d{4}-\d{2}$/.test(key)) return;

  const children = guild.channels.cache.filter(c => c.parentId === categoryId);
  if (children.size === 0) {
    await category.delete("Auto cleanup: empty booking month category").catch(() => {});
  }
}

router.get("/bookings/:id", requireStaff(), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.guildId !== req.guildId) return res.status(404).send("Not found");

  res.render("booking", { title: "Booking", booking, STATUS_META });
});

router.post("/bookings/:id/status", requireStaff(), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.guildId !== req.guildId) return res.status(404).send("Not found");

  const next = String(req.body.status || "");
  const allowed = Object.keys(STATUS_META);
  if (!allowed.includes(next)) return res.status(400).send("Invalid status");

  // Detect transition into COMPLETED (for feedback message)
  const transitionedToCompleted = booking.status !== "COMPLETED" && next === "COMPLETED";

  // NEW: require a decline reason if staff is declining
  let declineReason = null;
  let declineReasonSource = null;

  if (next === "DECLINED") {
    declineReason = String(req.body.declineReason || "").trim();
    if (!declineReason) {
      return res.status(400).send("Decline reason is required when declining a booking.");
    }
    if (declineReason.length > 900) declineReason = declineReason.slice(0, 900);
    declineReasonSource = "STAFF";
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: next,
      statusHistory: pushHistory(booking.statusHistory, next, req.user.id),

      ...(next === "DECLINED"
        ? { declineReason, declineReasonSource }
        : { declineReasonSource: null }
      )
    }
  });

  const client = require("../../bot/client").getBotClient();

  // Update Discord ticket name/embeds/perms and send acceptance pack if needed
  await updateTicketForBooking(client, updated.id, req.user.id);

  // ✅ Feedback prompt ONLY when transitioning into COMPLETED
  if (transitionedToCompleted && updated.ticketChannelId) {
    const guild = await client.guilds.fetch(updated.guildId).catch(() => null);
    const channel = guild
      ? await guild.channels.fetch(updated.ticketChannelId).catch(() => null)
      : null;

    const config = await prisma.guildConfig.findUnique({ where: { id: updated.guildId } });

    if (channel && channel.isTextBased?.()) {
      await channel.send({
        content: `<@${updated.requesterId}>`,
        embeds: [feedbackRequestEmbed(updated, FEEDBACK_CHANNEL_ID)]
      }).catch(() => {});
    }
  }

  res.redirect(`/bookings/${booking.id}`);
});

router.post("/bookings/:id/edit", requireStaff(), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.guildId !== req.guildId) return res.status(404).send("Not found");

  const data = {
    vtcName: req.body.vtcName,
    eventDate: req.body.eventDate,
    meetupTime: req.body.meetupTime,
    departureTime: req.body.departureTime,
    serverName: req.body.serverName,
    startLocation: req.body.startLocation,
    destination: req.body.destination,
    requiredDlcs: req.body.requiredDlcs,
    tmpEventLink: req.body.tmpEventLink,
    notes: req.body.notes || ""
  };

  let parsed;
  try {
    parsed = validateBooking(data);
  } catch (e) {
    return res.status(400).send(`Validation error: ${e.message}`);
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      ...parsed,
      notes: parsed.notes || null,
      internalNotes: req.body.internalNotes || null,
      realOpsAttending: String(req.body.realOpsAttending) === "on"
    }
  });

  await updateTicketForBooking(require("../../bot/client").getBotClient(), updated.id, req.user.id);

  res.redirect(`/bookings/${booking.id}`);
});

router.post("/bookings/:id/request-info", requireStaff(), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.guildId !== req.guildId) return res.status(404).send("Not found");

  const msg = String(req.body.message || "").trim();
  if (!msg) return res.redirect(`/bookings/${booking.id}`);

  const client = require("../../bot/client").getBotClient();
  const guild = await client.guilds.fetch(booking.guildId);
  const channel = await guild.channels.fetch(booking.ticketChannelId).catch(() => null);

  if (channel) {
    await channel.send({
      content: `🔍 <@${booking.requesterId}> **Additional information requested by staff (${req.user.username}):**\n\n${msg}`
    }).catch(() => {});
  }

  res.redirect(`/bookings/${booking.id}`);
});

router.post("/bookings/:id/delete", requireStaff(), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.guildId !== req.guildId) return res.status(404).send("Not found");

  const confirm = String(req.body.confirm || "") === "DELETE";
  if (!confirm) return res.status(400).send('Type "DELETE" to confirm.');

  const client = require("../../bot/client").getBotClient();
  const guild = await client.guilds.fetch(booking.guildId).catch(() => null);

  // Load config so we can safely clean up month categories after delete
  const config = await prisma.guildConfig.findUnique({ where: { id: booking.guildId } });

  // Delete Discord channel (but FIRST: transcript if COMPLETED)
  let parentCategoryId = null;

  if (guild && booking.ticketChannelId) {
    const channel = await guild.channels.fetch(booking.ticketChannelId).catch(() => null);

    if (channel) {
      parentCategoryId = channel.parentId || null;

      // ✅ Transcript only posts if booking.status === "COMPLETED" (enforced inside helper)
      await sendTranscriptToChannel(
        client,
        booking.guildId,
        channel,
        booking,
        TRANSCRIPT_CHANNEL_ID
      );

      await channel.delete("Booking deleted from web panel").catch(() => {});
    }
  }

  // Delete DB
  await prisma.booking.delete({ where: { id: booking.id } });

  // ✅ Auto-delete empty month category
  if (guild && parentCategoryId && config?.ticketCategoryPrefix) {
    await tryDeleteEmptyMonthCategory(guild, parentCategoryId, config.ticketCategoryPrefix);
  }

  res.redirect("/dashboard");
});

module.exports = router;
