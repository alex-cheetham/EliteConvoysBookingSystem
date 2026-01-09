const router = require("express").Router();
const { prisma } = require("../../db/prisma");
const { requireStaff } = require("../middleware");
const { STATUS_META } = require("../../util/constants");

router.get("/dashboard", requireStaff(), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { guildId: req.guildId },
    orderBy: { createdAt: "desc" }
  });

  res.render("dashboard", {
    title: "Dashboard",
    bookings,
    STATUS_META
  });
});

module.exports = router;
