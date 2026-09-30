require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  AuditLogEvent,
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const dataDir = path.join(__dirname, "../data");

const files = {
  discordState: path.join(dataDir, "discord_servers.json"),
  settings: path.join(dataDir, "settings.json"),
  menus: path.join(dataDir, "menus.json"),
  buttons: path.join(dataDir, "buttons.json"),
  messages: path.join(dataDir, "messages.json"),
  questions: path.join(dataDir, "questions.json"),
  activity: path.join(dataDir, "activity.json"),
  logs: path.join(dataDir, "logs.json")
};

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function createId(prefix = "item") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

const spamTracker = new Map();

function addActivity(data) {
  const activity = readJson(files.activity, []);

  activity.push({
    id: createId("activity"),
    timestamp: new Date().toISOString(),
    ...data
  });

  const limit = Date.now() - 30 * 60 * 1000;

  const filtered = activity.filter(item => {
    return new Date(item.timestamp).getTime() >= limit;
  });

  writeJson(files.activity, filtered);
}

function addLog(data) {
  const logs = readJson(files.logs, []);

  logs.push({
    id: createId("log"),
    timestamp: new Date().toISOString(),
    ...data
  });

  writeJson(files.logs, logs);
}

function updateDiscordServers() {
  const servers = [];

  for (const guild of client.guilds.cache.values()) {
    const channels = [];

    for (const channel of guild.channels.cache.values()) {
      if (
        channel.isTextBased() &&
        !channel.isThread()
      ) {
        channels.push({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          canSend:
            channel.permissionsFor(client.user)?.has(
              PermissionFlagsBits.SendMessages
            ) ?? false
        });
      }
    }

    servers.push({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      channels
    });
  }

  writeJson(files.discordState, servers);
}

function getSettings() {
  return readJson(files.settings, {
    presentation: {
      title: "TEMPERED",
      description: "",
      image: ""
    },
    bot: {
      enabled: true
    }
  });
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findQuestion(input) {
  const questions = readJson(files.questions, [])
    .filter(question => question.enabled !== false);

  const normalizedInput = normalize(input);

  let bestMatch = null;
  let bestScore = 0;

  for (const question of questions) {
    const mainQuestion = normalize(question.question);

    if (
      mainQuestion &&
      normalizedInput.includes(mainQuestion)
    ) {
      return question;
    }

    const words = [
      ...(question.relatedWords || [])
    ]
      .map(normalize)
      .filter(Boolean);

    let matches = 0;

    for (const word of words) {
      if (normalizedInput.includes(word)) {
        matches++;
      }
    }

    if (words.length > 0 && matches > 0) {
      const score = matches / words.length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = question;
      }
    }
  }

  if (bestMatch && bestScore >= 0.5) {
    return bestMatch;
  }

  return null;
}

function buildButtons(menuId) {
  const buttons = readJson(files.buttons, [])
    .filter(button => {
      return (
        button.enabled !== false &&
        button.menuId === menuId
      );
    })
    .sort((a, b) => {
      return (a.order ?? 0) - (b.order ?? 0);
    })
    .slice(0, 25);

  const discordButtons = buttons.map(button => {
    const builder = new ButtonBuilder()
      .setLabel(button.label);

    if (button.emoji) {
      builder.setEmoji(button.emoji);
    }

    if (button.typeId) {
      builder
        .setCustomId(`type:${button.typeId}`)
        .setStyle(ButtonStyle.Secondary);
    } else if (button.url) {
      builder
        .setURL(button.url)
        .setStyle(ButtonStyle.Link);
    } else {
      builder
        .setCustomId(`button:${button.id}`)
        .setStyle(ButtonStyle.Secondary);
    }

    return builder;
  });

  const rows = [];

  for (
    let i = 0;
    i < discordButtons.length;
    i += 5
  ) {
    rows.push(
      new ActionRowBuilder().addComponents(
        discordButtons.slice(i, i + 5)
      )
    );
  }

  return rows;
}

function buildTemperedPresentation() {
  const text =
    "⚔️ TEMPERED\n\n" +
    "🎮 Un nuevo juego de combate en Roblox.\n\n" +
    "🗡️ Prepárate para enfrentarte a otros jugadores, mejorar tus espadas y demostrar tu habilidad.\n\n" +
    "✨ ¡La batalla comienza aquí!";

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Jugar ahora")
      .setEmoji("🎮")
      .setStyle(ButtonStyle.Link)
      .setURL("https://www.roblox.com/share?code=de9c658ce104f842aafc8cf8d7f42074&type=ExperienceDetails&stamp=1790390528235")
  );

  return {
    content: text,
    components: [row]
  };
}

function buildInformationPanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("information_select")
    .setPlaceholder("⭔　﹒ꇙ꒒ꉔ　☓﹑　𓂃")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Redes Sociales")
        .setDescription("Obten las redes sociales del juego aqui!")
        .setValue("socials")
        .setEmoji("🌐"),

      new StringSelectMenuOptionBuilder()
        .setLabel("Soporte Tecnico del juego")
        .setDescription("Obten el servidor del soporte tecnico del juego.")
        .setValue("support")
        .setEmoji("🛠️"),

      new StringSelectMenuOptionBuilder()
        .setLabel("Idioma de canales")
        .setDescription("Cambia el idioma de los canales del servidor!")
        .setValue("language")
        .setEmoji("🌎"),

      new StringSelectMenuOptionBuilder()
        .setLabel("Preguntas")
        .setDescription("Aqui encontraras los canales para pedir ayuda o hacer preguntas sobre el juego.")
        .setValue("questions")
        .setEmoji("❔")
    );

  const row = new ActionRowBuilder().addComponents(menu);

  const embed = createEmbed({
    title: "⚔️ TEMPERED — INFORMATION",
    description:
      "🇪🇸 **¿Buscas ayuda o necesitas encontrar información sobre Tempered?**\n" +
      "Bienvenido al centro de información del servidor. Selecciona una opción en la barra de abajo para encontrar exactamente lo que estás buscando.\n\n" +
      "🇺🇸 **Looking for help or need information about Tempered?**\n" +
      "Welcome to the server's information center. Select an option from the menu below to find exactly what you're looking for."
  });

  return { embeds: [embed], components: [row] };
}
function createEmbed(data) {
  const embed = new EmbedBuilder();

  if (data.title) {
    embed.setTitle(data.title);
  }

  if (data.description) {
    embed.setDescription(data.description);
  }

  if (data.image) {
    embed.setImage(data.image);
  }

  return embed;
}

async function sendMenu(channel, menuId) {
  const menus = readJson(files.menus, []);

  const menu = menus.find(item => item.id === menuId);

  if (!menu) {
    return false;
  }

  const embed = createEmbed({
    title: menu.title || menu.name,
    description: menu.description,
    image: menu.image
  });

  const rows = buildButtons(menu.id);

  await channel.send({
    embeds: [embed],
    components: rows
  });

  return true;
}

