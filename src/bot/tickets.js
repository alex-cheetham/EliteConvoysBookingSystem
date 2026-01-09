const {
  ChannelType,
  PermissionsBitField
} = require("discord.js");

const { prisma } = require("../db/prisma");
const { STATUS_META } = require("../util/constants");
const { bookingSummaryEmbed, acceptanceMessageParts, declineEmbed } = require("../util/embeds");
const { baseTicketOverwrites, applyStatusPermAdjustments } = require("../util/perms");

function monthKeyFromYmd(ymd) {
  return ymd.slice(0, 7);
}

function parseYmdHmToSortable(ymd, hm) {
  try {
    const [Y, M, D] = ymd.split("-").map(Number);
    const [h, m] = (hm || "00:00").split(":").map(Number);
    return Date.UTC(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0, 0);
  } catch {
    return 0;
  }
}

async function ensureMonthlyCategory(guild, config, ymd) {
  const key = monthKeyFromYmd(ymd);
  const desiredName = `${config.ticketCategoryPrefix} • ${key}`;

  await guild.channels.fetch().catch(() => {});

  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === desiredName
  );
  if (existing) return existing;

  const created = await guild.channels.create({
    name: desiredName,
    type: ChannelType.GuildCategory
  });

  await created.setPosition(9999).catch(() => {});
  return created;
}

function ticketNameFor(booking) {
  const meta = STATUS_META[booking.status];
  const date = booking.eventDate;
  const safeVtc = booking.vtcName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 30)
    .replace(/-$/, "");
  return `${meta.emoji}-${date}-${safeVtc}`;
}

async function reorderAllTicketCategories(guild, prefix) {
  await guild.channels.fetch().catch(() => {});

  const ticketPrefix = `${prefix} • `;
  const allCats = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);

  const ticketCats = allCats
    .filter(c => c.name.startsWith(ticketPrefix))
    .map(c => ({ channel: c, key: c.name.slice(ticketPrefix.length).trim() }))
    .filter(x => /^\d{4}-\d{2}$/.test(x.key))
    .sort((a, b) => a.key.localeCompare(b.key));

  if (ticketCats.length === 0) return;

  const nonTicketCats = allCats.filter(c => !c.name.startsWith(ticketPrefix));

  const maxNonTicketPos = nonTicketCats.size
    ? Math.max(...nonTicketCats.map(c => c.position))
    : -1;

  const startPos = maxNonTicketPos + 1;

  for (let i = 0; i < ticketCats.length; i++) {
    const cat = ticketCats[i].channel;
    const desiredPos = startPos + i;
    if (cat.position !== desiredPos) {
      await cat.setPosition(desiredPos).catch(() => {});
    }
  }
}

async function reorderMonthCategory(guild, categoryId) {
  await guild.channels.fetch().catch(() => {});

  const category = guild.channels.cache.get(categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) return;

  const children = guild.channels.cache
    .filter(c => c.parentId === categoryId && c.type === ChannelType.GuildText)
    .map(c => c);

  if (children.length <= 1) return;

  const ids = children.map(c => c.id);

  const bookings = await prisma.booking.findMany({
    where: { ticketChannelId: { in: ids } }
  });

  const byChannelId = new Map(bookings.map(b => [b.ticketChannelId, b]));

  const sorted = children
    .map(ch => {
      const b = byChannelId.get(ch.id);
      const sortTime = b ? parseYmdHmToSortable(b.eventDate, b.meetupTime) : 0;
      const created = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return { ch, sortTime, created };
    })
    .sort((a, b) => {
      if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;
      return a.created - b.created;
    });

  for (let i = 0; i < sorted.length; i++) {
    await sorted[i].ch.setPosition(i).catch(() => {});
  }
}

async function ensureTicketForBooking(client, bookingId) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  if (booking.ticketChannelId) return;

  const guild = await client.guilds.fetch(booking.guildId);
  const config = await prisma.guildConfig.findUnique({ where: { id: booking.guildId } });

  const category = await ensureMonthlyCategory(guild, config, booking.eventDate);

  const overwrites = baseTicketOverwrites(guild, config, booking.requesterId);

  overwrites.push({
    id: guild.members.me.id,
    allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageMessages
    ]
  });

  applyStatusPermAdjustments(overwrites, booking.status);

  const channel = await guild.channels.create({
    name: ticketNameFor(booking),
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: overwrites,
    topic: `Elite Convoys Booking • ${booking.id} • Requester: ${booking.requesterTag}`
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { ticketChannelId: channel.id, ticketCategoryId: category.id }
  });

  // Create + pin summary once
  const summary = bookingSummaryEmbed(booking, config);
  const msg = await channel.send({ embeds: [summary] });
  await msg.pin().catch(() => {});

  await reorderMonthCategory(guild, category.id);
  await reorderAllTicketCategories(guild, config.ticketCategoryPrefix);
}

