const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const helmet = require("helmet");

const { layout } = require("./views");
const { db, ensureGuildConfig } = require("../db");
const config = require("../config");

function startWebPanel(discordClient) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  passport.use(new DiscordStrategy({
    clientID: config.OAUTH_CLIENT_ID,
    clientSecret: config.OAUTH_CLIENT_SECRET,
    callbackURL: config.OAUTH_CALLBACK_URL,
    scope: ["identify"]
  }, (accessToken, refreshToken, profile, done) => done(null, profile)));

  async function userHasAccess(req) {
    if (!req.user) return false;
    const guild = await discordClient.guilds.fetch(config.GUILD_ID);
    const member = await guild.members.fetch(req.user.id).catch(() => null);
    if (!member) return false;
    return config.WEB_ALLOWED_ROLE_IDS.some(rid => member.roles.cache.has(rid));
  }

  function requireAuth(req, res, next) {
    if (!req.user) return res.redirect("/login");
    next();
  }

  app.get("/", async (req, res) => {
    res.send(layout("Elite Convoys Panel", `
      <div class="card">
        <p>Elite Convoys Booking Management Panel</p>
        <p><a href="/dashboard">Go to Dashboard</a></p>
      </div>
    `, req.user));
  });

  app.get("/login", passport.authenticate("discord"));
  app.get("/auth/discord/callback",
    passport.authenticate("discord", { failureRedirect: "/" }),
    (req, res) => res.redirect("/dashboard")
  );

  app.get("/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
  });

  app.get("/dashboard", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<p>Access denied.</p>", req.user));

    const cfg = await ensureGuildConfig(config.GUILD_ID, config);

    await db.read();
    const rows = db.data.bookings
      .filter(b => b.guild_id === config.GUILD_ID)
      .sort((a, b) => new Date(a.meetup_utc) - new Date(b.meetup_utc));

    const body = `
      <div class="card">
        <h3>Config</h3>
        <p>Default duration: <strong>${cfg.default_duration_minutes} mins</strong> | Buffer: <strong>${cfg.buffer_minutes} mins</strong> | Review: <strong>${cfg.review_enabled ? "ON" : "OFF"}</strong></p>
        <p><a href="/config">Edit config</a> | <a href="/blackouts">Manage blackouts</a></p>
      </div>

      <div class="card">
        <h3>Bookings</h3>
        <table>
          <tr>
            <th>ID</th><th>VTC</th><th>Date</th><th>Meetup</th><th>Status</th><th>Ticket</th><th>Actions</th>
          </tr>
          ${rows.map(r => `
            <tr>
              <td>${r.id}</td>
              <td>${r.vtc_name}</td>
              <td>${r.event_date}</td>
              <td>${r.meetup_time} ${r.timezone}</td>
              <td>${r.status}</td>
              <td>${r.ticket_channel_id ? `<code>${r.ticket_channel_id}</code>` : "-"}</td>
              <td><a href="/booking/${r.id}">Manage</a></td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
    res.send(layout("Dashboard", body, req.user));
  });

  app.get("/booking/:id", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<p>Access denied.</p>", req.user));

    const id = Number(req.params.id);
    await db.read();
    const b = db.data.bookings.find(x => x.guild_id === config.GUILD_ID && x.id === id);
    if (!b) return res.send(layout("Not Found", "<p>Booking not found.</p>", req.user));

    const body = `
      <div class="card">
        <h3>Booking #${b.id} — ${b.vtc_name}</h3>
        <form method="post" action="/booking/${b.id}">
          <label>Status</label>
          <select name="status">
            ${["REQUESTED","REVIEW","ACCEPTED","DECLINED","CANCELLED","COMPLETED"].map(s => `<option value="${s}" ${b.status===s?"selected":""}>${s}</option>`).join("")}
          </select>

          <label>Event Date</label>
          <input name="event_date" value="${b.event_date}" required />

          <label>Meetup Time</label>
          <input name="meetup_time" value="${b.meetup_time}" required />

          <label>Departure Time</label>
          <input name="departure_time" value="${b.departure_time}" required />

          <label>Server</label>
          <input name="server" value="${b.server}" required />

          <label>Start Location</label>
          <input name="start_location" value="${b.start_location}" required />

          <label>Destination</label>
          <input name="destination" value="${b.destination}" required />

          <label>DLC's Required</label>
          <input name="dlcs_required" value="${b.dlcs_required}" required />

          <label>TMP Event Link</label>
          <input name="tmp_event_link" value="${b.tmp_event_link}" required />

          <label>Other Notes</label>
          <textarea name="other_notes">${b.other_notes || ""}</textarea>

          <button type="submit">Save Changes</button>
        </form>
        <p style="margin-top:10px;"><a href="/dashboard">← Back</a></p>
      </div>
    `;
    res.send(layout(`Booking #${b.id}`, body, req.user));
  });

  app.post("/booking/:id", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<p>Access denied.</p>", req.user));

    const id = Number(req.params.id);
    const now = new Date().toISOString();

    await db.read();
    const b = db.data.bookings.find(x => x.guild_id === config.GUILD_ID && x.id === id);
    if (!b) return res.send(layout("Not Found", "<p>Booking not found.</p>", req.user));

    b.status = req.body.status;
    b.event_date = req.body.event_date;
    b.meetup_time = req.body.meetup_time;
    b.departure_time = req.body.departure_time;
    b.server = req.body.server;
    b.start_location = req.body.start_location;
    b.destination = req.body.destination;
    b.dlcs_required = req.body.dlcs_required;
    b.tmp_event_link = req.body.tmp_event_link;
    b.other_notes = req.body.other_notes || null;
    b.updated_at = now;

    await db.write();

    // Tell bot to rename/move/update perms + update the pinned summary embed
    try {
      discordClient.emit("bookingUpdated", { bookingId: id });
    } catch (e) {
      console.error("Failed to emit bookingUpdated:", e);
    }

    res.redirect(`/booking/${id}`);
  });

  app.get("/config", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<p>Access denied.</p>", req.user));

    const cfg = await ensureGuildConfig(config.GUILD_ID, config);

    const body = `
      <div class="card">
        <h3>Config</h3>
        <form method="post" action="/config">
          <label>Default Duration (minutes)</label>
          <input name="default_duration_minutes" value="${cfg.default_duration_minutes}" required />

          <label>Buffer (minutes)</label>
          <input name="buffer_minutes" value="${cfg.buffer_minutes}" required />

          <label>Review Enabled (0 or 1)</label>
          <input name="review_enabled" value="${cfg.review_enabled}" required />

          <label>Category Prefix</label>
          <input name="category_prefix" value="${cfg.category_prefix}" required />

          <button type="submit">Save</button>
        </form>
        <p style="margin-top:10px;"><a href="/dashboard">← Back</a></p>
      </div>
    `;
    res.send(layout("Config", body, req.user));
  });

  app.post("/config", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<p>Access denied.</p>", req.user));

    // ✅ Preserve any existing config keys (panel_message_id, future settings, etc.)
    const existing = await ensureGuildConfig(config.GUILD_ID, config);

    await db.read();
    db.data.config ||= {};
    db.data.config[config.GUILD_ID] = {
      ...existing,
      guild_id: config.GUILD_ID,
      default_duration_minutes: Number(req.body.default_duration_minutes),
      buffer_minutes: Number(req.body.buffer_minutes),
      review_enabled: Number(req.body.review_enabled),
      category_prefix: req.body.category_prefix
    };
    await db.write();

    res.redirect("/dashboard");
  });

  app.get("/blackouts", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<p>Access denied.</p>", req.user));

    await db.read();
    const rows = db.data.blackouts
      .filter(x => x.guild_id === config.GUILD_ID)
      .sort((a, b) => a.date.localeCompare(b.date));

    const body = `
      <div class="card">
        <h3>Add Blackout</h3>
        <form method="post" action="/blackouts">
          <label>Date (YYYY-MM-DD)</label>
          <input name="date" required />
          <label>Start Time (HH:mm)</label>
          <input name="start_time" required />
          <label>End Time (HH:mm)</label>
          <input name="end_time" required />
          <label>Reason</label>
          <input name="reason" />
          <button type="submit">Add</button>
        </form>
      </div>

      <div class="card">
        <h3>Blackouts</h3>
        <table>
          <tr><th>ID</th><th>Date</th><th>Start</th><th>End</th><th>Reason</th></tr>
          ${rows.map(r => `<tr><td>${r.id}</td><td>${r.date}</td><td>${r.start_time}</td><td>${r.end_time}</td><td>${r.reason||""}</td></tr>`).join("")}
        </table>
        <p style="margin-top:10px;"><a href="/dashboard">← Back</a></p>
      </div>
    `;
    res.send(layout("Blackouts", body, req.user));
  });

  app.post("/blackouts", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<p>Access denied.</p>", req.user));

    await db.read();
    const newId = (db.data.blackouts.at(-1)?.id || 0) + 1;

    db.data.blackouts.push({
      id: newId,
      guild_id: config.GUILD_ID,
      date: req.body.date,
      start_time: req.body.start_time,
      end_time: req.body.end_time,
      reason: req.body.reason || null,
      created_at: new Date().toISOString()
    });

    await db.write();
    res.redirect("/blackouts");
  });

  app.listen(config.WEB_PORT, () => {
    console.log(`Web panel running on port ${config.WEB_PORT}`);
  });
}

module.exports = { startWebPanel };
