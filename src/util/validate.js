const { z } = require("zod");

const urlSchema = z.string().url();

const bookingSchema = z.object({
  vtcName: z.string().min(2).max(64),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meetupTime: z.string().regex(/^\d{2}:\d{2}$/),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/),
  serverName: z.string().min(2).max(64),
  startLocation: z.string().min(2).max(120),
  destination: z.string().min(2).max(120),
  requiredDlcs: z.string().min(2).max(200),
  tmpEventLink: urlSchema,
  notes: z.string().max(500).optional().or(z.literal(""))
});

function validateBooking(data) {
  return bookingSchema.parse(data);
}

module.exports = { validateBooking };
