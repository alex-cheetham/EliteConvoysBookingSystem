-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffRoleId" TEXT,
    "ticketCategoryPrefix" TEXT NOT NULL DEFAULT 'Convoys',
    "defaultEventDurationM" INTEGER NOT NULL DEFAULT 90,
    "bufferTimeM" INTEGER NOT NULL DEFAULT 15,
    "reviewMode" BOOLEAN NOT NULL DEFAULT false,
    "realOpsWarning" BOOLEAN NOT NULL DEFAULT false,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderMinutesCsv" TEXT NOT NULL DEFAULT '1440,120,30',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterTag" TEXT NOT NULL,
    "vtcName" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "meetupTime" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "startLocation" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "requiredDlcs" TEXT NOT NULL,
    "tmpEventLink" TEXT NOT NULL,
    "notes" TEXT,
    "internalNotes" TEXT,
    "realOpsAttending" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "statusHistory" TEXT NOT NULL DEFAULT '[]',
    "ticketChannelId" TEXT,
    "ticketCategoryId" TEXT,
    "acceptanceSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Blackout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "startUtc" DATETIME NOT NULL,
    "endUtc" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Booking_guildId_status_idx" ON "Booking"("guildId", "status");

-- CreateIndex
CREATE INDEX "Blackout_guildId_startUtc_endUtc_idx" ON "Blackout"("guildId", "startUtc", "endUtc");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_bookingId_minutes_key" ON "ReminderLog"("bookingId", "minutes");
