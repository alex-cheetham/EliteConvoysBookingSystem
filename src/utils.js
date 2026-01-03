function pad2(n) {
  return String(n).padStart(2, "0");
}

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "event";
}

// Date helpers
function parseDateTimeToUTC(dateYYYYMMDD, timeHHMM, timezoneLabel) {
  // We will treat timezoneLabel as informational and assume the provided time is in that timezone.
  // For simplicity (and reliability without extra deps), we store as "naive" UTC by assuming user entered UTC.
  // If you want true timezone conversion, we can add luxon later.
  // For now: interpret as UTC.
  const iso = `${dateYYYYMMDD}T${timeHHMM}:00.000Z`;
  return new Date(iso);
}

function toISOString(d) {
  return new Date(d).toISOString();
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

module.exports = {
  pad2,
  slugify,
  parseDateTimeToUTC,
  toISOString,
  overlaps
};
