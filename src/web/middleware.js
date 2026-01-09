const { DEFAULT_GUILD_ID } = require("../config");
const { isStaff } = require("./auth");

function injectLocals(req, res, next) {
  res.locals.user = req.user || null;
  res.locals.path = req.path;
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect("/login");
  next();
}

function requireStaff() {
  return async (req, res, next) => {
    if (!req.user) return res.redirect("/login");
    const guildId = DEFAULT_GUILD_ID;
    if (!guildId) return res.status(500).send("DEFAULT_GUILD_ID not set in .env");

    const ok = await isStaff(req.user.id, guildId);
    if (!ok) return res.status(403).send("Forbidden: staff only.");
    req.guildId = guildId;
    next();
  };
}

module.exports = { injectLocals, requireLogin, requireStaff };
