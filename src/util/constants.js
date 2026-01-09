const STATUS_META = {
  REQUESTED: { emoji: "📩", color: 0x3498db, label: "REQUESTED" },
  REVIEW:    { emoji: "🕵️", color: 0xf1c40f, label: "REVIEW" },
  ACCEPTED:  { emoji: "✅", color: 0x2ecc71, label: "ACCEPTED" },
  DECLINED:  { emoji: "❌", color: 0xe74c3c, label: "DECLINED" },
  CANCELLED: { emoji: "🛑", color: 0x95a5a6, label: "CANCELLED" },
  COMPLETED: { emoji: "🏁", color: 0x9b59b6, label: "COMPLETED" }
};

module.exports = { STATUS_META };
