const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require("discord.js");

const discordTranscripts = require("discord-html-transcripts");

const config = require("./config");

const TICKET_EMOJI = "<:SwordLogo:1554981011052302347>";

async function closeTicket(interaction, ticketTitle) {
  const channel = interaction.channel;

  const ownerId = channel.topic?.replace("ticket-owner:", "");

  const ticketType = channel.name.startsWith("user_report-") ? "user_report" : channel.name.startsWith("general-") ? "general" : "appeal";
  const ticketConfig = config.tickets[ticketType];

  await channel.setParent(ticketConfig.closedCategoryId);

  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    ViewChannel: false
  });

  if (ownerId) {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: false,
      SendMessages: false
    }).catch(() => {});
  }

  const embed = new EmbedBuilder()
    .setColor(0x5C0000)
        .setDescription(
      "🇪🇸 El ticket ha sido cerrado. Puedes **crear la transcripción, reabrirlo o eliminarlo**.\n\n" +
      "🇺🇸 The ticket has been closed. You can **create the transcript, reopen it or delete it**."
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ticket_reopen")
      .setLabel("Reopen")
      .setEmoji("🔓")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("ticket_delete")
      .setLabel("Delete")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
}

async function createTranscript(interaction, ticketTitle) {
  const channel = interaction.channel;

  const transcriptChannel = await interaction.guild.channels.fetch(
    config.transcriptChannelId
  );

  if (!transcriptChannel) {
    return interaction.reply({
      content: `${TICKET_EMOJI} **No se encontró el canal de transcripciones / Transcript channel not found.**`,
      ephemeral: true
    });
  }

  const attachment = await discordTranscripts.createTranscript(channel, {
    limit: -1,
    filename: `${channel.name}-${ticketTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.html`,
    poweredBy: false
  });

  await transcriptChannel.send({
    content: `${TICKET_EMOJI} **Transcripción de ${channel.name} / Transcript of ${channel.name}**`,
    files: [attachment]
  });

  await interaction.reply({
    content: `${TICKET_EMOJI} **Transcripción enviada / Transcript sent.**`,
    ephemeral: true
  });
}

async function reopenTicket(interaction) {
  const channel = interaction.channel;
  const ownerId = channel.topic?.replace("ticket-owner:", "");

  const ticketType = channel.name.startsWith("user_report-") ? "user_report" : channel.name.startsWith("general-") ? "general" : "appeal";
  const ticketConfig = config.tickets[ticketType];

  await channel.setParent(ticketConfig.channelCategoryId);

  if (ownerId) {
    await channel.permissionOverwrites.edit(ownerId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    }).catch(() => {});
  }

  await interaction.reply({
    content: `${TICKET_EMOJI} **Ticket reabierto / Ticket reopened.**`
  });
}

async function deleteTicket(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x5C0000)
    .setDescription(
      `${TICKET_EMOJI} **El ticket se eliminará en unos segundos... / The ticket will be deleted in a few seconds...**`
    );

  await interaction.reply({
    embeds: [embed]
  });

  setTimeout(async () => {
    await interaction.channel.delete().catch(() => {});
  }, 5000);
}

module.exports = {
  closeTicket,
  createTranscript,
  reopenTicket,
  deleteTicket
};
