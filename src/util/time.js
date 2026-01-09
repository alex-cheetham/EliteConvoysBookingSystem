function pad(n){ return String(n).padStart(2,"0"); }

function utcDateTimeFromParts(dateYmd, timeHm) {
  // dateYmd: YYYY-MM-DD, timeHm: HH:mm
  const [y,m,d] = dateYmd.split("-").map(Number);
  const [hh,mm] = timeHm.split(":").map(Number);
  return new Date(Date.UTC(y, m-1, d, hh, mm, 0));
}

function toYmdUTC(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}

function toHmUTC(d) {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes*60*1000);
}

module.exports = { utcDateTimeFromParts, toYmdUTC, toHmUTC, addMinutes };
