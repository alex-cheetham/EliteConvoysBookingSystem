const express = require("express");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const { WEB_PORT, SESSION_SECRET, TRUST_PROXY } = require("../config");
const { configurePassport } = require("./auth");
const { injectLocals } = require("./middleware");

const dashboardRoutes = require("./routes/dashboard");
const bookingRoutes = require("./routes/booking");
const blackoutRoutes = require("./routes/blackouts");
const configRoutes = require("./routes/config");

async function startWeb() {
  const app = express();

  if (TRUST_PROXY) app.set("trust proxy", 1);

  app.use(helmet({
  contentSecurityPolicy: false
}));
  app.use(morgan("dev"));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use("/public", express.static(path.join(process.cwd(), "public")));



  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false }
  }));

  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  app.set("view engine", "ejs");
  app.set("views", path.join(process.cwd(), "src", "web", "views"));

  app.use(injectLocals);

  app.get("/", (req, res) => {
    if (!req.user) return res.redirect("/login");
    return res.redirect("/dashboard");
  });

  app.get("/login", (req, res) => res.render("login", { title: "Login" }));

  app.get("/auth/discord", passport.authenticate("discord"));
  app.get("/auth/discord/callback",
    passport.authenticate("discord", { failureRedirect: "/login" }),
    (req, res) => res.redirect("/dashboard")
  );

  app.post("/logout", (req, res) => {
    req.logout(() => res.redirect("/login"));
  });

  app.use(dashboardRoutes);
  app.use(bookingRoutes);
  app.use(blackoutRoutes);
  app.use(configRoutes);

  app.listen(WEB_PORT, () => console.log(`Web running on :${WEB_PORT}`));
}

module.exports = { startWeb };