function getLastTwoStatuses(statusHistoryJson) {
  try {
    const arr = JSON.parse(statusHistoryJson || "[]");
    const last = arr[arr.length - 1]?.status || null;
    const prev = arr[arr.length - 2]?.status || null;
    return { prev, last };
  } catch {
    return { prev: null, last: null };
  }
}

async function updateTicketForBooking(client, bookingId, changedByUserId = null) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !booking.ticketChannelId) return;

  const guild = await client.guilds.fetch(booking.guildId);
  const channel = await guild.channels.fetch(booking.ticketChannelId).catch(() => null);
  if (!channel) return;

  const config = await prisma.guildConfig.findUnique({ where: { id: booking.guildId } });

  const category = await ensureMonthlyCategory(guild, config, booking.eventDate);
  if (channel.parentId !== category.id) {
    await channel.setParent(category.id).catch(() => {});
  }

  await channel.setName(ticketNameFor(booking)).catch(() => {});

  let overwrites = baseTicketOverwrites(guild, config, booking.requesterId);

  overwrites.push({
    id: guild.members.me.id,
    allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageMessages
    ]
  });

  applyStatusPermAdjustments(overwrites, booking.status);
  await channel.permissionOverwrites.set(overwrites).catch(() => {});

  // ✅ Update existing summary message reliably (pins OR recent messages), never duplicate
  const summaryEmbed = bookingSummaryEmbed(booking, config);

  let summaryMsg = null;

  // 1) Try pinned messages first
  const pins = await channel.messages.fetchPins().catch(() => null);
  if (pins && typeof pins.values === "function") {
    for (const m of pins.values()) {
      const emb = m?.embeds?.[0];
      const footerText = emb?.footer?.text || "";
      if (footerText.includes(`Booking ID: ${booking.id}`)) {
        summaryMsg = m;
        break;
      }
    }
  }

  // 2) If pins haven't "registered" yet, search recent messages (fixes race condition)
  if (!summaryMsg) {
    const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    if (recent && typeof recent.values === "function") {
      for (const m of recent.values()) {
        if (m?.author?.id !== client.user.id) continue;
        const emb = m?.embeds?.[0];
        const footerText = emb?.footer?.text || "";
        if (footerText.includes(`Booking ID: ${booking.id}`)) {
          summaryMsg = m;
          break;
        }
      }
    }
  }

  // 3) Edit if found; otherwise create once. Ensure it's pinned.
  if (summaryMsg) {
    await summaryMsg.edit({ embeds: [summaryEmbed] }).catch(() => {});
    if (!summaryMsg.pinned) {
      await summaryMsg.pin().catch(() => {});
    }
  } else {
    const msg = await channel.send({ embeds: [summaryEmbed] });
    await msg.pin().catch(() => {});
  }

  // Acceptance pack (only once)
  if (booking.status === "ACCEPTED" && !booking.acceptanceSent) {
    const staffName = changedByUserId
      ? (await guild.members.fetch(changedByUserId).then(m => m.displayName).catch(() => "Staff"))
      : "Staff";

    const pack = acceptanceMessageParts(booking, staffName);

    // ✅ Accepted message is an embed
    await channel.send({
      content: `<@${booking.requesterId}>`,
      embeds: [pack.acceptanceEmbed]
    }).catch(() => {});

    await channel.send({ embeds: [pack.rules] }).catch(() => {});
    await channel.send({ embeds: [pack.banner] }).catch(() => {});

    await prisma.booking.update({
      where: { id: booking.id },
      data: { acceptanceSent: true }
    });
  }

  // ✅ Declined message as separate embed, only when transitioning into DECLINED
  const { prev, last } = getLastTwoStatuses(booking.statusHistory);
  if (last === "DECLINED" && prev !== "DECLINED") {
    const staffName = changedByUserId
      ? (await guild.members.fetch(changedByUserId).then(m => m.displayName).catch(() => "Staff"))
      : "Staff";

    const reason = booking.declineReason || "No reason provided.";

    await channel.send({
      content: `<@${booking.requesterId}>`,
      embeds: [declineEmbed(booking, staffName, reason)]
    }).catch(() => {});
  }

  await reorderMonthCategory(guild, category.id);
  await reorderAllTicketCategories(guild, config.ticketCategoryPrefix);
}

module.exports = { ensureTicketForBooking, updateTicketForBooking };
