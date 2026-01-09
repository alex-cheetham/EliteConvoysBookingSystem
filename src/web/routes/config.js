const router = require("express").Router();
const { prisma } = require("../../db/prisma");
const { requireStaff } = require("../middleware");

router.get("/config", requireStaff(), async (req, res) => {
  const config = await prisma.guildConfig.upsert({
    where: { id: req.guildId },
    update: {},
    create: { id: req.guildId }
  });

  res.render("config", { title: "Configuration", config });
});

router.post("/config/save", requireStaff(), async (req, res) => {
  const data = {
    staffRoleId: req.body.staffRoleId || null,
    ticketCategoryPrefix: req.body.ticketCategoryPrefix || "Convoys",
    defaultEventDurationM: Number(req.body.defaultEventDurationM || 90),
    bufferTimeM: Number(req.body.bufferTimeM || 15),
    reviewMode: String(req.body.reviewMode) === "on",
    realOpsWarning: String(req.body.realOpsWarning) === "on",
    remindersEnabled: String(req.body.remindersEnabled) === "on",
    reminderMinutesCsv: (req.body.reminderMinutesCsv || "1440,120,30").replace(/[^0-9, ]/g, "")
  };

  await prisma.guildConfig.update({
    where: { id: req.guildId },
    data
  });

  res.redirect("/config");
});

module.exports = router;
