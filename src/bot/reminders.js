const cron = require("node-cron");
const { prisma } = require("../db/prisma");
const { utcDateTimeFromParts, addMinutes } = require("../util/time");
const { logger } = require("../logger");

function parseReminderMinutes(csv) {
  return csv.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
}

function startReminderLoop(client) {
  // every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const bookings = await prisma.booking.findMany({
        where: {
          status: "ACCEPTED"
        }
      });

      for (const b of bookings) {
        const cfg = await prisma.guildConfig.findUnique({ where: { id: b.guildId } });
        if (!cfg || !cfg.remindersEnabled) continue;
        if (!b.ticketChannelId) continue;

        const start = utcDateTimeFromParts(b.eventDate, b.meetupTime);
        const mins = parseReminderMinutes(cfg.reminderMinutesCsv);

        for (const m of mins) {
          const when = addMinutes(start, -m);
          const due = Math.abs(now.getTime() - when.getTime()) <= 30 * 1000; // 30s window
          if (!due) continue;

          // prevent duplicates
          const exists = await prisma.reminderLog.findUnique({
            where: { bookingId_minutes: { bookingId: b.id, minutes: m } }
          }).catch(()=>null);
          if (exists) continue;

          const guild = await client.guilds.fetch(b.guildId);
          const channel = await guild.channels.fetch(b.ticketChannelId).catch(()=>null);
          if (!channel) continue;

          await channel.send({
            content:
`⏰ **Reminder:** Your event starts soon.
• **VTC:** ${b.vtcName}
• **Date:** ${b.eventDate} (UTC)
• **Meetup:** ${b.meetupTime} (UTC)
This reminder is **${m} minutes** before meetup time.`
          }).catch(()=>{});

          await prisma.reminderLog.create({ data: { bookingId: b.id, minutes: m } }).catch(()=>{});
        }
      }
    } catch (e) {
      logger.warn("Reminder loop error:", e.message);
    }
  });
}

module.exports = { startReminderLoop };
