const { EmbedBuilder } = require("discord.js");
const { pad2, slugify } = require("../utils");
const { buildBaseOverwrites, applyStageVisibility } = require("../permissions");
const { STATUS_ICONS } = require("../config");
const { setSummaryMessageId } = require("../bookingLogic");

function monthCategoryName(monthIndex1, monthName, prefix) {
  return `${prefix} ${pad2(monthIndex1)}-${monthName}`;
}

function getMonthName(dateStrYYYYMMDD) {
  const [y, m] = dateStrYYYYMMDD.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
}

async function ensureMonthCategory(guild, eventDate, prefix) {
  const [y, m] = eventDate.split("-").map(Number);
  const monthName = getMonthName(eventDate);
  const wanted = monthCategoryName(m, monthName, prefix);

  const existing = guild.channels.cache.find(ch => ch.type === 4 && ch.name === wanted);
  if (existing) return existing;

  return await guild.channels.create({
    name: wanted,
    type: 4
  });
}

function channelNameForBooking(booking) {
  const icon = STATUS_ICONS[booking.status] || STATUS_ICONS.REQUESTED;
  const day = booking.event_date.split("-")[2];
  const slug = slugify(`${booking.vtc_name}-${booking.event_date}`);
  return `${icon}-${day}-${slug}`.slice(0, 95);
}

function bookingEmbed(booking) {
  const eb = new EmbedBuilder()
    .setTitle(`Booking #${booking.id} — ${booking.vtc_name}`)
    .addFields(
      { name: "Event Date", value: booking.event_date || "-", inline: true },
      { name: "Meetup Time", value: `${booking.meetup_time || "-"} (${booking.timezone || "UTC"})`, inline: true },
      { name: "Departure Time", value: `${booking.departure_time || "-"} (${booking.timezone || "UTC"})`, inline: true },

      { name: "Server", value: booking.server || "-", inline: false },
      { name: "Start Location", value: booking.start_location || "-", inline: true },
      { name: "Destination", value: booking.destination || "-", inline: true },

      { name: "DLC's Required", value: booking.dlcs_required || "-", inline: true },
      { name: "TMP Event Link", value: booking.tmp_event_link || "-", inline: false },

      { name: "Status", value: booking.status || "-", inline: false }
    )
    .setFooter({ text: "Elite Convoys — Convoy Control Booking" });

  if (booking.other_notes) eb.addFields({ name: "Other Notes", value: booking.other_notes });

  return eb;
}

async function ensureOrUpdateSummaryMessage(guild, channel, booking) {
  // If we already stored a summary message ID, try to edit it
  if (booking.summary_message_id) {
    const existing = await channel.messages.fetch(booking.summary_message_id).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [bookingEmbed(booking)] }).catch(() => {});
      return existing;
    }
  }

  // Otherwise, send a new summary message, pin it, and store ID
  const msg = await channel.send({ embeds: [bookingEmbed(booking)] });
  await msg.pin().catch(() => {});
  await setSummaryMessageId(guild.id, booking.id, msg.id);
  return msg;
}

async function createOrUpdateTicketChannel({ guild, booking, configPrefix }) {
  const category = await ensureMonthCategory(guild, booking.event_date, configPrefix);
  const name = channelNameForBooking(booking);

  // permissions
  let overwrites = buildBaseOverwrites(guild, booking.requester_id);
  overwrites = applyStageVisibility(overwrites, booking.status);

  // If ticket exists, update it
  if (booking.ticket_channel_id) {
    const ch = await guild.channels.fetch(booking.ticket_channel_id).catch(() => null);
    if (ch) {
      await ch.setName(name).catch(() => {});
      await ch.setParent(category.id).catch(() => {});
      await ch.permissionOverwrites.set(overwrites).catch(() => {});

      // ✅ Update the stored summary embed in this ticket
      await ensureOrUpdateSummaryMessage(guild, ch, booking);

      return { channel: ch, category };
    }
  }

  // Create new ticket channel
  const ch = await guild.channels.create({
    name,
    parent: category.id,
    permissionOverwrites: overwrites
  });

  // ✅ Create + store the summary embed message (and pin it)
  await ensureOrUpdateSummaryMessage(guild, ch, booking);

  return { channel: ch, category };
}

module.exports = {
  createOrUpdateTicketChannel,
  bookingEmbed
};
