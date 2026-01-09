const { PermissionsBitField } = require("discord.js");

function baseTicketOverwrites(guild, config, requesterId) {
  const staffRoleId = config.staffRoleId;
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    // requester
    { id: requesterId, allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks
    ]},
  ];

  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels
      ]
    });
  }

  return overwrites;
}

function applyStatusPermAdjustments(overwrites, status) {
  // Keep requester access unless DECLINED/CANCELLED/COMPLETED
  const closed = ["DECLINED","CANCELLED","COMPLETED"].includes(status);
  const requester = overwrites.find(o => o.allow && o.id);
  if (!requester) return overwrites;

  if (closed) {
    requester.allow = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory];
    requester.deny = [PermissionsBitField.Flags.SendMessages];
  } else {
    requester.allow = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks
    ];
    delete requester.deny;
  }
  return overwrites;
}

module.exports = { baseTicketOverwrites, applyStatusPermAdjustments };