async function processPublishQueue() {
  const queue = readJson(path.join(dataDir, "publish_queue.json"), []);
  let changed = false;

  for (const item of queue) {
    if (item.status !== "pending") {
      continue;
    }

    try {
      const guild = await client.guilds.fetch(item.serverId);
      const channel = await guild.channels.fetch(item.channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error("El canal no es válido o no es de texto.");
      }

      const published = await sendMenu(channel, item.menuId);

      if (!published) {
        throw new Error("El menú no existe o no está disponible.");
      }

      item.status = "completed";
      item.completedAt = new Date().toISOString();
      changed = true;

      addActivity({
        action: "Menú publicado",
        user: client.user?.tag || "TEMPERED",
        details: item.menuId
      });

      addLog({
        action: "menu_published",
        user: client.user?.tag || "TEMPERED",
        server: guild.name,
        channel: channel.name,
        menuId: item.menuId
      });
    } catch (error) {
      item.status = "failed";
      item.error = error.message;
      item.failedAt = new Date().toISOString();
      changed = true;

      addLog({
        action: "menu_publish_failed",
        user: client.user?.tag || "TEMPERED",
        server: item.serverId,
        channel: item.channelId,
        menuId: item.menuId,
        error: error.message
      });
    }
  }

  if (changed) {
    writeJson(path.join(dataDir, "publish_queue.json"), queue);
  }
}

async function sendMessageByType(channel, typeId) {
  const messages = readJson(files.messages, []);

  const message = messages.find(item => {
    return (
      item.typeId === typeId &&
      item.enabled !== false
    );
  });

  if (!message) {
    return false;
  }

  const embed = createEmbed(message);

  await channel.send({
    embeds: [embed]
  });

  return true;
}

async function sendBotSecurityLog(title, description, color = 0xB8860B) {
  try {
    const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});

    for (const guild of client.guilds.cache.values()) {
      const channelId = logChannels[guild.id]?.seguridad;
      if (!channelId) continue;

      const logChannel = await guild.channels.fetch(channelId).catch(() => null);
      if (!logChannel) continue;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription(description)
        .addFields(
          { name: "Bot", value: client.user ? `<@${client.user.id}>` : "Tempered", inline: false },
          { name: "ID bot", value: client.user?.id || "N/A", inline: false }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("No se pudo enviar el log de seguridad del bot:", error);
  }
}

async function sendInformationPanel() {
  const channel = await client.channels.fetch("1552384343207452823");

  if (!channel || !channel.isTextBased()) {
    throw new Error("No se pudo encontrar el canal de información.");
  }

  const panel = buildInformationPanel();

  console.log("INTENTANDO ENVIAR PANEL DE INFORMACIÓN...");
  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find(m => m.author.id === client.user.id && m.embeds[0]?.description?.includes("Looking for help or information about Tempered?"));
  if (existing) await existing.edit(panel); else await channel.send(panel);

  await sendBotSecurityLog(
    "📋 Panel de información enviado",
    `El bot envió el panel de información en <#${channel.id}>.`
  );

  addLog({
    action: "information_panel_sent",
    user: client.user?.tag || "Tempered",
    server: channel.guild?.name,
    channel: channel.name
  });
}

const logsCommand = new SlashCommandBuilder()
  .setName("logs")
  .setDescription("Configura los canales de logs del servidor")
  .addSubcommand(subcommand =>
    subcommand
      .setName("general")
      .setDescription("Establece este canal como Logs General")
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("seguridad")
      .setDescription("Establece este canal como Logs de Seguridad")
  );

const kickCommand = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Expulsa a un usuario del servidor")
  .addUserOption(option =>
    option.setName("usuario").setDescription("Usuario a expulsar").setRequired(true)
  )
  .addStringOption(option =>
    option.setName("razon").setDescription("Razón de la expulsión").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setDMPermission(false);

const banCommand = new SlashCommandBuilder()
  .setName("ban")
  .setDescription("Banea a un usuario del servidor")
  .addUserOption(option =>
    option.setName("usuario").setDescription("Usuario a banear").setRequired(true)
  )
  .addStringOption(option =>
    option.setName("razon").setDescription("Razón del baneo").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

const unbanCommand = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Quita el baneo a un usuario")
  .addStringOption(option =>
    option.setName("usuario_id").setDescription("ID del usuario baneado").setRequired(true)
  )
  .addStringOption(option =>
    option.setName("razon").setDescription("Razón del desbaneo").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

const muteCommand = new SlashCommandBuilder()
  .setName("mute")
  .setDescription("Silencia temporalmente a un usuario")
  .addUserOption(option =>
    option.setName("usuario").setDescription("Usuario a silenciar").setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName("duracion")
      .setDescription("Duración en minutos")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(40320)
  )
  .addStringOption(option =>
    option.setName("razon").setDescription("Razón del silencio").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

const unmuteCommand = new SlashCommandBuilder()
  .setName("unmute")
  .setDescription("Quita el silencio temporal a un usuario")
  .addUserOption(option =>
    option.setName("usuario").setDescription("Usuario a desilenciar").setRequired(true)
  )
  .addStringOption(option =>
    option.setName("razon").setDescription("Razón").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setDMPermission(false);

const purgeCommand = new SlashCommandBuilder()
  .setName("purge")
  .setDescription("Elimina varios mensajes de un canal")
  .addIntegerOption(option =>
    option
      .setName("cantidad")
      .setDescription("Cantidad de mensajes a eliminar")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);


client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await member.roles.add("1554367453587447880");
  } catch (error) {
    console.error("Error asignando rol automático:", error);
  }
});

client.once(Events.ClientReady, async bot => {

  await bot.application.commands.set([logsCommand, kickCommand, banCommand, unbanCommand, muteCommand, unmuteCommand, purgeCommand], "1552337088421306490");
  console.log("SLASH COMMANDS REGISTRADOS: /logs /kick /ban /unban /mute /unmute /purge");
  console.log(
    `TEMPERED BOT ONLINE: ${bot.user.tag}`
  );

  await sendBotSecurityLog(
    "🟢 Bot iniciado",
    "Tempered se ha conectado correctamente y está operativo."
  );

  updateDiscordServers();
  processPublishQueue();
  sendInformationPanel().catch(error => {
    console.error("Error enviando el panel de información:", error);
  });

  sendLanguagePanel().catch(error => {
    console.error("Error enviando el panel de idioma:", error);
  });

  addActivity({
    action: "Bot conectado",
    user: bot.user.tag
  });

  addLog({
    action: "bot_online",
    user: bot.user.tag
  });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "logs") return;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "❌ Necesitas permisos de Administrar servidor para configurar los logs.", ephemeral: true });
    return;
  }

  const logChannelsFile = path.join(dataDir, "log_channels.json");
  const logChannels = readJson(logChannelsFile, {});
  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (!logChannels[guildId]) {
    logChannels[guildId] = {};
  }

  if (subcommand === "general") {
    logChannels[guildId].general = interaction.channelId;
  }

  if (subcommand === "seguridad") {
    logChannels[guildId].seguridad = interaction.channelId;
  }

  writeJson(logChannelsFile, logChannels);

  const nombre = subcommand === "general" ? "Logs General" : "Logs de Seguridad";

  await interaction.reply({
    content: `✅ Este canal ahora es **${nombre}**.`,
    ephemeral: true
  });
});

