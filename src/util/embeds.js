const { EmbedBuilder } = require("discord.js");
const { STATUS_META } = require("./constants");

function bookingSummaryEmbed(booking, config) {
  const meta = STATUS_META[booking.status];
  const e = new EmbedBuilder()
    .setTitle(`${meta.emoji} ${meta.label} • ${booking.vtcName}`)
    .setColor(meta.color)
    .addFields(
      { name: "Date (UTC)", value: booking.eventDate, inline: true },
      { name: "Meetup (UTC)", value: booking.meetupTime, inline: true },
      { name: "Departure (UTC)", value: booking.departureTime, inline: true },
      { name: "Server", value: booking.serverName, inline: true },
      { name: "Start", value: booking.startLocation, inline: true },
      { name: "Destination", value: booking.destination, inline: true },
      { name: "Required DLCs", value: booking.requiredDlcs || "None", inline: false },
      { name: "TruckersMP Event Link", value: booking.tmpEventLink, inline: false }
    )
    .setFooter({ text: `Booking ID: ${booking.id}` })
    .setTimestamp(new Date(booking.updatedAt || Date.now()));

  if (booking.notes) {
    e.addFields({ name: "Notes", value: booking.notes.slice(0, 900), inline: false });
  }

  // ✅ Real Ops warning ONLY if this booking has real ops checked
  if (booking.realOpsAttending) {
    e.addFields({
      name: "⚠ Real Operations",
      value: "Real Operations booked for event - Please see notes for RO Group Details",
      inline: false
    });
  }

  // ✅ Show decline reason in summary when declined
  if (booking.status === "DECLINED" && booking.declineReason) {
    e.addFields({
      name: "❌ Declined Reason",
      value: booking.declineReason.slice(0, 900),
      inline: false
    });
  }

  return e;
}

function participantRulesText() {
  return [
    "The Event Staff are recognized as; “Elite | Staff\" or similar.",
    "",
    "Impersonating Event Staff using the aforementioned tags is forbidden.",
    "",
    "Double trailers, Triple trailers, HCT trailers and Heavy Haul configurations are prohibited. (Except Event Staff)",
    "",
    "Cars and Buses are prohibited except for event staff showing a clear tag.",
    "",
    "Participants must haul a trailer. (Except Event Staff)",
    "",
    "Advertising is prohibited. (Except Event Staff)",
    "",
    "Overtaking is prohibited.",
    "",
    "Participants must follow Event Staff instructions.",
    "",
    "Participants should park at their designated slots. If you do not have a designated slot you are required to park in the 'Public Parking' area.",
    "",
    "Participants must only leave the starting location when instructed to do so in an orderly (one by one) manner.",
    "",
    "All other TruckersMP rules apply."
  ].join("\n");
}

function staffRulesText() {
  return [
    "Event Staff overtaking the convoy cannot be performed by more than 2 members at a time.",
    "",
    "Event Staff can drive the incorrect way where roads have a central reservation barrier ONLY. In accordance with the rule above.",
    "",
    "Event Staff can block junctions and roads approaching junctions in order to direct the convoy.",
    "",
    "Event Staff can park out of bounds. Providing this is on the ground and not on top of buildings or other inappropriate places deemed unsuitable by TruckersMP Staff",
    "",
    "All other TruckersMP rules apply."
  ].join("\n");
}

function acceptanceMessageParts(booking, staffName) {
  const acceptanceEmbed = new EmbedBuilder()
    .setTitle("✅ Booking Accepted")
    .setColor(0x2ecc71)
    .setDescription(
      [
        `Your convoy control request has been **accepted**.`,
        "",
        `**VTC:** ${booking.vtcName}`,
        `**Date (UTC):** ${booking.eventDate}`,
        `**Meetup:** ${booking.meetupTime}`,
        `**Departure:** ${booking.departureTime}`,
        "",
        `Accepted by: **${staffName}**`,
        "Please keep all communication in this ticket."
      ].join("\n")
    );

  const rules = new EmbedBuilder()
    .setTitle("📌 Event Rules")
    .setColor(0x2ecc71)
    .setDescription(
      `**Event rules for participants**\n\`\`\`\n${participantRulesText()}\n\`\`\`\n\n` +
      `**Event Rules for Event Staff**\n\`\`\`\n${staffRulesText()}\n\`\`\``
    );

  const banner = new EmbedBuilder()
    .setTitle("🖼️ Event Supervised By")
    .setColor(0x111827)
    .setImage("https://i.postimg.cc/g2p5CNHt/Event-Supervised-By.png");

  return { acceptanceEmbed, rules, banner };
}

function declineEmbed(booking, staffName, reason) {
  return new EmbedBuilder()
    .setTitle("❌ Booking Declined")
    .setColor(0xe74c3c)
    .setDescription(
      [
        `Your convoy control request has been **declined**.`,
        "",
        `**VTC:** ${booking.vtcName}`,
        `**Date (UTC):** ${booking.eventDate}`,
        "",
        `Declined by: **${staffName}**`,
        "",
        `**Reason:**`,
        reason ? reason.slice(0, 900) : "No reason provided."
      ].join("\n")
    )
    .setFooter({ text: `Booking ID: ${booking.id}` })
    .setTimestamp(new Date());
}

module.exports = { bookingSummaryEmbed, acceptanceMessageParts, declineEmbed };
