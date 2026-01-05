const { EmbedBuilder } = require("discord.js");
const { pad2, slugify } = require("../utils");
const { buildBaseOverwrites, applyStageVisibility } = require("../permissions");
const { STATUS_ICONS, STATUS_COLORS } = require("../config");
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
  const icon = STATUS_ICONS[booking.status] || "📌";
  const day = booking.event_date.split("-")[2];
  const slug = slugify(`${booking.vtc_name}-${booking.event_date}`);
  return `${icon}-${day}-${slug}`.slice(0, 95);
}

function bookingEmbed(booking) {
  const icon = STATUS_ICONS[booking.status] || "📌";
  const color = STATUS_COLORS[booking.status] || 0x4f8cff;

  const eb = new EmbedBuilder()
    .setTitle(`Booking #${booking.id} — ${booking.vtc_name}`)
    .setColor(color);

  if (booking.real_ops_attending) {
    eb.setDescription("⚠️ **Real Operations will be in effect for this event.**");
  }

  eb.addFields(
    { name: "Event Date", value: booking.event_date || "-", inline: true },
    { name: "Meetup Time", value: `${booking.meetup_time || "-"} (${booking.timezone || "UTC"})`, inline: true },
    { name: "Departure Time", value: `${booking.departure_time || "-"} (${booking.timezone || "UTC"})`, inline: true },

    { name: "Server", value: booking.server || "-", inline: false },
    { name: "Start Location", value: booking.start_location || "-", inline: true },
    { name: "Destination", value: booking.destination || "-", inline: true },

    { name: "DLC's Required", value: booking.dlcs_required || "-", inline: true },
    { name: "TMP Event Link", value: booking.tmp_event_link || "-", inline: false },

    { name: "Status", value: `${icon} **${booking.status}**`, inline: false }
  );

  if (booking.other_notes) eb.addFields({ name: "Other Notes", value: booking.other_notes });

  eb.setFooter({ text: "Elite Convoys — Convoy Control Booking" });
  return eb;
}

async function ensureOrUpdateSummaryMessage(guild, channel, booking) {
  if (booking.summary_message_id) {
    const existing = await channel.messages.fetch(booking.summary_message_id).catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [bookingEmbed(booking)] }).catch(() => {});
      return existing;
    }
  }

  const msg = await channel.send({ embeds: [bookingEmbed(booking)] });
  await msg.pin().catch(() => {});
  await setSummaryMessageId(guild.id, booking.id, msg.id);
  return msg;
}

async function createOrUpdateTicketChannel({ guild, booking, configPrefix }) {
  const category = await ensureMonthCategory(guild, booking.event_date, configPrefix);
  const name = channelNameForBooking(booking);

  let overwrites = buildBaseOverwrites(guild, booking.requester_id);
  overwrites = applyStageVisibility(overwrites, booking.status);

  if (booking.ticket_channel_id) {
    const ch = await guild.channels.fetch(booking.ticket_channel_id).catch(() => null);
    if (ch) {
      await ch.setName(name).catch(() => {});
      await ch.setParent(category.id).catch(() => {});
      await ch.permissionOverwrites.set(overwrites).catch(() => {});
      await ensureOrUpdateSummaryMessage(guild, ch, booking);
      return { channel: ch, category };
    }
  }

  const ch = await guild.channels.create({
    name,
    parent: category.id,
    permissionOverwrites: overwrites
  });

  await ensureOrUpdateSummaryMessage(guild, ch, booking);
  return { channel: ch, category };
}

module.exports = {
  createOrUpdateTicketChannel,
  bookingEmbed
};