async function sendModerationDM({ user, action, moderator, reason, duration = null, guildName }) {
  try {
    const fields = [
      { name: "Acción", value: action, inline: false },
      { name: "Usuario", value: `${user}`, inline: false },
      { name: "ID usuario", value: user.id, inline: false },
      { name: "Moderador", value: `${moderator}`, inline: false },
      { name: "ID moderador", value: moderator.id, inline: false },
      { name: "Razón", value: reason || "Sin razón especificada", inline: false }
    ];

    if (duration) {
      fields.push({
        name: "Duración",
        value: duration,
        inline: false
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Tempered — ${action}`)
      .setColor(0x8B0000)
      .setDescription(
        `Se ha realizado una acción de moderación sobre tu cuenta en **${guildName || "este servidor"}**.`
      )
      .addFields(fields)
      .setFooter({ text: "Tempered • Información de moderación" })
      .setTimestamp();

    const supportButton = new ButtonBuilder()
      .setLabel("💬 Servidor de soporte")
      .setStyle(ButtonStyle.Link)
.setURL("https://discord.gg/5PTtaBeup");
    const row = new ActionRowBuilder()
      .addComponents(supportButton);

    await user.send({
      embeds: [embed],
      components: [row]
    });

    return true;
  } catch (error) {
    console.error(`No se pudo enviar el DM de moderación a ${user.tag}:`, error?.code, error?.message);
    return false;
  }
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "kick") return;

  const member = interaction.options.getMember("usuario");
  const user = interaction.options.getUser("usuario");
  const reason = interaction.options.getString("razon") || "Sin razón especificada";

  if (!member) {
    await interaction.reply({ content: "❌ Ese usuario no está en el servidor.", ephemeral: true });
    return;
  }

  if (!member.kickable) {
    await interaction.reply({ content: "❌ No puedo expulsar a ese usuario. Revisa la jerarquía de roles.", ephemeral: true });
    return;
  }

  try {

    await interaction.deferReply();
    await sendModerationDM({
      user,
      action: "Usuario expulsado",
      moderator: interaction.user,
      reason,
      guildName: interaction.guild?.name
    });

    await member.kick(reason);

    const kickEmbed = new EmbedBuilder()
      .setTitle("👢 Usuario expulsado")
      .setColor(0x8B0000)
      .addFields(
        { name: "Usuario", value: `${user}`, inline: false },
        { name: "ID usuario", value: user.id, inline: false },
        { name: "Moderador", value: `<@${interaction.user.id}>`, inline: false },
        { name: "Razón", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [kickEmbed]
    });

    

    await sendBotSecurityLog(
      "👢 Usuario expulsado",
      `**Usuario:** <@${user.id}>\n**ID usuario:** ${user.id}\n**Responsable:** <@${interaction.user.id}>\n**ID responsable:** ${interaction.user.id}\n**Razón:** ${reason}`
    );

    addLog({
      action: "member_kicked",
      user: user.tag,
      server: interaction.guild?.name,
      moderator: interaction.user.tag,
      reason
    });
  } catch (error) {
    console.error("Error ejecutando /kick:", error);

    if (interaction.deferred) {
      await interaction.editReply({ content: "❌ No se pudo expulsar al usuario." });
    } else if (!interaction.replied) {
      await interaction.reply({ content: "❌ No se pudo expulsar al usuario.", ephemeral: true });
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "ban") return;

  const member = interaction.options.getMember("usuario");
  const user = interaction.options.getUser("usuario");
  const reason = interaction.options.getString("razon") || "Sin razón especificada";

  if (!member) {
    await interaction.reply({
      content: "❌ Ese usuario no está en el servidor.",
      ephemeral: true
    });
    return;
  }

  if (!member.bannable) {
    await interaction.reply({
      content: "❌ No puedo banear a ese usuario. Revisa la jerarquía de roles.",
      ephemeral: true
    });
    return;
  }

  try {

    await interaction.deferReply();
    await sendModerationDM({
      user,
      action: "Usuario baneado",
      moderator: interaction.user,
      reason,
      guildName: interaction.guild?.name
    });

    await member.ban({ reason });

    const banEmbed = new EmbedBuilder()
      .setTitle("🔨 Usuario baneado")
      .setColor(0x8B0000)
      .addFields(
        { name: "Usuario", value: `${user}`, inline: false },
        { name: "ID usuario", value: user.id, inline: false },
        { name: "Moderador", value: `<@${interaction.user.id}>`, inline: false },
        { name: "Razón", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [banEmbed]
    });

    

    await sendBotSecurityLog(
      "🔨 Usuario baneado",
      `**Usuario:** <@${user.id}>\n**ID usuario:** ${user.id}\n**Responsable:** <@${interaction.user.id}>\n**ID responsable:** ${interaction.user.id}\n**Razón:** ${reason}`
    );

    addLog({
      action: "member_banned",
      user: user.tag,
      server: interaction.guild?.name,
      moderator: interaction.user.tag,
      reason
    });
  } catch (error) {
    console.error("Error ejecutando /ban:", error);

    if (interaction.deferred) {
      await interaction.editReply({ content: "❌ No se pudo banear al usuario." });
    } else if (!interaction.replied) {
      await interaction.reply({ content: "❌ No se pudo banear al usuario.", ephemeral: true });
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "unban") return;

  const userId = interaction.options.getString("usuario_id");
  const reason = interaction.options.getString("razon") || "Sin razón especificada";

  try {
    const user = await client.users.fetch(userId);

    await interaction.guild.members.unban(userId, reason);

    const unbanEmbed = new EmbedBuilder()
      .setTitle("🔓 Usuario desbaneado")
      .setColor(0x8B0000)
      .addFields(
        { name: "Usuario", value: `${user}`, inline: false },
        { name: "ID usuario", value: user.id, inline: false },
        { name: "Moderador", value: `<@${interaction.user.id}>`, inline: false },
        { name: "Razón", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [unbanEmbed]
    });

    await sendModerationDM({
      user,
      action: "Usuario desbaneado",
      moderator: interaction.user,
      reason,
      guildName: interaction.guild?.name
    });

    await sendBotSecurityLog(
      "🔓 Usuario desbaneado",
      `**Usuario:** <@${user.id}>\n**ID usuario:** ${user.id}\n**Responsable:** <@${interaction.user.id}>\n**ID responsable:** ${interaction.user.id}\n**Razón:** ${reason}`
    );

    addLog({
      action: "member_unbanned",
      user: user.tag,
      server: interaction.guild?.name,
      moderator: interaction.user.tag,
      reason
    });
  } catch (error) {
    console.error("Error ejecutando /unban:", error);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ No se pudo desbanear al usuario. Comprueba que el ID sea correcto y que esté baneado.",
        ephemeral: true
      });
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "mute") return;

  const member = interaction.options.getMember("usuario");
  const user = interaction.options.getUser("usuario");
  const duration = interaction.options.getInteger("duracion");
  const reason = interaction.options.getString("razon") || "Sin razón especificada";

  if (!member) {
    await interaction.reply({
      content: "❌ Ese usuario no está en el servidor.",
      ephemeral: true
    });
    return;
  }

  if (!member.moderatable) {
    await interaction.reply({
      content: "❌ No puedo silenciar a ese usuario. Revisa la jerarquía de roles.",
      ephemeral: true
    });
    return;
  }

  try {
    await member.timeout(duration * 60 * 1000, reason);

    const muteEmbed = new EmbedBuilder()
      .setTitle("🔇 Usuario silenciado")
      .setColor(0xB8860B)
      .addFields(
        { name: "Usuario", value: `${user}`, inline: false },
        { name: "ID usuario", value: user.id, inline: false },
        { name: "Duración", value: `${duration} minutos`, inline: false },
        { name: "Moderador", value: `<@${interaction.user.id}>`, inline: false },
        { name: "Razón", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [muteEmbed]
    });

    await sendModerationDM({
      user,
      action: "Usuario silenciado",
      moderator: interaction.user,
      reason,
      duration: `${duration} minutos`,
      guildName: interaction.guild?.name
    });

    await sendBotSecurityLog(
      "🔇 Usuario silenciado",
      `**Usuario:** <@${user.id}>\n**ID usuario:** ${user.id}\n**Duración:** ${duration} minutos\n**Responsable:** <@${interaction.user.id}>\n**ID responsable:** ${interaction.user.id}\n**Razón:** ${reason}`
    );

    addLog({
      action: "member_muted",
      user: user.tag,
      server: interaction.guild?.name,
      moderator: interaction.user.tag,
      duration: `${duration} minutos`,
      reason
    });
  } catch (error) {
    console.error("Error ejecutando /mute:", error);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ No se pudo silenciar al usuario.",
        ephemeral: true
      });
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "unmute") return;

  const member = interaction.options.getMember("usuario");
  const user = interaction.options.getUser("usuario");
  const reason = interaction.options.getString("razon") || "Sin razón especificada";

  if (!member) {
    await interaction.reply({
      content: "❌ Ese usuario no está en el servidor.",
      ephemeral: true
    });
    return;
  }

  try {
    await member.timeout(null, reason);

    const unmuteEmbed = new EmbedBuilder()
      .setTitle("🔊 Usuario desilenciado")
      .setColor(0xB8860B)
      .addFields(
        { name: "Usuario", value: `${user}`, inline: false },
        { name: "ID usuario", value: user.id, inline: false },
        { name: "Moderador", value: `<@${interaction.user.id}>`, inline: false },
        { name: "Razón", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [unmuteEmbed]
    });

    await sendModerationDM({
      user,
      action: "Usuario desilenciado",
      moderator: interaction.user,
      reason,
      guildName: interaction.guild?.name
    });

    await sendBotSecurityLog(
      "🔊 Usuario desilenciado",
      `**Usuario:** <@${user.id}>\n**ID usuario:** ${user.id}\n**Responsable:** <@${interaction.user.id}>\n**ID responsable:** ${interaction.user.id}\n**Razón:** ${reason}`
    );

    addLog({
      action: "member_unmuted",
      user: user.tag,
      server: interaction.guild?.name,
      moderator: interaction.user.tag,
      reason
    });
  } catch (error) {
    console.error("Error ejecutando /unmute:", error);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ No se pudo desilenciar al usuario.",
        ephemeral: true
      });
    }
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "purge") return;

  const cantidad = interaction.options.getInteger("cantidad");

  try {
    const mensajesEliminados = await interaction.channel.bulkDelete(cantidad, true);

    await interaction.reply({
      content: `🧹 **Mensajes eliminados**\n\n**Cantidad:** ${mensajesEliminados.size}\n**Canal:** <#${interaction.channelId}>\n**Moderador:** <@${interaction.user.id}>`,
      ephemeral: false
    });

    await sendBotSecurityLog(
      "🧹 Mensajes eliminados",
      `**Cantidad:** ${mensajesEliminados.size}\n**Canal:** <#${interaction.channelId}>\n**ID canal:** ${interaction.channelId}\n**Responsable:** <@${interaction.user.id}>\n**ID responsable:** ${interaction.user.id}`
    );

    addLog({
      action: "messages_purged",
      server: interaction.guild?.name,
      channel: interaction.channel?.name,
      moderator: interaction.user.tag,
      amount: mensajesEliminados.size
    });
  } catch (error) {
    console.error("Error ejecutando /purge:", error);

    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ No se pudieron eliminar los mensajes. Recuerda que Discord solo permite borrar masivamente mensajes recientes.",
        ephemeral: true
      });
    }
  }
});

