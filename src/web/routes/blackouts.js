const router = require("express").Router();
const { prisma } = require("../../db/prisma");
const { requireStaff } = require("../middleware");

router.get("/blackouts", requireStaff(), async (req, res) => {
  const closures = await prisma.blackout.findMany({
    where: { guildId: req.guildId },
    orderBy: { startUtc: "asc" }
  });

  // Render the same template file for now (we'll rename the view next)
  res.render("blackouts", { title: "Closures", blackouts: closures });
});

router.post("/blackouts/create", requireStaff(), async (req, res) => {
  const start = new Date(req.body.startUtc);
  const end = new Date(req.body.endUtc);

  if (!(start instanceof Date) || isNaN(start) || !(end instanceof Date) || isNaN(end) || end <= start) {
    return res.status(400).send("Invalid closure range.");
  }

  const reason = String(req.body.reason || "").trim();
  if (!reason) {
    return res.status(400).send("A closure reason is required.");
  }

  await prisma.blackout.create({
    data: {
      guildId: req.guildId,
      startUtc: start,
      endUtc: end,
      reason: reason.slice(0, 250) // keep it tidy; enough for auto-decline reason
    }
  });

  res.redirect("/blackouts");
});

router.post("/blackouts/:id/delete", requireStaff(), async (req, res) => {
  const b = await prisma.blackout.findUnique({ where: { id: req.params.id } });
  if (!b || b.guildId !== req.guildId) return res.status(404).send("Not found");

  await prisma.blackout.delete({ where: { id: b.id } });
  res.redirect("/blackouts");
});

module.exports = router;
