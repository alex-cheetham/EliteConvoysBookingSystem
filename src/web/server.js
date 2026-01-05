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

  // ✅ Fully styled status badge with unique emoji + colours for every status
  function statusBadge(status) {
    const map = {
      REQUESTED: { cls: "badge requested", icon: "📩" },
      REVIEW:    { cls: "badge review",    icon: "🕵️" },
      ACCEPTED:  { cls: "badge accepted",  icon: "✅" },
      DECLINED:  { cls: "badge declined",  icon: "❌" },
      CANCELLED: { cls: "badge cancelled", icon: "🛑" },
      COMPLETED: { cls: "badge completed", icon: "🏁" }
    };
    const item = map[status] || { cls: "badge", icon: "📌" };
    return `<span class="${item.cls}">${item.icon} ${status}</span>`;
  }

  // Used for button labels too
  function statusLabel(status) {
    const icons = {
      REQUESTED: "📩",
      REVIEW: "🕵️",
      ACCEPTED: "✅",
      DECLINED: "❌",
      CANCELLED: "🛑",
      COMPLETED: "🏁"
    };
    return `${icons[status] || "📌"} ${status}`;
  }

  app.get("/", async (req, res) => {
    res.send(layout("Elite Convoys Panel", `
      <div class="card">
        <h3>Elite Convoys Booking Management Panel</h3>
        <p class="muted">Manage convoy control bookings, update ticket status, and keep staff notes internal.</p>
        <div class="btnrow">
          <a class="btn btn-primary" href="/dashboard">Go to Dashboard</a>
        </div>
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
    if (!(await userHasAccess(req))) {
      return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "dashboard"));
    }

    const cfg = await ensureGuildConfig(config.GUILD_ID, config);

    await db.read();
    const rows = db.data.bookings
      .filter(b => b.guild_id === config.GUILD_ID)
      .sort((a, b) => new Date(a.meetup_utc) - new Date(b.meetup_utc));

    const body = `
      <div class="card">
        <h3>Config Overview</h3>
        <p class="muted">
          Default duration: <strong>${cfg.default_duration_minutes} mins</strong> ·
          Buffer: <strong>${cfg.buffer_minutes} mins</strong> ·
          Review: <strong>${cfg.review_enabled ? "ON" : "OFF"}</strong>
        </p>
        <div class="btnrow">
          <a class="btn" href="/config">Edit config</a>
          <a class="btn" href="/blackouts">Manage blackouts</a>
        </div>
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
              <td>${statusBadge(r.status)}</td>
              <td>${r.ticket_channel_id ? `<code>${r.ticket_channel_id}</code>` : "-"}</td>
              <td><a class="btn" href="/booking/${r.id}">Manage</a></td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
    res.send(layout("Dashboard", body, req.user, "dashboard"));
  });

  app.get("/booking/:id", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) {
      return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "dashboard"));
    }

    const id = Number(req.params.id);
    await db.read();
    const b = db.data.bookings.find(x => x.guild_id === config.GUILD_ID && x.id === id);
    if (!b) {
      return res.send(layout("Not Found", "<div class='card'><p>Booking not found.</p></div>", req.user, "dashboard"));
    }

    const statuses = ["REQUESTED","REVIEW","ACCEPTED","DECLINED","CANCELLED","COMPLETED"];

    const statusButtons = statuses.map(s => {
      const primary = (b.status === s) ? "btn-primary" : "";
      const cls = `btn status-btn status-${s.toLowerCase()} ${primary}`;
      return `<button class="${cls}" type="submit" name="status" value="${s}">${statusLabel(s)}</button>`;
    }).join("");

    const ticketInfo = b.ticket_channel_id
      ? `<p class="muted">Ticket Channel ID: <code>${b.ticket_channel_id}</code></p>`
      : `<p class="muted">Ticket Channel: <strong>Not created yet</strong></p>`;

    const realOpsChecked = b.real_ops_attending ? "checked" : "";

    const body = `
      <div class="card">
        <h3>Booking #${b.id} — ${b.vtc_name}</h3>
        <p class="muted">Current status: ${statusBadge(b.status)}</p>
        ${ticketInfo}
        <div class="btnrow">
          <a class="btn" href="/booking/${b.id}/request-info">Request Additional Information</a>
          <a class="btn" style="border-color:rgba(255,90,103,0.4);background:rgba(255,90,103,0.12);" href="/booking/${b.id}/delete">Delete Booking</a>
        </div>
      </div>

      <div class="card">
        <h3>Quick Status</h3>
        <p class="muted">Staff flow: REQUESTED → REVIEW → ACCEPTED/DECLINED</p>

        <form method="post" action="/booking/${b.id}">
          <div class="btnrow">${statusButtons}</div>

          <hr style="border:0;border-top:1px solid rgba(255,255,255,0.08);margin:14px 0;" />

          <h3>Event Details</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label>Event Date</label>
              <input name="event_date" value="${b.event_date}" required />
            </div>
            <div>
              <label>Server</label>
              <input name="server" value="${b.server}" required />
            </div>
            <div>
              <label>Meetup Time</label>
              <input name="meetup_time" value="${b.meetup_time}" required />
            </div>
            <div>
              <label>Departure Time</label>
              <input name="departure_time" value="${b.departure_time}" required />
            </div>
            <div>
              <label>Start Location</label>
              <input name="start_location" value="${b.start_location}" required />
            </div>
            <div>
              <label>Destination</label>
              <input name="destination" value="${b.destination}" required />
            </div>
            <div>
              <label>DLC's Required</label>
              <input name="dlcs_required" value="${b.dlcs_required}" required />
            </div>
            <div>
              <label>TMP Event Link</label>
              <input name="tmp_event_link" value="${b.tmp_event_link}" required />
            </div>
          </div>

          <label style="display:flex;gap:10px;align-items:center;margin-top:10px;">
            <input type="checkbox" name="real_ops_attending" value="1" style="width:auto;" ${realOpsChecked} />
            <span>Real Ops Attending (adds a warning to the Discord ticket embed)</span>
          </label>

          <label>Other Notes (Client-visible)</label>
          <textarea name="other_notes">${b.other_notes || ""}</textarea>

          <label>Staff Comment (Internal-only)</label>
          <textarea name="staff_comment" placeholder="Visible to staff only. Not posted in the ticket.">${b.staff_comment || ""}</textarea>

          <div class="btnrow">
            <button class="btn btn-primary" type="submit">Save Changes</button>
            <a class="btn" href="/dashboard">Back</a>
          </div>
        </form>
      </div>
    `;
    res.send(layout(`Booking #${b.id}`, body, req.user, "dashboard"));
  });

  app.get("/booking/:id/request-info", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) {
      return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "dashboard"));
    }

    const id = Number(req.params.id);
    await db.read();
    const b = db.data.bookings.find(x => x.guild_id === config.GUILD_ID && x.id === id);
    if (!b) {
      return res.send(layout("Not Found", "<div class='card'><p>Booking not found.</p></div>", req.user, "dashboard"));
    }

    const body = `
      <div class="card">
        <h3>Request Additional Information — Booking #${b.id}</h3>
        <p class="muted">This will send a message in the Discord ticket channel and ping the requester.</p>

        <form method="post" action="/booking/${b.id}/request-info">
          <label>What information do you need?</label>
          <textarea name="message" required placeholder="Example: Please confirm if any DLCs are required, and provide the exact meetup location coordinates."></textarea>

          <div class="btnrow">
            <button class="btn btn-primary" type="submit">Send Request</button>
            <a class="btn" href="/booking/${b.id}">Cancel</a>
          </div>
        </form>
      </div>
    `;
    res.send(layout("Request Additional Info", body, req.user, "dashboard"));
  });

  app.post("/booking/:id/request-info", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) {
      return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "dashboard"));
    }

    const id = Number(req.params.id);
    const msg = (req.body.message || "").trim();
    if (!msg) return res.redirect(`/booking/${id}/request-info`);

    try {
      discordClient.emit("bookingRequestInfo", { bookingId: id, message: msg });
    } catch (e) {
      console.error("Failed to emit bookingRequestInfo:", e);
    }

    res.redirect(`/booking/${id}`);
  });

  app.post("/booking/:id", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) {
      return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "dashboard"));
    }

    const id = Number(req.params.id);
    const now = new Date().toISOString();

    await db.read();
    const b = db.data.bookings.find(x => x.guild_id === config.GUILD_ID && x.id === id);
    if (!b) {
      return res.send(layout("Not Found", "<div class='card'><p>Booking not found.</p></div>", req.user, "dashboard"));
    }

    // ✅ capture previous status so bot can detect transitions (e.g. REVIEW -> ACCEPTED)
    const prevStatus = b.status;

    b.status = req.body.status || b.status;
    b.event_date = req.body.event_date;
    b.meetup_time = req.body.meetup_time;
    b.departure_time = req.body.departure_time;
    b.server = req.body.server;
    b.start_location = req.body.start_location;
    b.destination = req.body.destination;
    b.dlcs_required = req.body.dlcs_required;
    b.tmp_event_link = req.body.tmp_event_link;

    b.other_notes = req.body.other_notes || null;
    b.staff_comment = req.body.staff_comment || null;
    b.real_ops_attending = req.body.real_ops_attending ? true : false;

    b.updated_at = now;

    await db.write();

    // ✅ include newStatus + staff username (from OAuth session) so the bot can post acceptance pack
    try {
      discordClient.emit("bookingUpdated", {
        bookingId: id,
        prevStatus,
        newStatus: b.status,
        staffUsername: req.user?.username || "staff"
      });
    } catch (e) {
      console.error("Failed to emit bookingUpdated:", e);
    }

    res.redirect(`/booking/${id}`);
  });

  app.get("/booking/:id/delete", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "dashboard"));

    const id = Number(req.params.id);
    await db.read();
    const b = db.data.bookings.find(x => x.guild_id === config.GUILD_ID && x.id === id);
    if (!b) return res.send(layout("Not Found", "<div class='card'><p>Booking not found.</p></div>", req.user, "dashboard"));

    const body = `
      <div class="card">
        <h3>Delete Booking #${b.id}</h3>
        <p class="muted">This permanently deletes the booking AND deletes the Discord ticket channel.</p>
        <p><strong>VTC:</strong> ${b.vtc_name}</p>
        <p><strong>Date:</strong> ${b.event_date} · <strong>Meetup:</strong> ${b.meetup_time} ${b.timezone}</p>

        <form method="post" action="/booking/${b.id}/delete">
          <div class="btnrow">
            <button class="btn" style="border-color:rgba(255,90,103,0.5);background:rgba(255,90,103,0.14);" type="submit">
              Yes, delete permanently
            </button>
            <a class="btn" href="/booking/${b.id}">Cancel</a>
          </div>
        </form>
      </div>
    `;
    res.send(layout(`Delete Booking #${b.id}`, body, req.user, "dashboard"));
  });

  app.post("/booking/:id/delete", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "dashboard"));

    const id = Number(req.params.id);

    await db.read();
    const idx = db.data.bookings.findIndex(x => x.guild_id === config.GUILD_ID && x.id === id);
    if (idx === -1) return res.send(layout("Not Found", "<div class='card'><p>Booking not found.</p></div>", req.user, "dashboard"));

    const booking = db.data.bookings[idx];
    const ticketChannelId = booking.ticket_channel_id || null;

    db.data.bookings.splice(idx, 1);
    await db.write();

    try {
      discordClient.emit("bookingDeleted", { bookingId: id, ticketChannelId });
    } catch (e) {
      console.error("Failed to emit bookingDeleted:", e);
    }

    res.redirect("/dashboard");
  });

  app.get("/config", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "config"));

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

          <div class="btnrow">
            <button class="btn btn-primary" type="submit">Save</button>
            <a class="btn" href="/dashboard">Back</a>
          </div>
        </form>
      </div>
    `;
    res.send(layout("Config", body, req.user, "config"));
  });

  app.post("/config", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "config"));

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
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "blackouts"));

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

          <div class="btnrow">
            <button class="btn btn-primary" type="submit">Add</button>
            <a class="btn" href="/dashboard">Back</a>
          </div>
        </form>
      </div>

      <div class="card">
        <h3>Blackouts</h3>
        <table>
          <tr><th>ID</th><th>Date</th><th>Start</th><th>End</th><th>Reason</th></tr>
          ${rows.map(r => `<tr><td>${r.id}</td><td>${r.date}</td><td>${r.start_time}</td><td>${r.end_time}</td><td>${r.reason||""}</td></tr>`).join("")}
        </table>
      </div>
    `;
    res.send(layout("Blackouts", body, req.user, "blackouts"));
  });

  app.post("/blackouts", requireAuth, async (req, res) => {
    if (!(await userHasAccess(req))) return res.status(403).send(layout("Forbidden", "<div class='card'><p>Access denied.</p></div>", req.user, "blackouts"));

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