client.on(Events.GuildCreate, guild => {
  updateDiscordServers();

  addActivity({
    action: "Bot añadido a un servidor",
    user: guild.name
  });
});

client.on(Events.GuildDelete, guild => {
  updateDiscordServers();

  addActivity({
    action: "Bot salió de un servidor",
    user: guild.name
  });
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) {
    return;
  }

  if (message.guild) {
    const now = Date.now();
    const userId = message.author.id;
    const tracker = spamTracker.get(userId) || {
      messages: [],
      warned: false
    };

    tracker.messages = tracker.messages.filter(timestamp => now - timestamp <= 5000);
    tracker.messages.push(now);

    if (tracker.messages.length >= 5) {
      if (!tracker.warned) {
        tracker.warned = true;
        await message.channel.send(
          `⚠️ <@${userId}> **Detente:** Estás enviando mensajes demasiado rápido.\n` +
          `**Stop:** You are sending messages too quickly.`
        );
      } else {
        try {
          const messages = await message.channel.messages.fetch({ limit: 100 });
          const userMessages = messages
            .filter(msg => msg.author.id === userId)
            .first(30);

          if (userMessages.length > 0) {
            await message.channel.bulkDelete(userMessages, true);
          }

          const member = message.member;

          if (member && member.moderatable) {
            await member.timeout(
              10 * 60 * 1000,
              "Anti-spam: mensajes enviados demasiado rápido"
            );
          }

          await sendBotSecurityLog(
            "⚠️ Anti-Spam activado",
            `**Usuario:** <@${userId}>\n` +
            `**ID usuario:** ${userId}\n` +
            `**Servidor:** ${message.guild.name}\n` +
            `**Canal:** ${message.channel.name}\n` +
            `**Acción:** Se eliminaron hasta 30 mensajes y se aplicó un mute de 10 minutos.`
          );

          tracker.messages = [];
          tracker.warned = false;
        } catch (error) {
          console.error("Error ejecutando anti-spam:", error);
        }
      }
    }

    spamTracker.set(userId, tracker);
  }

  if (message.content.trim().toLowerCase() === "!!information") {
    const panel = buildInformationPanel();
    await message.channel.send(panel);
    return;
  }

  if (message.mentions.has(client.user)) {
    const presentation = buildTemperedPresentation();

    await message.reply(presentation);

    addActivity({
      action: "Respondió a una mención",
      user: message.author.tag
    });

    addLog({
      action: "mention_response",
      user: message.author.tag,
      server: message.guild?.name,
      channel: message.channel?.name
    });

    return;
  }

  const question = findQuestion(message.content);

  if (!question) {
    return;
  }

  if (question.answer) {
    await message.reply(question.answer);

    addActivity({
      action: "Respondió una pregunta",
      user: message.author.tag,
      details: question.question
    });

    addLog({
      action: "question_answered",
      user: message.author.tag,
      server: message.guild?.name,
      channel: message.channel?.name,
      question: question.question
    });
  }
});

