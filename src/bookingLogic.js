const { db, ensureGuildConfig } = require("./db");
const { overlaps, parseDateTimeToUTC, toISOString } = require("./utils");
const appConfig = require("./config");

async function getGuildConfig(guildId) {
  return await ensureGuildConfig(guildId, appConfig);
}

function computeWindow(meetupUTC, configRow) {
  const start = new Date(meetupUTC);
  const end = new Date(start.getTime() + configRow.default_duration_minutes * 60 * 1000);
  const bufferMs = configRow.buffer_minutes * 60 * 1000;
  const startBuffered = new Date(start.getTime() - bufferMs);
  const endBuffered = new Date(end.getTime() + bufferMs);
  return { start, end, startBuffered, endBuffered };
}

async function getAcceptedBookings(guildId) {
  await db.read();
  return db.data.bookings.filter(b => b.guild_id === guildId && b.status === "ACCEPTED");
}

async function getBlackouts(guildId, date) {
  await db.read();
  return db.data.blackouts.filter(bl => bl.guild_id === guildId && bl.date === date);
}

async function isConflict(guildId, meetupUTC, configRow) {
  const { startBuffered, endBuffered } = computeWindow(meetupUTC, configRow);

  const accepted = await getAcceptedBookings(guildId);
  for (const b of accepted) {
    const bMeet = new Date(b.meetup_utc);
    const { startBuffered: bStart, endBuffered: bEnd } = computeWindow(bMeet, configRow);
    if (overlaps(startBuffered, endBuffered, bStart, bEnd)) {
      return { conflict: true, type: "BOOKING", withBookingId: b.id };
    }
  }

  const date = meetupUTC.slice(0, 10);
  const blackouts = await getBlackouts(guildId, date);
  for (const bl of blackouts) {
    const blStart = parseDateTimeToUTC(date, bl.start_time, "UTC");
    const blEnd = parseDateTimeToUTC(date, bl.end_time, "UTC");
    if (overlaps(startBuffered, endBuffered, blStart, blEnd)) {
      return { conflict: true, type: "BLACKOUT", blackoutId: bl.id };
    }
  }

  return { conflict: false };
}

async function createBooking({ guildId, requesterId, requesterTag, fields }) {
  const now = new Date().toISOString();
  const cfg = await getGuildConfig(guildId);

  const meetupUTCDate = parseDateTimeToUTC(fields.event_date, fields.meetup_time, fields.timezone);
  const depUTCDate = parseDateTimeToUTC(fields.event_date, fields.departure_time, fields.timezone);

  const meetup_utc = toISOString(meetupUTCDate);
  const departure_utc = toISOString(depUTCDate);

  const conflictRes = await isConflict(guildId, meetup_utc, cfg);

  let status = "ACCEPTED";
  if (conflictRes.conflict) status = "DECLINED";
  if (!conflictRes.conflict && cfg.review_enabled) status = "REVIEW";

  await db.read();
  const newId = (db.data.bookings.at(-1)?.id || 0) + 1;

  const booking = {
    id: newId,
    guild_id: guildId,
    requester_id: requesterId,
    requester_tag: requesterTag,

    vtc_name: fields.vtc_name,
    event_date: fields.event_date,
    meetup_time: fields.meetup_time,
    departure_time: fields.departure_time,
    timezone: fields.timezone,
    server: fields.server,
    start_location: fields.start_location,
    destination: fields.destination,
    dlcs_required: fields.dlcs_required,
    tmp_event_link: fields.tmp_event_link,
    other_notes: fields.other_notes || null,

    status,
    created_at: now,
    updated_at: now,

    ticket_channel_id: null,
    ticket_category_id: null,

    // ✅ We'll store the ID of the "Booking Summary" embed message in the ticket
    summary_message_id: null,

    meetup_utc,
    departure_utc
  };

  db.data.bookings.push(booking);
  await db.write();

  return { bookingId: newId, status, conflictRes, cfg };
}

async function updateBookingStatus(guildId, bookingId, status) {
  const now = new Date().toISOString();
  await db.read();
  const b = db.data.bookings.find(x => x.guild_id === guildId && x.id === bookingId);
  if (!b) return;
  b.status = status;
  b.updated_at = now;
  await db.write();
}

async function setTicketInfo(guildId, bookingId, channelId, categoryId) {
  const now = new Date().toISOString();
  await db.read();
  const b = db.data.bookings.find(x => x.guild_id === guildId && x.id === bookingId);
  if (!b) return;
  b.ticket_channel_id = channelId;
  b.ticket_category_id = categoryId;
  b.updated_at = now;
  await db.write();
}

// ✅ NEW: store the summary embed message id so we can edit/update it later
async function setSummaryMessageId(guildId, bookingId, messageId) {
  const now = new Date().toISOString();
  await db.read();
  const b = db.data.bookings.find(x => x.guild_id === guildId && x.id === bookingId);
  if (!b) return;
  b.summary_message_id = messageId;
  b.updated_at = now;
  await db.write();
}

async function getBooking(guildId, bookingId) {
  await db.read();
  return db.data.bookings.find(x => x.guild_id === guildId && x.id === bookingId) || null;
}

async function listBookings(guildId) {
  await db.read();
  return db.data.bookings
    .filter(x => x.guild_id === guildId)
    .sort((a, b) => new Date(a.meetup_utc) - new Date(b.meetup_utc));
}

module.exports = {
  getGuildConfig,
  createBooking,
  updateBookingStatus,
  setTicketInfo,
  setSummaryMessageId, // ✅ export
  getBooking,
  listBookings,
  isConflict
};
