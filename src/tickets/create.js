const {
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const config = require("./config");

async function createTicket(interaction, ticketType) {
  const ticketConfig = config.tickets[ticketType];

  if (!ticketConfig) {
    throw new Error(`Tipo de ticket no configurado: ${ticketType}`);
  }

  const guild = interaction.guild;

  const existingTicket = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildText &&
      channel.topic === `ticket-owner:${interaction.user.id}`
  );

  if (existingTicket) {
    return {
      existing: true,
      channel: existingTicket
    };
  }

  const ticketNumber = String(
    guild.channels.cache.filter(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.name.startsWith(`${ticketType}-`)
    ).size + 1
  ).padStart(4, "0");

  const channel = await guild.channels.create({
    name: `${ticketType}-${ticketNumber}`,
    type: ChannelType.GuildText,
    parent: ticketConfig.channelCategoryId,
    topic: `ticket-owner:${interaction.user.id}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      },
      ...ticketConfig.staffRoleIds.map(roleId => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles
        ]
      }))
    ]
  });

  return {
    existing: false,
    channel
  };
}

module.exports = {
  createTicket
};