async function sendLanguagePanel() {
  const channel = await client.channels.fetch("1552389761061093417");
  if (!channel) return;

  const embed = createEmbed({
    title: "🌎 LENGUAJE DE CANALES / CHANNEL LANGUAGE",
    description:
      "🇪🇸 **Español**\n" +
      "Bienvenido a Tempered Roblox. Selecciona el idioma que prefieras para los canales del servidor. Tu selección actualizará el idioma de visualización. Esta configuración no es permanente y puedes cambiarla cuando quieras.\n\n" +
      "🇺🇸 **English**\n" +
      "Welcome to Tempered Roblox. Please select your preferred language for the server channels. Your selection will update your channel language. This setting is not permanent, and you can change it whenever you want."
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("language_spanish")
      .setLabel("Español")
      .setEmoji("🇪🇸")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("language_english")
      .setLabel("English")
      .setEmoji("🇺🇸")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  });
}

client.on(
  Events.InteractionCreate,
  async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) {
      return;
    }
    if (interaction.isButton() && (interaction.customId === "language_spanish" || interaction.customId === "language_english")) {
      const member = interaction.member;
      const spanishRole = "1554367419881885816";
      const englishRole = "1554367390542856202";
      const neutralRole = "1554367453587447880";
      const commonRole = "1552391146330660944";

      try {
        await member.roles.remove(neutralRole);

        if (interaction.customId === "language_spanish") {
          await member.roles.remove(englishRole);
          await member.roles.add(spanishRole);
          await member.roles.add(commonRole);

          await interaction.reply({
            content: "🇪🇸 **Idioma actualizado correctamente**\nTu rol ha sido cambiado con éxito. Esta opción no es permanente; puedes cambiar nuevamente el idioma del servidor a tu gusto cuando desees.",
            ephemeral: true
          });
        } else {
          await member.roles.remove(spanishRole);
          await member.roles.add(englishRole);
          await member.roles.add(commonRole);

          await interaction.reply({
            content: "🇺🇸 **Language updated successfully**\nYour role has been changed successfully. This option is not permanent; you can change the server language again whenever you want.",
            ephemeral: true
          });
        }
      } catch (error) {
        console.error("Error asignando autorol de idioma:", error);

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "No se pudo actualizar tu idioma. Please try again.",
            ephemeral: true
          });
        }
      }

      return;
    }


    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "information_select"
    ) {
      const selected = interaction.values[0];

      if (selected === "questions") {
        const embed = createEmbed({
          title: "❔ Preguntas / Questions",
          description:
            "🇪🇸 **Aquí encontrarás el canal para pedir ayuda o hacer preguntas sobre el juego. Haz clic en este canal y realiza tu pregunta.**\n\n" +
            "🇺🇸 **Here you will find the channel to ask for help or questions about the game. Click this channel and ask your question.**"
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Preguntas")
            .setEmoji("❔")
            .setStyle(ButtonStyle.Link)
            .setURL("https://discord.com/channels/1552337088421306490/1552386908083191920")
        );

        await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true
        });

        return;
      }

      if (selected === "language") {
        const embed = createEmbed({
          title: "🌎 Idioma de canales",
          description:
            "🇪🇸 **Cambia el idioma de los canales del servidor!**\n" +
            "Entra aquí y cambia tu idioma.\n\n" +
            "🇺🇸 **Change the language of the server channels!**\n" +
            "Enter here and change your language."
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Idioma / Language")
            .setEmoji("🌎")
            .setStyle(ButtonStyle.Link)
            .setURL("https://discord.com/channels/1552337088421306490/1552389761061093417")
        );

        await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true
        });

        return;
      }

      if (selected === "support") {
        const embed = createEmbed({
          title: "🛠️ Soporte Técnico del juego / Game Support",
          description:
            "🇪🇸 **Obtén el servidor de soporte técnico del juego y pide ayuda con tu caso. En este servidor puedes apelar, solicitar un desbaneo o reclamar algo relacionado con el juego.**\n\n" +
            "🇺🇸 **Get the game support server and ask for help with your case. In this server, you can appeal, request an unban, or report an issue related to the game.**"
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Servidor de Soporte")
            .setEmoji("🛠️")
            .setStyle(ButtonStyle.Link)
            .setURL("https://discord.gg/5PTtaBeup")
        );

        await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true
        });

        return;
      }

      if (selected === "create_vc") {
        const embed = createEmbed({
          title: "🔊 CREATE VC",
          description:
            "**¿Quieres tus propios canales de voz?**\n" +
            "<:PepeBoosterLogo:1554709714221142097> Boostea el servidor y obtén los permisos.\n\n" +
            "**Want your own voice channels?**\n" +
            "Boost the server to unlock the permissions!"
        });

        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
        return;
      }

      if (selected === "socials") {
        const embed = createEmbed({
          title: "🌐 Redes Sociales / Social Media",
          description:
            "🇪🇸 **¡Encuentra nuestras redes sociales aquí!**\n🇺🇸 **Find our social media here!**\n\n" +
            "<:YouTube:1554559151869395015> **YouTube**\n" +
            "¡Encuéntranos aquí! / Find us here!\n\n" +
            "<:TikTok:1553927582095773738> **TikTok**\n" +
            "¡Encuéntranos aquí! / Find us here!\n\n" +
            "<:X_Twitter:1553928109110067261> 𝕏 **(Twitter)**\n" +
            "¡Encuéntranos aquí! / Find us here!"
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("YouTube")
            .setEmoji({ name: "YouTube", id: "1554559151869395015" })
            .setStyle(ButtonStyle.Link)
            .setURL("https://youtube.com/@temperedoficial?si=W30p3MEvAKdisE4E"),

          new ButtonBuilder()
            .setLabel("TikTok")
            .setEmoji({ name: "TikTok", id: "1553927582095773738" })
            .setStyle(ButtonStyle.Link)
            .setURL("https://www.tiktok.com/@tempered_oficial?_r=1&_t=ZS-9A2Qj0rOvLy"),

          new ButtonBuilder()
            .setLabel("𝕏 (Twitter)")
            .setEmoji({ name: "X_Twitter", id: "1553928109110067261" })
            .setStyle(ButtonStyle.Link)
            .setURL("https://x.com/TemperedOficial")
        );

        await interaction.reply({
          embeds: [embed],
          components: [row],
          ephemeral: true
        });

        return;
      }
    }

    if (
      interaction.customId.startsWith("type:")
    ) {
      const typeId =
        interaction.customId.replace("type:", "");

      const messages = readJson(
        files.messages,
        []
      );

      const message = messages.find(item => {
        return (
          item.typeId === typeId &&
          item.enabled !== false
        );
      });

      if (message) {
        const embed = createEmbed(message);

        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });

        addActivity({
          action: "Pulsó un botón",
          user: interaction.user.tag,
          details: message.name
        });

        addLog({
          action: "button_pressed",
          user: interaction.user.tag,
          server: interaction.guild?.name,
          channel: interaction.channel?.name,
          details: message.name
        });

        return;
      }

      await interaction.reply({
        content:
          "Esta opción no está disponible en el sistema.",
        ephemeral: true
      });
    }
  }
);

setInterval(
  updateDiscordServers,
  60 * 1000
);

setInterval(
  processPublishQueue,
  10 * 1000
);

