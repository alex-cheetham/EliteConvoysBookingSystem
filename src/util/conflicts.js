const { utcDateTimeFromParts, addMinutes } = require("./time");
const { prisma } = require("../db/prisma");

function windowForBooking(b, durationM, bufferM) {
  const start = utcDateTimeFromParts(b.eventDate, b.meetupTime);
  const endBase = addMinutes(start, durationM);
  return {
    start: addMinutes(start, -bufferM),
    end: addMinutes(endBase, bufferM)
  };
}

async function findConflicts(guildId, proposed, durationM, bufferM) {
  const pWin = windowForBooking(proposed, durationM, bufferM);

  const existing = await prisma.booking.findMany({
    where: {
      guildId,
      status: { in: ["REQUESTED", "REVIEW", "ACCEPTED"] }
    }
  });

  const overlaps = existing.filter((b) => {
    const w = windowForBooking(b, durationM, bufferM);
    return pWin.start < w.end && pWin.end > w.start;
  });

  // DB model is still "Blackout", but treat them as "Closures" in behavior/UI.
  const closures = await prisma.blackout.findMany({ where: { guildId } });
  const closureHits = closures.filter((x) => pWin.start < x.endUtc && pWin.end > x.startUtc);

  return { overlaps, closureHits, pWin };
}

/**
 * Returns:
 * - auto: "REQUESTED" | "REVIEW" | "DECLINED"
 * - reason: string (human-friendly, used for auto decline reasons)
 * - reasonSource: "CLOSURE" | "SYSTEM"
 */
function decideOutcome({ overlaps, closureHits }, reviewMode) {
  // Closures always hard-decline
  if (closureHits.length > 0) {
    // Prefer the first closure reason that exists
    const withReason = closureHits.find((c) => (c.reason || "").trim().length > 0);
    const reason = withReason ? String(withReason.reason).trim() : "Closure conflict";
    return { auto: "DECLINED", reason, reasonSource: "CLOSURE" };
  }

  // Booking overlaps may review or decline
  if (overlaps.length > 0) {
    return {
      auto: reviewMode ? "REVIEW" : "DECLINED",
      reason: "Booking overlap",
      reasonSource: "SYSTEM"
    };
  }

  return {
    auto: reviewMode ? "REVIEW" : "REQUESTED",
    reason: reviewMode ? "Review mode enabled" : "No conflicts",
    reasonSource: "SYSTEM"
  };
}

module.exports = { findConflicts, decideOutcome };
