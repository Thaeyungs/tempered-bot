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

async function sendAppealPanel(channel) {
  const panel = buildAppealPanel();
  return channel.send(panel);
}

module.exports = {
  buildAppealPanel,
  sendAppealPanel,
  panelChannelId: config.panelChannelId
};
