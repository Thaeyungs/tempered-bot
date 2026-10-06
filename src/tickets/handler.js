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

const TICKET_EMOJI = "<:SwordLogo:1554981011052302347>";
const pendingClosures = new Map();

async function handleTicketInteraction(interaction) {

  const staffRoleId = "1556745392274804899";
  const staffActions = [
    "ticket_close",
    "ticket_close_confirm",
    "ticket_close_cancel",
    "ticket_transcript",
    "ticket_reopen",
    "ticket_delete",
    "ticket_close_modal"
  ];

  if (staffActions.includes(interaction.customId)) {
    if (!interaction.member.roles.cache.has(staffRoleId)) {
      await interaction.reply({
        content: `${TICKET_EMOJI} **Solo el Staff puede realizar esta acción / Only Staff can perform this action.**`,
        ephemeral: true
      });
      return true;
    }
  }

  if (interaction.isModalSubmit()) {

    if (interaction.customId === "ticket_close_modal") {
      const title = interaction.fields.getTextInputValue("ticket_title").trim();

      pendingClosures.set(interaction.channel.id, title);

      const embed = new EmbedBuilder()
        .setColor(0x5C0000)
        .setDescription(
          `🇪🇸 **¿Seguro que quieres cerrar este ticket?**\n` +
          `Título: ${title}\n\n` +
          `🇺🇸 **Are you sure you want to close this ticket?**\n` +
          `Title: ${title}`
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

    if (interaction.customId === "ticket_appeal_modal" || interaction.customId === "ticket_general_modal") {
      const answer = interaction.fields
        .getTextInputValue("appeal_reason")
        .trim();

      try {
        await interaction.deferReply({ ephemeral: true });
        const result = await createTicket(interaction, interaction.customId === "ticket_general_modal" ? "general" : "appeal");

        if (result.existing) {
          await interaction.reply({
            content: `${TICKET_EMOJI} **Ya tienes un ticket abierto / You already have an open ticket:** ${result.channel}`,
            ephemeral: true
          });

          return true;
        }

        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x5C0000)
          .setDescription(
            `🇪🇸 **El Staff estará contigo en breve. Ten paciencia mientras revisamos tu solicitud.**\n\n` +
            `🇺🇸 **The Staff will be with you shortly. Please be patient while we review your request.**`
          );

        const questionEmbed = new EmbedBuilder()
          .setColor(0x5C0000)
          .setTitle("¿Por qué quieres abrir ticket? / Why do you want to open a ticket?")
          .setDescription(answer);

        const closeButton = new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Secondary);

        await result.channel.send({
          content: `${TICKET_EMOJI} ${interaction.user} **Te damos la bienvenida al Tempered Support! / Welcome to Tempered Support!**`,
          embeds: [welcomeEmbed]
        });

        await result.channel.send({
          embeds: [questionEmbed],
          components: [
            new ActionRowBuilder().addComponents(closeButton)
          ]
        });

        await interaction.editReply({
          content: `${TICKET_EMOJI} **${interaction.customId === "ticket_general_modal" ? "Tu ticket de Soporte General ha sido creado / Your General Support ticket has been created" : "Tu Appeal ha sido creado / Your Appeal has been created"}:** ${result.channel}`
        });

        return true;

      } catch (error) {
        console.error("Error creando ticket:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `${TICKET_EMOJI} **No se pudo crear el ticket / The ticket could not be created.**`,
            ephemeral: true
          });
        }

        return true;
      }
    }

    return false;
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

    await interaction.message.delete();
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

  if (interaction.customId === "ticket_create_appeal" || interaction.customId === "ticket_create_general") {
    const isGeneral = interaction.customId === "ticket_create_general";
    const modal = new ModalBuilder()
      .setCustomId(isGeneral ? "ticket_general_modal" : "ticket_appeal_modal")
      .setTitle(isGeneral ? "General Support / Soporte General" : "Appeal / Desban");

    const reasonInput = new TextInputBuilder()
      .setCustomId("appeal_reason")
      .setLabel("¿Por qué quieres abrir ticket?")
      .setPlaceholder("Escribe aquí el motivo de tu ticket...")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
    return true;
  }

  return false;
}

module.exports = { handleTicketInteraction };
