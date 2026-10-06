const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { createTicket } = require("./create");
const {
  closeTicket,
  createTranscript,
  reopenTicket,
  deleteTicket
} = require("./close");

const TICKET_EMOJI = "<a:emoji_6:1556779947744436244>";

const pendingClosures = new Map();

async function handleTicketInteraction(interaction) {
  if (interaction.isModalSubmit()) {
    if (interaction.customId !== "ticket_close_modal") {
      return false;
    }

    const title = interaction.fields.getTextInputValue("ticket_title").trim();

    pendingClosures.set(interaction.channel.id, title);

    const embed = new EmbedBuilder()
      .setColor(0x5C0000)
      .setTitle("Close Ticket")
      .setDescription(
        `🇪🇸 **¿Seguro que quieres cerrar este ticket?**\n` +
        `Título: **${title}**\n\n` +
        `🇺🇸 **Are you sure you want to close this ticket?**\n` +
        `Title: **${title}**`
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close_confirm")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("ticket_close_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });

    return true;
  }

  if (!interaction.isButton()) return false;

  if (interaction.customId === "ticket_close") {
    const modal = new ModalBuilder()
      .setCustomId("ticket_close_modal")
      .setTitle("Close Ticket");

    const titleInput = new TextInputBuilder()
      .setCustomId("ticket_title")
      .setLabel("Ticket title")
      .setPlaceholder("Example: Giveaway claimed")
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(80)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput)
    );

    await interaction.showModal(modal);
    return true;
  }

  if (interaction.customId === "ticket_close_confirm") {
    const title = pendingClosures.get(interaction.channel.id);

    if (!title) {
      await interaction.reply({
        content: `${TICKET_EMOJI} **No closing request was found / No se encontró la solicitud de cierre.**`,
        ephemeral: true
      });
      return true;
    }

    pendingClosures.delete(interaction.channel.id);

    await closeTicket(interaction, title);
    return true;
  }

  if (interaction.customId === "ticket_close_cancel") {
    pendingClosures.delete(interaction.channel.id);

    await interaction.update({
      content: `${TICKET_EMOJI} **Ticket closure cancelled / Cierre del ticket cancelado.**`,
      embeds: [],
      components: []
    });

    return true;
  }

  if (interaction.customId === "ticket_transcript") {
    await createTranscript(interaction, interaction.channel.name);
    return true;
  }

  if (interaction.customId === "ticket_reopen") {
    await reopenTicket(interaction);
    return true;
  }

  if (interaction.customId === "ticket_delete") {
    await deleteTicket(interaction);
    return true;
  }

  if (interaction.customId !== "ticket_create_appeal") {
    return false;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await createTicket(interaction, "appeal");

    if (result.existing) {
      await interaction.editReply({
        content: `${TICKET_EMOJI} **Ya tienes un ticket abierto / You already have an open ticket:** ${result.channel}`
      });

      return true;
    }

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5C0000)
      .setTitle(`${TICKET_EMOJI} Welcome to Tempered Support`)
      .setDescription(
        "🇪🇸 **El Staff estará contigo en breve. Ten algo de paciencia mientras revisamos tu solicitud.**\n\n" +
        "🇺🇸 **The Staff will be with you shortly. Please be patient while we review your request.**"
      );

    const closeButton = new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Secondary);

    await result.channel.send({
      content: `${TICKET_EMOJI} ${interaction.user} **Te damos la bienvenida al Tempered Support! / Welcome to Tempered Support!**`,
      embeds: [welcomeEmbed],
      components: [
        new ActionRowBuilder().addComponents(closeButton)
      ]
    });

    await interaction.editReply({
      content: `${TICKET_EMOJI} **Tu Appeal ha sido creado / Your Appeal has been created:** ${result.channel}`
    });

    return true;
  } catch (error) {
    console.error("Error creando ticket:", error);

    await interaction.editReply({
      content: `${TICKET_EMOJI} **No se pudo crear el ticket / The ticket could not be created.**`
    });

    return true;
  }
}

module.exports = {
  handleTicketInteraction
};
