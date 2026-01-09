const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const { DISCORD_OAUTH_CLIENT_ID, DISCORD_OAUTH_CLIENT_SECRET, DISCORD_OAUTH_CALLBACK_URL, DEFAULT_GUILD_ID } = require("../config");
const { getBotClient } = require("../bot/client");
const { prisma } = require("../db/prisma");

function configurePassport() {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(new DiscordStrategy({
    clientID: DISCORD_OAUTH_CLIENT_ID,
    clientSecret: DISCORD_OAUTH_CLIENT_SECRET,
    callbackURL: DISCORD_OAUTH_CALLBACK_URL,
    scope: ["identify"]
  }, async (accessToken, refreshToken, profile, done) => {
    return done(null, {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar
    });
  }));
}

async function isStaff(userId, guildId) {
  const client = getBotClient();
  if (!client) return false;

  const config = await prisma.guildConfig.upsert({
    where: { id: guildId },
    update: {},
    create: { id: guildId }
  });

  if (!config.staffRoleId) return false;

  const guild = await client.guilds.fetch(guildId).catch(()=>null);
  if (!guild) return false;

  const member = await guild.members.fetch(userId).catch(()=>null);
  if (!member) return false;

  return member.roles.cache.has(config.staffRoleId);
}

module.exports = { configurePassport, isStaff };
