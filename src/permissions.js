const { PermissionFlagsBits } = require("discord.js");
const config = require("./config");

/**
 * Normalize "role ids" input into an array.
 * Accepts:
 * - array of strings
 * - comma-separated string
 * - undefined/null -> []
 */
function normalizeRoleIds(roleIds) {
  if (!roleIds) return [];
  if (Array.isArray(roleIds)) return roleIds.filter(Boolean);
  if (typeof roleIds === "string") {
    return roleIds.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Add overwrites for a list of roles.
 */
function addRoleOverwrites(overwrites, roleIds, allowView = true) {
  const ids = normalizeRoleIds(roleIds);
  for (const rid of ids) {
    overwrites.push({
      id: rid,
      allow: allowView ? [PermissionFlagsBits.ViewChannel] : [],
      deny: allowView ? [] : [PermissionFlagsBits.ViewChannel]
    });
  }
  return overwrites;
}

/**
 * Base overwrites for ALL tickets:
 * - @everyone denied
 * - requester allowed
 * - bot allowed (optional; safe)
 */
function buildBaseOverwrites(guild, requesterId) {
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: requesterId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  // Allow the bot itself if present (safe)
  if (guild.members.me?.id) {
    overwrites.push({
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    });
  }

  return overwrites;
}

/**
 * Stage visibility:
 * You can drive this via config env vars OR db config (if you pass them in later).
 *
 * Supported config keys (optional):
 *  - STAGE_REQUESTED_ROLE_IDS
 *  - STAGE_REVIEW_ROLE_IDS
 *  - STAGE_ACCEPTED_ROLE_IDS
 *  - STAGE_DECLINED_ROLE_IDS
 *  - STAGE_CANCELLED_ROLE_IDS
 *  - STAGE_COMPLETED_ROLE_IDS
 *
 * If none are set, NO extra staff roles are added (requester still always sees).
 */
function applyStageVisibility(overwrites, status) {
  // Pull from config (safe even if undefined)
  const stageRoles = {
    REQUESTED: normalizeRoleIds(config.STAGE_REQUESTED_ROLE_IDS),
    REVIEW: normalizeRoleIds(config.STAGE_REVIEW_ROLE_IDS),
    ACCEPTED: normalizeRoleIds(config.STAGE_ACCEPTED_ROLE_IDS),
    DECLINED: normalizeRoleIds(config.STAGE_DECLINED_ROLE_IDS),
    CANCELLED: normalizeRoleIds(config.STAGE_CANCELLED_ROLE_IDS),
    COMPLETED: normalizeRoleIds(config.STAGE_COMPLETED_ROLE_IDS)
  };

  const rolesForStatus = stageRoles[status] || [];
  return addRoleOverwrites(overwrites, rolesForStatus, true);
}

module.exports = {
  buildBaseOverwrites,
  applyStageVisibility
};