client.on(Events.MessageDelete, async message => {
  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[message.guild?.id]?.general;
  if (!channelId) return;

  const logChannel = await message.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  let deletedBy = "Responsable no identificado";
  let deletedById = "N/A";

  try {
    const auditLogs = await message.guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 10
    });

    const entry = auditLogs.entries.find(entry => {
      const extraChannel = entry.extra?.channel?.id;
      const sameChannel = extraChannel === message.channelId;
      const recent = Date.now() - entry.createdTimestamp < 10000;

      return sameChannel && recent;
    });

    if (entry?.executor) {
      deletedBy = `<@${entry.executor.id}>`;
      deletedById = entry.executor.id;
    }
  } catch (error) {
    console.error("No se pudo consultar el Audit Log para mensaje eliminado:", error);
  }

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Mensaje eliminado")
    .setColor(0x8B0000)
    .addFields(
      { name: "Canal", value: `<#${message.channelId}>`, inline: false },
      { name: "Usuario", value: message.author ? `<@${message.author.id}>` : "Usuario desconocido", inline: false },
      { name: "ID usuario", value: message.author?.id || "N/A", inline: false },
      { name: "Eliminado por", value: deletedBy, inline: false },
      { name: "ID responsable", value: deletedById, inline: false },
      { name: "Texto", value: message.content || "Sin contenido disponible", inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[newMessage.guild?.id]?.general;
  if (!channelId) return;

  const logChannel = await newMessage.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Mensaje editado")
    .setColor(0x8B0000)
    .addFields(
      { name: "Canal", value: `<#${newMessage.channelId}>`, inline: false },
      { name: "Usuario", value: newMessage.author?.username || "Usuario desconocido", inline: false },
      { name: "ID usuario", value: newMessage.author?.id || "N/A", inline: false },
      { name: "Antes", value: oldMessage.content || "Sin contenido disponible", inline: false },
      { name: "Después", value: newMessage.content || "Sin contenido disponible", inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.GuildMemberAdd, async member => {
  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[member.guild.id]?.general;
  if (!channelId) return;

  const logChannel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Miembro entró")
    .setColor(0xB8860B)
    .addFields(
      { name: "Usuario", value: `<@${member.user.id}>`, inline: false },
      { name: "ID usuario", value: member.user.id, inline: false },
      { name: "Cuenta creada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.GuildMemberRemove, async member => {
  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[member.guild.id]?.general;
  if (!channelId) return;

  const logChannel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Miembro salió")
    .setColor(0xB8860B)
    .addFields(
      { name: "Usuario", value: `<@${member.user.id}>`, inline: false },
      { name: "ID usuario", value: member.user.id, inline: false },
      { name: "Cuenta creada", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const oldPremiumSince = oldMember.premiumSince;
  const newPremiumSince = newMember.premiumSince;

  if (oldPremiumSince !== newPremiumSince) {
    const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
    const channelId = logChannels[newMember.guild.id]?.general;

    if (channelId) {
      const logChannel = await newMember.guild.channels.fetch(channelId).catch(() => null);

      if (logChannel) {
        if (!oldPremiumSince && newPremiumSince) {
          const embed = new EmbedBuilder()
            .setTitle("🚀 Servidor impulsado")
            .setColor(0xB8860B)
            .addFields(
              { name: "Usuario", value: `<@${newMember.user.id}>`, inline: false },
              { name: "ID usuario", value: newMember.user.id, inline: false },
              { name: "Nivel del servidor", value: `${newMember.guild.premiumTier}`, inline: false }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [embed] });
        }

        if (oldPremiumSince && !newPremiumSince) {
          const embed = new EmbedBuilder()
            .setTitle("📉 Boost retirado")
            .setColor(0xB8860B)
            .addFields(
              { name: "Usuario", value: `<@${newMember.user.id}>`, inline: false },
              { name: "ID usuario", value: newMember.user.id, inline: false },
              { name: "Nivel del servidor", value: `${newMember.guild.premiumTier}`, inline: false }
            )
            .setTimestamp();

          await logChannel.send({ embeds: [embed] });
        }
      }
    }
  }


  const nicknameChanged = oldMember.nickname !== newMember.nickname;
  const globalNameChanged = oldMember.user.globalName !== newMember.user.globalName;

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
  const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

  if (!nicknameChanged && !globalNameChanged && addedRoles.size === 0 && removedRoles.size === 0) return;

  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[newMember.guild.id]?.general;
  if (!channelId) return;

  const logChannel = await newMember.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  if (nicknameChanged) {
    const embed = new EmbedBuilder()
      .setTitle("✏️ Apodo cambiado")
      .setColor(0xB8860B)
      .addFields(
        { name: "Usuario", value: `<@${newMember.user.id}>`, inline: false },
        { name: "ID usuario", value: newMember.user.id, inline: false },
        { name: "Apodo antes", value: oldMember.nickname || "Sin apodo", inline: false },
        { name: "Apodo después", value: newMember.nickname || "Sin apodo", inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  if (globalNameChanged) {
    const embed = new EmbedBuilder()
      .setTitle("✏️ Nickname cambiado")
      .setColor(0xB8860B)
      .addFields(
        { name: "Usuario", value: `<@${newMember.user.id}>`, inline: false },
        { name: "ID usuario", value: newMember.user.id, inline: false },
        { name: "Nickname antes", value: oldMember.user.globalName || "Sin nickname", inline: false },
        { name: "Nickname después", value: newMember.user.globalName || "Sin nickname", inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  for (const role of addedRoles.values()) {
    let executor = "Responsable no identificado";
    let executorId = "N/A";

    try {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 10
      });

      const entry = auditLogs.entries.find(entry => {
        const targetMatches = entry.target?.id === newMember.user.id;
        const recent = Date.now() - entry.createdTimestamp < 10000;
        return targetMatches && recent;
      });

      if (entry?.executor) {
        executor = `<@${entry.executor.id}>`;
        executorId = entry.executor.id;
      }
    } catch (error) {
      console.error("No se pudo consultar el Audit Log para rol añadido:", error);
    }

    const embed = new EmbedBuilder()
      .setTitle("🎭 Rol añadido")
      .setColor(0xB8860B)
      .addFields(
        { name: "Usuario", value: `<@${newMember.user.id}>`, inline: false },
        { name: "ID usuario", value: newMember.user.id, inline: false },
        { name: "Rol", value: `<@&${role.id}>`, inline: false },
        { name: "ID rol", value: role.id, inline: false },
        { name: "Realizado por", value: executor, inline: false },
        { name: "ID responsable", value: executorId, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  for (const role of removedRoles.values()) {
    let executor = "Responsable no identificado";
    let executorId = "N/A";

    try {
      const auditLogs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 10
      });

      const entry = auditLogs.entries.find(entry => {
        const targetMatches = entry.target?.id === newMember.user.id;
        const recent = Date.now() - entry.createdTimestamp < 10000;
        return targetMatches && recent;
      });

      if (entry?.executor) {
        executor = `<@${entry.executor.id}>`;
        executorId = entry.executor.id;
      }
    } catch (error) {
      console.error("No se pudo consultar el Audit Log para rol quitado:", error);
    }

    const embed = new EmbedBuilder()
      .setTitle("🎭 Rol quitado")
      .setColor(0xB8860B)
      .addFields(
        { name: "Usuario", value: `<@${newMember.user.id}>`, inline: false },
        { name: "ID usuario", value: newMember.user.id, inline: false },
        { name: "Rol", value: `<@&${role.id}>`, inline: false },
        { name: "ID rol", value: role.id, inline: false },
        { name: "Realizado por", value: executor, inline: false },
        { name: "ID responsable", value: executorId, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
});


client.on(Events.UserUpdate, async (oldUser, newUser) => {
  if (oldUser.avatar === newUser.avatar) return;

  const guilds = client.guilds.cache;

  for (const guild of guilds.values()) {
    const member = await guild.members.fetch(newUser.id).catch(() => null);
    if (!member) continue;

    const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
    const channelId = logChannels[guild.id]?.general;
    if (!channelId) continue;

    const logChannel = await guild.channels.fetch(channelId).catch(() => null);
    if (!logChannel) continue;

    const embed = new EmbedBuilder()
      .setTitle("🖼️ Avatar cambiado")
      .setColor(0xB8860B)
      .addFields(
        { name: "Usuario", value: `<@${newUser.id}>`, inline: false },
        { name: "ID usuario", value: newUser.id, inline: false },
        { name: "Avatar anterior", value: oldUser.avatar ? "Disponible" : "Sin avatar", inline: false },
        { name: "Avatar nuevo", value: newUser.avatar ? "Disponible" : "Sin avatar", inline: false }
      )
      .setThumbnail(newUser.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  const member = newState.member || oldState.member;
  if (!member) return;

  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[member.guild.id]?.general;
  if (!channelId) return;

  const logChannel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  let title;
  let fields = [
    { name: "Usuario", value: `<@${member.user.id}>`, inline: false },
    { name: "ID usuario", value: member.user.id, inline: false }
  ];

  if (!oldState.channelId && newState.channelId) {
    title = "🔊 Entró a voz";
    fields.push({
      name: "Canal",
      value: `<#${newState.channelId}>`,
      inline: false
    });
  } else if (oldState.channelId && !newState.channelId) {
    title = "🔊 Salió de voz";
    fields.push({
      name: "Canal",
      value: `<#${oldState.channelId}>`,
      inline: false
    });
  } else {
    title = "🔄 Cambió de canal de voz";
    fields.push(
      {
        name: "Canal anterior",
        value: `<#${oldState.channelId}>`,
        inline: false
      },
      {
        name: "Canal nuevo",
        value: `<#${newState.channelId}>`,
        inline: false
      }
    );
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xB8860B)
    .addFields(fields)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});


client.on(Events.ChannelCreate, async channel => {
  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[channel.guild?.id]?.seguridad;
  if (!channelId) return;

  const logChannel = await channel.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  let executor = "Responsable no identificado";
  let executorId = "N/A";

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelCreate,
      limit: 10
    });

    const entry = auditLogs.entries.find(entry => {
      const targetMatches = entry.target?.id === channel.id;
      const recent = Date.now() - entry.createdTimestamp < 10000;
      return targetMatches && recent;
    });

    if (entry?.executor) {
      executor = `<@${entry.executor.id}>`;
      executorId = entry.executor.id;
    }
  } catch (error) {
    console.error("No se pudo consultar el Audit Log para canal creado:", error);
  }

  const embed = new EmbedBuilder()
    .setTitle("🆕 Canal creado")
    .setColor(0xB8860B)
    .addFields(
      { name: "Canal", value: `<#${channel.id}>`, inline: false },
      { name: "ID canal", value: channel.id, inline: false },
      { name: "Tipo", value: channel.type.toString(), inline: false },
      { name: "Creado por", value: executor, inline: false },
      { name: "ID responsable", value: executorId, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
  const nameChanged = oldChannel.name !== newChannel.name;
  const parentChanged = oldChannel.parentId !== newChannel.parentId;
  const permissionsChanged = !oldChannel.permissionOverwrites.cache.equals(newChannel.permissionOverwrites.cache);

  if (!nameChanged && !parentChanged && !permissionsChanged) return;

  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[newChannel.guild?.id]?.seguridad;
  if (!channelId) return;

  const logChannel = await newChannel.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  let executor = "Responsable no identificado";
  let executorId = "N/A";

  try {
    const auditLogs = await newChannel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelUpdate,
      limit: 10
    });

    const entry = auditLogs.entries.find(entry => {
      const targetMatches = entry.target?.id === newChannel.id;
      const recent = Date.now() - entry.createdTimestamp < 10000;
      return targetMatches && recent;
    });

    if (entry?.executor) {
      executor = `<@${entry.executor.id}>`;
      executorId = entry.executor.id;
    }
  } catch (error) {
    console.error("No se pudo consultar el Audit Log para canal modificado:", error);
  }

  if (permissionsChanged) {
    const permissionChanges = [];

    const overwriteIds = new Set([
      ...oldChannel.permissionOverwrites.cache.keys(),
      ...newChannel.permissionOverwrites.cache.keys()
    ]);

    for (const id of overwriteIds) {
      const oldOverwrite = oldChannel.permissionOverwrites.cache.get(id);
      const newOverwrite = newChannel.permissionOverwrites.cache.get(id);

      const oldAllow = oldOverwrite?.allow.toArray() || [];
      const newAllow = newOverwrite?.allow.toArray() || [];
      const oldDeny = oldOverwrite?.deny.toArray() || [];
      const newDeny = newOverwrite?.deny.toArray() || [];

      const addedAllow = newAllow.filter(permission => !oldAllow.includes(permission));
      const removedAllow = oldAllow.filter(permission => !newAllow.includes(permission));
      const addedDeny = newDeny.filter(permission => !oldDeny.includes(permission));
      const removedDeny = oldDeny.filter(permission => !newDeny.includes(permission));

      if (addedAllow.length || removedAllow.length || addedDeny.length || removedDeny.length) {
        const target = newOverwrite?.type === 0
          ? `<@&${id}>`
          : `<@${id}>`;

        let details = `${target}`;

        if (addedAllow.length) details += `\nPermitidos añadidos: ${addedAllow.join(", ")}`;
        if (removedAllow.length) details += `\nPermitidos retirados: ${removedAllow.join(", ")}`;
        if (addedDeny.length) details += `\nDenegados añadidos: ${addedDeny.join(", ")}`;
        if (removedDeny.length) details += `\nDenegados retirados: ${removedDeny.join(", ")}`;

        permissionChanges.push(details);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🔐 Permisos de canal modificados")
      .setColor(0xB8860B)
      .addFields(
        { name: "Canal", value: `<#${newChannel.id}>`, inline: false },
        { name: "ID canal", value: newChannel.id, inline: false },
        { name: "Cambios", value: permissionChanges.join("\n\n") || "Cambios de permisos detectados", inline: false },
        { name: "Modificado por", value: executor, inline: false },
        { name: "ID responsable", value: executorId, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  if (!nameChanged && !parentChanged) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Canal modificado")
    .setColor(0xB8860B)
    .addFields(
      { name: "Canal", value: `<#${newChannel.id}>`, inline: false },
      { name: "ID canal", value: newChannel.id, inline: false },
      { name: "Nombre anterior", value: oldChannel.name || "Sin nombre", inline: false },
      { name: "Nombre nuevo", value: newChannel.name || "Sin nombre", inline: false },
      { name: "Modificado por", value: executor, inline: false },
      { name: "ID responsable", value: executorId, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
  if (oldRole.permissions.equals(newRole.permissions)) return;

  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[newRole.guild.id]?.seguridad;
  if (!channelId) return;

  const logChannel = await newRole.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  let executor = "Responsable no identificado";
  let executorId = "N/A";

  try {
    const auditLogs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 10
    });

    const entry = auditLogs.entries.find(entry => {
      const targetMatches = entry.target?.id === newRole.id;
      const recent = Date.now() - entry.createdTimestamp < 10000;
      return targetMatches && recent;
    });

    if (entry?.executor) {
      executor = `<@${entry.executor.id}>`;
      executorId = entry.executor.id;
    }
  } catch (error) {
    console.error("No se pudo consultar el Audit Log para permisos de rol:", error);
  }

  const oldPermissions = oldRole.permissions.toArray();
  const newPermissions = newRole.permissions.toArray();

  const addedPermissions = newPermissions.filter(permission => !oldPermissions.includes(permission));
  const removedPermissions = oldPermissions.filter(permission => !newPermissions.includes(permission));

  const embed = new EmbedBuilder()
    .setTitle("🛡️ Permisos de rol modificados")
    .setColor(0xB8860B)
    .addFields(
      { name: "Rol", value: `<@&${newRole.id}>`, inline: false },
      { name: "ID rol", value: newRole.id, inline: false },
      { name: "Permisos añadidos", value: addedPermissions.join(", ") || "Ninguno", inline: false },
      { name: "Permisos retirados", value: removedPermissions.join(", ") || "Ninguno", inline: false },
      { name: "Modificado por", value: executor, inline: false },
      { name: "ID responsable", value: executorId, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.ChannelDelete, async channel => {
  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[channel.guild?.id]?.seguridad;
  if (!channelId) return;

  const logChannel = await channel.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  let executor = "Responsable no identificado";
  let executorId = "N/A";

  try {
    const auditLogs = await channel.guild.fetchAuditLogs({
      type: AuditLogEvent.ChannelDelete,
      limit: 10
    });

    const entry = auditLogs.entries.find(entry => {
      const targetMatches = entry.target?.id === channel.id;
      const recent = Date.now() - entry.createdTimestamp < 10000;
      return targetMatches && recent;
    });

    if (entry?.executor) {
      executor = `<@${entry.executor.id}>`;
      executorId = entry.executor.id;
    }
  } catch (error) {
    console.error("No se pudo consultar el Audit Log para canal eliminado:", error);
  }

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Canal eliminado")
    .setColor(0x8B0000)
    .addFields(
      { name: "Canal", value: channel.name || "Sin nombre", inline: false },
      { name: "ID canal", value: channel.id, inline: false },
      { name: "Eliminado por", value: executor, inline: false },
      { name: "ID responsable", value: executorId, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.ThreadCreate, async thread => {
  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[thread.guild?.id]?.general;
  if (!channelId) return;

  const logChannel = await thread.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle("🧵 Hilo creado")
    .setColor(0xB8860B)
    .addFields(
      { name: "Usuario", value: thread.ownerId ? `<@${thread.ownerId}>` : "No identificado", inline: false },
      { name: "ID usuario", value: thread.ownerId || "N/A", inline: false },
      { name: "Hilo", value: thread.name || "Sin nombre", inline: false },
      { name: "ID hilo", value: thread.id, inline: false },
      { name: "Canal", value: `<#${thread.parentId}>`, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on(Events.ThreadUpdate, async (oldThread, newThread) => {
  const nameChanged = oldThread.name !== newThread.name;
  const archivedChanged = oldThread.archived !== newThread.archived;

  if (!nameChanged && !archivedChanged) return;

  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[newThread.guild?.id]?.general;
  if (!channelId) return;

  const logChannel = await newThread.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  if (nameChanged) {
    const embed = new EmbedBuilder()
      .setTitle("✏️ Hilo modificado")
      .setColor(0xB8860B)
      .addFields(
        { name: "Hilo", value: newThread.name || "Sin nombre", inline: false },
        { name: "ID hilo", value: newThread.id, inline: false },
        { name: "Nombre anterior", value: oldThread.name || "Sin nombre", inline: false },
        { name: "Nombre nuevo", value: newThread.name || "Sin nombre", inline: false },
        { name: "Canal", value: `<#${newThread.parentId}>`, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }

  if (archivedChanged) {
    const embed = new EmbedBuilder()
      .setTitle(newThread.archived ? "🔒 Hilo archivado" : "🔓 Hilo reabierto")
      .setColor(0xB8860B)
      .addFields(
        { name: "Hilo", value: newThread.name || "Sin nombre", inline: false },
        { name: "ID hilo", value: newThread.id, inline: false },
        { name: "Canal", value: `<#${newThread.parentId}>`, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
});

client.on(Events.ThreadDelete, async thread => {
  const logChannels = readJson(path.join(dataDir, "log_channels.json"), {});
  const channelId = logChannels[thread.guild?.id]?.general;
  if (!channelId) return;

  const logChannel = await thread.guild.channels.fetch(channelId).catch(() => null);
  if (!logChannel) return;

  let executor = "Responsable no identificado";
  let executorId = "N/A";

  try {
    const auditLogs = await thread.guild.fetchAuditLogs({
      type: AuditLogEvent.ThreadDelete,
      limit: 10
    });

    const entry = auditLogs.entries.find(entry => {
      const targetMatches = entry.target?.id === thread.id;
      const recent = Date.now() - entry.createdTimestamp < 10000;
      return targetMatches && recent;
    });

    if (entry?.executor) {
      executor = `<@${entry.executor.id}>`;
      executorId = entry.executor.id;
    }
  } catch (error) {
    console.error("No se pudo consultar el Audit Log para hilo eliminado:", error);
  }

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Hilo eliminado")
    .setColor(0x8B0000)
    .addFields(
      { name: "Hilo", value: thread.name || "Sin nombre", inline: false },
      { name: "ID hilo", value: thread.id, inline: false },
      { name: "Canal", value: thread.parentId ? `<#${thread.parentId}>` : "No disponible", inline: false },
      { name: "Eliminado por", value: executor, inline: false },
      { name: "ID responsable", value: executorId, inline: false }
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);





process.on("uncaughtException", async error => {
  console.error("ERROR NO CONTROLADO:", error);

  await sendBotSecurityLog(
    "🚨 Error crítico del bot",
    `Se produjo un error no controlado.\n\n\`${String(error.message || error).slice(0, 900)}\``,
    0x8B0000
  );
});

process.on("unhandledRejection", async error => {
  console.error("PROMESA RECHAZADA:", error);

  await sendBotSecurityLog(
    "⚠️ Error del bot",
    `Una promesa produjo un error no controlado.\n\n\`${String(error?.message || error).slice(0, 900)}\``,
    0x8B0000
  );
});

process.on("SIGINT", async () => {
  await sendBotSecurityLog(
    "🔴 Bot detenido",
    "Tempered está siendo detenido manualmente."
  );

  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await sendBotSecurityLog(
    "🔴 Bot detenido",
    "Tempered está siendo detenido por el sistema."
  );

  client.destroy();
  process.exit(0);
});
