const { ROLE_DISPATCH_IDS, ROLE_CCSTAFF_IDS, ROLE_ONDUTY_IDS } = require("./config");

function buildBaseOverwrites(guild, requesterId) {
  const overwrites = [];

  // deny everyone
  overwrites.push({
    id: guild.roles.everyone.id,
    deny: ["ViewChannel"]
  });

  // requester always
  overwrites.push({
    id: requesterId,
    allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles", "EmbedLinks"]
  });

  return overwrites;
}

function addRoleOverwrites(overwrites, roleIds) {
  for (const roleId of roleIds) {
    overwrites.push({
      id: roleId,
      allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
    });
  }
}

function applyStageVisibility(overwrites, status) {
  // Always: requester already included.
  // Requested/Review: Dispatch only
  // Accepted: Dispatch + CC Staff
  // Pre-event: optional (not implemented in v1; can be added by scheduled time)
  // Completed/Declined/Cancelled: Dispatch only (CC staff removed by simply not adding)
  if (status === "REQUESTED" || status === "REVIEW") {
    addRoleOverwrites(overwrites, ROLE_DISPATCH_IDS);
  } else if (status === "ACCEPTED") {
    addRoleOverwrites(overwrites, ROLE_DISPATCH_IDS);
    addRoleOverwrites(overwrites, ROLE_CCSTAFF_IDS);
  } else if (status === "COMPLETED" || status === "DECLINED" || status === "CANCELLED") {
    addRoleOverwrites(overwrites, ROLE_DISPATCH_IDS);
  } else {
    addRoleOverwrites(overwrites, ROLE_DISPATCH_IDS);
  }

  // Optional OnDuty role can be granted later on event day by scheduler
  // We don't add it by default to avoid clutter.

  return overwrites;
}

module.exports = {
  buildBaseOverwrites,
  applyStageVisibility,
  addRoleOverwrites
};
