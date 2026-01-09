function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

module.exports = {
  DISCORD_TOKEN: must("DISCORD_TOKEN"),
  DISCORD_CLIENT_ID: must("DISCORD_CLIENT_ID"),

  DISCORD_OAUTH_CLIENT_ID: must("DISCORD_OAUTH_CLIENT_ID"),
  DISCORD_OAUTH_CLIENT_SECRET: must("DISCORD_OAUTH_CLIENT_SECRET"),
  DISCORD_OAUTH_CALLBACK_URL: must("DISCORD_OAUTH_CALLBACK_URL"),

  SESSION_SECRET: must("SESSION_SECRET"),
  WEB_PORT: Number(process.env.WEB_PORT || 3000),
  BASE_URL: process.env.BASE_URL || "http://localhost:3000",

  TRUST_PROXY: String(process.env.TRUST_PROXY || "false") === "true",
  DEFAULT_GUILD_ID: process.env.DEFAULT_GUILD_ID || null
};
