const { AttachmentBuilder, EmbedBuilder } = require("discord.js");

/**
 * Fetches all messages in a text channel (best-effort), returns oldest->newest.
 */
async function fetchAllMessages(channel, limitHard = 5000) {
  const out = [];
  let lastId = null;

  while (out.length < limitHard) {
    const batch = await channel.messages
      .fetch({ limit: 100, before: lastId })
      .catch(() => null);

    if (!batch || batch.size === 0) break;

    const arr = Array.from(batch.values());
    out.push(...arr);
    lastId = arr[arr.length - 1].id;

    if (batch.size < 100) break;
  }

  out.sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));
  return out;
}

function safe(s) {
  return String(s ?? "").replace(/\r?\n/g, " ").trim();
}

/**
 * Builds a plain text transcript.
 */
function buildTextTranscript(channel, messages) {
  const lines = [];
  lines.push(`Transcript for #${channel.name} (${channel.id})`);
  lines.push(`Guild: ${channel.guild?.name} (${channel.guild?.id})`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("=".repeat(80));

  for (const m of messages) {
    const ts = new Date(m.createdTimestamp).toISOString();
    const author = `${m.author?.tag || "Unknown"} (${m.author?.id || "?"})`;
    const content = safe(m.content);

    lines.push(`[${ts}] ${author}: ${content}`);

    if (Array.isArray(m.embeds) && m.embeds.length) {
      for (const e of m.embeds) {
        const t = safe(e?.title);
        const d = safe(e?.description);
        if (t || d) lines.push(`  [EMBED] ${t}${t && d ? " — " : ""}${d}`);
      }
    }

    if (m.attachments?.size) {
      for (const a of m.attachments.values()) {
        lines.push(`  [FILE] ${a.name} — ${a.url}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Sends transcript to a channel ID as an attachment + a small embed.
 *
 * IMPORTANT:
 * - This function will ONLY send when booking.status === "COMPLETED"
 *   (so it can't spam transcripts for other status changes).
 */
async function sendTranscriptToChannel(client, guildId, sourceChannel, booking, transcriptChannelId) {
  // ✅ Only post transcript when marked as COMPLETE
  if (!booking || booking.status !== "COMPLETED") return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const dest = await guild.channels.fetch(transcriptChannelId).catch(() => null);
  if (!dest || !dest.isTextBased?.()) return;

  const messages = await fetchAllMessages(sourceChannel);
  const text = buildTextTranscript(sourceChannel, messages);

  const filename = `transcript-${booking.id}-${sourceChannel.id}.txt`;
  const attachment = new AttachmentBuilder(Buffer.from(text, "utf8"), { name: filename });

  const embed = new EmbedBuilder()
    .setTitle("📄 Ticket Transcript")
    .setDescription(
      [
        `**Booking ID:** ${booking.id}`,
        `**Requester:** <@${booking.requesterId}>`,
        `**Status:** ${booking.status}`,
        `**Ticket:** #${sourceChannel.name} (${sourceChannel.id})`
      ].join("\n")
    )
    .setTimestamp(new Date());

  await dest.send({ embeds: [embed], files: [attachment] }).catch(() => {});
}

module.exports = { sendTranscriptToChannel };
