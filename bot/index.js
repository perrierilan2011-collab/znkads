/**
 * ZNK Ads — Bot Discord
 * Gère l'ouverture et la fermeture des tickets (retraits & support).
 *
 * Variables d'environnement (fichier bot/.env) :
 *   DISCORD_BOT_TOKEN
 *   DISCORD_GUILD_ID
 *   DISCORD_TICKET_CATEGORY_ID
 *   DISCORD_STAFF_ROLE_ID        (optionnel — rôle autorisé dans les tickets)
 *   SUPABASE_URL                 (optionnel — pour la commande /stats)
 *   SUPABASE_SERVICE_ROLE_KEY    (optionnel)
 */

import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CATEGORY_ID = process.env.DISCORD_TICKET_CATEGORY_ID || null;
const STAFF_ROLE_ID = process.env.DISCORD_STAFF_ROLE_ID || null;

if (!TOKEN || !GUILD_ID) {
  console.error(
    "❌ DISCORD_BOT_TOKEN et DISCORD_GUILD_ID sont obligatoires (voir bot/.env)."
  );
  process.exit(1);
}

const PURPLE = 0x8b5cf6;

const commands = [
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ouvre un ticket privé avec l'équipe ZNK Ads")
    .addStringOption((o) =>
      o
        .setName("sujet")
        .setDescription("Sujet du ticket (retrait, problème, question…)")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Ferme le ticket courant"),
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Affiche les statistiques de la plateforme ZNK Ads"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands,
  });
  console.log("✅ Commandes slash enregistrées.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (err) {
    console.error("Enregistrement des commandes échoué :", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ticket") {
      await handleTicket(interaction);
    } else if (interaction.commandName === "close") {
      await handleClose(interaction);
    } else if (interaction.commandName === "stats") {
      await handleStats(interaction);
    }
  } catch (err) {
    console.error("Erreur interaction :", err);
    const payload = { content: "❌ Une erreur est survenue.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

async function handleTicket(interaction) {
  const guild = interaction.guild;
  const subject = interaction.options.getString("sujet") || "Support général";

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];
  if (STAFF_ROLE_ID) {
    overwrites.push({
      id: STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const name = `ticket-${interaction.user.username}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 90);

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: CATEGORY_ID || undefined,
    topic: `Ticket • ${interaction.user.id}`,
    permissionOverwrites: overwrites,
  });

  const embed = new EmbedBuilder()
    .setTitle("Nouveau ticket — ZNK Ads")
    .setColor(PURPLE)
    .addFields(
      { name: "Utilisateur", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Identifiant", value: `\`${interaction.user.id}\``, inline: true },
      { name: "Sujet", value: subject, inline: false }
    )
    .setFooter({ text: "Utilise /close pour fermer ce ticket." })
    .setTimestamp();

  await channel.send({
    content: `<@${interaction.user.id}> — un membre de l'équipe va te répondre ici.`,
    embeds: [embed],
  });

  await interaction.reply({
    content: `✅ Ticket ouvert : <#${channel.id}>`,
    ephemeral: true,
  });
}

async function handleClose(interaction) {
  const channel = interaction.channel;
  const isTicket = channel.name.startsWith("ticket-");
  if (!isTicket) {
    return interaction.reply({
      content: "❌ Cette commande s'utilise dans un salon de ticket.",
      ephemeral: true,
    });
  }

  await interaction.reply({ content: "🔒 Fermeture du ticket dans 5 secondes…" });
  setTimeout(() => {
    channel.delete("Ticket fermé").catch(() => {});
  }, 5000);
}

async function handleStats(interaction) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return interaction.reply({
      content: "ℹ️ Supabase n'est pas configuré pour le bot.",
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [usersRes, viewsRes] = await Promise.all([
    fetch(`${url}/rest/v1/users?select=id`, {
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
    }),
    fetch(`${url}/rest/v1/ad_views?select=id&status=eq.validated`, {
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
    }),
  ]);

  const count = (res) => {
    const range = res.headers.get("content-range") || "0-0/0";
    return Number(range.split("/")[1] || 0);
  };

  const embed = new EmbedBuilder()
    .setTitle("📊 Statistiques ZNK Ads")
    .setColor(PURPLE)
    .addFields(
      { name: "Utilisateurs", value: String(count(usersRes)), inline: true },
      { name: "Vues validées", value: String(count(viewsRes)), inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

client.login(TOKEN);
