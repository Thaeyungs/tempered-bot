const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const config = require("./config");

const APPEAL_GIF =
  "https://cdn.discordapp.com/attachments/1555082430740959367/1556744417837326428/20260930_232635259_1.gif?backend=b2&ex=6ac546b8&is=6ac3f538&hm=a411174fee99bcaf48c1c981a2bdf7f1835b5d0938dcf736b5a5f78935f4ffd6";

function buildAppealPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5C0000)
    .setImage(APPEAL_GIF)
    .setDescription(
      [
        "# <:emoji_1:1555287145684672574> Appeal / Desban",
        "🇪🇸 **¿Has recibido un ban o alguna otra sanción y crees que debería ser revisada?**",
        "En este canal puedes **crear tu ticket y solicitar una revisión de tu sanción**, explicando tu situación al equipo de soporte. Nuestro staff revisará el caso y determinará si la sanción debe mantenerse, modificarse o retirarse.",
        "",
        "Este canal es únicamente para **apelaciones de sanciones** o algo que tenga que ver con ello. Por favor, no abras un ticket si solo tienes una duda general o necesitas ayuda con otro problema.",
        "",
        "# <:emoji_1:1555287145684672574> Appeal / Ban Appeal",
        "🇺🇸 **Have you received a ban or another punishment and believe it should be reviewed?**",
        "In this channel, you can **create your ticket and request a review of your punishment**, explaining your situation to the support team. Our staff will review the case and determine whether the punishment should remain, be modified, or be removed.",
        "",
        "This channel is only for **punishment appeals** or anything related to them. Please do not open a ticket if you only have a general question or need help with another issue."
      ].join("\n")
    );

  const button = new ButtonBuilder()
    .setCustomId("ticket_create_appeal")
    .setLabel("Crear Appeal / Desban")
    .setEmoji({ name: "emoji_1", id: "1555287145684672574" })
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  };
}

function buildGeneralPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5C0000)
    .setImage("https://cdn.discordapp.com/attachments/1552388946065883198/1555059879570444389/20260930_232635259_1.gif?backend=b2&ex=6abf25de&is=6abdd45e&hm=c6a59dbb709163bee812b01c2ef1550291e5d673f8ae52329a49320122bf1")
    .setDescription(`# <:emoji_5:1555287527965859880> Soporte General
🇪🇸 **¿Tienes alguna pregunta, consulta o necesitas ayuda con algo relacionado con Tempered?** 
En este canal puedes **crear tu ticket y contactar con nuestro equipo de soporte** para resolver dudas, realizar consultas, reclamar roles o recompensas, solicitar asistencia con diferentes situaciones y presentar solicitudes que no correspondan a ninguna de las demás categorías disponibles. Nuestro staff revisará tu caso y te ayudará de acuerdo con la situación.

Este canal está destinado a **consultas generales, solicitudes y problemas que no encajen en las categorías específicas**. Por favor, intenta utilizar la categoría correspondiente cuando tu solicitud esté relacionada con un tema específico, para que podamos ayudarte de la manera más rápida y eficiente posible.
# <:emoji_5:1555287527965859880> General Support
🇺🇸 **Do you have a question, need assistance, or have an issue related to Tempered?** 
In this channel, you can **create a ticket and contact our support team** for questions, general inquiries, role or reward claims, assistance with different situations, and requests that do not fit into any of the other available categories. Our staff will review your case and assist you accordingly.

This channel is intended for **general questions, requests, and issues that do not fit into a specific category**. Please use the appropriate category whenever your request is related to a specific topic, so our team can assist you as quickly and efficiently as possible.`);

  const button = new ButtonBuilder()
    .setCustomId("ticket_create_general")
    .setLabel("Crear Ticket / Create Ticket")
    .setEmoji({ name: "emoji_5", id: "1555287527965859880" })
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  };
}

function buildTechnicalSupportPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5C0000)
    .setImage("https://cdn.discordapp.com/attachments/1552388946065883198/1555059879570444389/20260930_232635259_1.gif?backend=b2&ex=6abf25de&is=6abdd45e&hm=c6a59dbb709163bee812b01c2ef1550291e5d673f8ae52329a49320122bf1")
    .setDescription(`# <:emoji_4:1555287462706937968> Soporte Técnico
🇪🇸 **¿Estás teniendo un problema técnico específico con Tempered y necesitas asistencia?**
En este canal puedes **crear un ticket para recibir ayuda con problemas técnicos relacionados directamente con tu experiencia en el juego**.

Esta categoría está destinada a situaciones que requieren asistencia individual del Staff, como problemas para acceder a determinadas funciones, dificultades relacionadas con tu cuenta o progreso, problemas de configuración, errores que afectan específicamente a tu experiencia y otras situaciones técnicas que no correspondan a un reporte de bugs.

Si encontraste un **bug o problema general del juego**, utiliza el canal correspondiente de **Bug Report** en lugar de esta categoría.

Por favor, explica claramente el problema y proporciona toda la información necesaria para que nuestro equipo pueda ayudarte.

# <:emoji_4:1555287462706937968> Technical Support
🇺🇸 **Are you experiencing a specific technical issue with Tempered and need assistance?**
In this channel, you can **create a ticket to receive help with technical issues directly affecting your experience in the game**.

This category is intended for situations that require individual Staff assistance, such as issues accessing certain features, account or progression-related difficulties, configuration problems, errors specifically affecting your experience, and other technical situations that do not belong in a bug report.

If you have found a **bug or general issue with the game**, please use the appropriate **Bug Report** channel instead of this category.

Please clearly explain the issue and provide all necessary information so our team can assist you.`);

  const button = new ButtonBuilder()
    .setCustomId("ticket_create_technical_support")
    .setLabel("Soporte Técnico / Technical Support")
    .setEmoji({ name: "emoji_4", id: "1555287462706937968" })
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  };
}

async function sendTechnicalSupportPanel(channel) {
  const payload = buildTechnicalSupportPanel();
  return channel.send(payload);
}

function buildUserReportPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5C0000)
    .setImage("https://cdn.discordapp.com/attachments/1552388946065883198/1555059879570444389/20260930_232635259_1.gif?backend=b2&ex=6abf25de&is=6abdd45e&hm=c6a59dbb709163bee812b01c2ef1550291e5d673f8ae52329a49320122bf1")
    .setDescription(`# <:emoji_3:1555287285803520110> Reporte de Usuario
🇪🇸 **¿Has encontrado a un usuario que está incumpliendo las reglas o tienes alguna situación que necesita ser revisada por nuestro Staff?**
En este canal puedes **crear un ticket para reportar a un usuario** y proporcionar toda la información necesaria para que nuestro equipo pueda revisar el caso. Puedes utilizar esta categoría para reportar comportamientos inapropiados, acoso, spam, uso de exploits o cheats, abuso de bugs, comportamiento antideportivo u otras situaciones que consideres que deben ser revisadas por el Staff.

Por favor, proporciona **información clara y precisa sobre el usuario reportado**, explica lo sucedido y, si es posible, incluye **evidencia que pueda ayudar al Staff a revisar el caso**. Los reportes serán revisados por nuestro equipo y se tomarán las medidas correspondientes de acuerdo con la situación.

# <:emoji_3:1555287285803520110> User Report
🇺🇸 **Have you encountered a user who is breaking the rules or have a situation that needs to be reviewed by our Staff?**
In this channel, you can **create a ticket to report a user** and provide all the necessary information for our team to review the case. You can use this category to report inappropriate behavior, harassment, spam, exploits or cheats, bug abuse, unsportsmanlike behavior, or any other situation that you believe should be reviewed by the Staff.

Please provide **clear and accurate information about the reported user**, explain what happened, and, if possible, include **evidence that can help our Staff review the case**. Reports will be reviewed by our team, and appropriate action will be taken depending on the situation.`);

  const button = new ButtonBuilder()
    .setCustomId("ticket_create_user_report")
    .setLabel("Reportar Usuario / Report User")
    .setEmoji({ name: "emoji_3", id: "1555287285803520110" })
    .setStyle(ButtonStyle.Secondary);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  };
}

async function sendUserReportPanel(channel) {
  const payload = buildUserReportPanel();
  return channel.send(payload);
}

function sendAppealPanel(channel) {
  return channel.send(buildAppealPanel());
}

async function sendGeneralPanel(channel) {
  return channel.send(buildGeneralPanel());
}

module.exports = {
  buildAppealPanel,
  buildGeneralPanel,
  buildUserReportPanel,
  buildTechnicalSupportPanel,
  sendAppealPanel,
  sendGeneralPanel,
  sendUserReportPanel,
  sendTechnicalSupportPanel,
  panelChannelId: config.panelChannelId
};
