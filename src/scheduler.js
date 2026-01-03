const { db, addAudit } = require("./db");
const { REMINDER_MINUTES } = require("./config");

function startScheduler(client) {
  setInterval(async () => {
    const now = new Date();

    await db.read();
    const bookings = db.data.bookings.filter(
      b => b.status === "ACCEPTED" && b.ticket_channel_id
    );

    for (const b of bookings) {
      const meetup = new Date(b.meetup_utc);

      for (const minutesBefore of REMINDER_MINUTES) {
        const remindAt = new Date(meetup.getTime() - minutesBefore * 60 * 1000);
        const marker = `REMINDER_SENT:${b.id}:${minutesBefore}`;

        const already = db.data.audit.some(a => a.details === marker);
        if (already) continue;

        if (now >= remindAt && now < new Date(remindAt.getTime() + 60 * 1000)) {
          const ch = await client.channels.fetch(b.ticket_channel_id).catch(() => null);
          if (!ch) continue;

          await ch.send(`⏰ Reminder: **${b.vtc_name}** booking (#${b.id}) meetup in **${minutesBefore} minutes**.`);
          await addAudit({
            guild_id: b.guild_id,
            actor_id: "system",
            actor_tag: "system",
            action: "REMINDER",
            details: marker
          });
        }
      }
    }
  }, 30 * 1000);
}

module.exports = { startScheduler };
