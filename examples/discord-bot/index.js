/**
 * ZNK ADS — Exemple de bot Discord.js
 *
 * Ce bot interroge l'API sécurisée de ZNK ADS et permet à des administrateurs
 * de faire évoluer le statut d'une demande de retrait.
 *
 * Le bot ne modifie JAMAIS un solde directement : il ne peut que lire des
 * données et changer le statut d'un retrait via une opération contrôlée.
 *
 * Configuration : copier .env.example vers .env puis remplir les valeurs.
 */

require('dotenv').config()

const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js')

const TOKEN = process.env.DISCORD_BOT_TOKEN || ''
const API_URL = (process.env.ZNK_API_URL || '').replace(/\/+$/, '')
const API_SECRET = process.env.ZNK_BOT_API_SECRET || ''
const GUILD_ID = process.env.DISCORD_GUILD_ID || ''

const EMBED_COLOR = 0x8b5cf6

const TRANSACTION_LABELS = {
  ad_reward: 'Publicité validée',
  referral_signup: 'Bonus de parrainage',
  referral_ad: 'Palier de parrainage',
  withdrawal_request: 'Demande de retrait',
  withdrawal_refund: 'Remboursement de retrait',
  adjustment: 'Ajustement'
}

const WITHDRAWAL_LABELS = {
  pending: 'En attente',
  processing: 'En cours',
  accepted: 'Accepté',
  rejected: 'Refusé',
  paid: 'Payé'
}

// ------------------------------------------------------------
// Vérification de la configuration
// ------------------------------------------------------------

function fail(message) {
  console.error(`[config] ${message}`)
  process.exit(1)
}

if (!TOKEN) fail('DISCORD_BOT_TOKEN est manquant.')
if (!API_URL) fail('ZNK_API_URL est manquant.')
if (!API_SECRET) fail('ZNK_BOT_API_SECRET est manquant.')
if (API_SECRET.length < 32) {
  fail('ZNK_BOT_API_SECRET doit contenir au moins 32 caractères.')
}

// ------------------------------------------------------------
// Client API ZNK ADS
// ------------------------------------------------------------

async function api(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${API_SECRET}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })

    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.ok) {
      const error = new Error(data?.message || `Erreur API (${response.status}).`)
      error.code = data?.error || 'API_ERROR'
      error.status = response.status
      throw error
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("L'API ZNK ADS ne répond pas.")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

// ------------------------------------------------------------
// Formatage
// ------------------------------------------------------------

function formatMoney(cents, currency = 'EUR') {
  const value = Number(cents || 0) / 100
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

function formatSignedMoney(cents, currency = 'EUR') {
  const prefix = Number(cents) > 0 ? '+' : ''
  return `${prefix}${formatMoney(cents, currency)}`
}

function discordDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`
}

function typeLabel(type) {
  return TRANSACTION_LABELS[type] || type
}

function statusLabel(status) {
  return WITHDRAWAL_LABELS[status] || status
}

function isStaff(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
}

function friendlyMessage(error) {
  if (error?.code === 'USER_NOT_FOUND') {
    return "Aucun compte ZNK ADS n'est associé à cet identifiant Discord. L'utilisateur doit d'abord se connecter sur le site."
  }
  return error?.message || 'Une erreur est survenue.'
}

// ------------------------------------------------------------
// Commandes
// ------------------------------------------------------------

const commands = [
  new SlashCommandBuilder()
    .setName('solde')
    .setDescription('Affiche ton solde ZNK ADS'),

  new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Affiche le profil ZNK ADS d’un utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Utilisateur Discord (staff uniquement pour un autre membre)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('transactions')
    .setDescription('Affiche tes dernières transactions ZNK ADS')
    .addIntegerOption((option) =>
      option
        .setName('limite')
        .setDescription('Nombre de transactions (1 à 25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('retraits')
    .setDescription('Affiche tes demandes de retrait ZNK ADS')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Utilisateur Discord (staff uniquement pour un autre membre)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('retrait-statut')
    .setDescription('Met à jour le statut d’une demande de retrait (staff)')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('Identifiant UUID de la demande')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('statut')
        .setDescription('Nouveau statut')
        .setRequired(true)
        .addChoices(
          { name: 'En attente', value: 'pending' },
          { name: 'En cours', value: 'processing' },
          { name: 'Accepté', value: 'accepted' },
          { name: 'Refusé (rembourse)', value: 'rejected' },
          { name: 'Payé', value: 'paid' }
        )
    ),

  new SlashCommandBuilder()
    .setName('retraits-en-attente')
    .setDescription('Affiche la file d’attente des retraits (staff)')
].map((command) => command.toJSON())

// ------------------------------------------------------------
// Handlers
// ------------------------------------------------------------

const handlers = {
  async solde(interaction) {
    const data = await api(`/api/bot/user/${interaction.user.id}/balance`)

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('Ton portefeuille ZNK ADS')
      .addFields(
        {
          name: 'Solde disponible',
          value: formatMoney(data.balance_cents, data.currency),
          inline: true
        },
        {
          name: 'Total gagné',
          value: formatMoney(data.total_earned_cents, data.currency),
          inline: true
        },
        {
          name: 'Publicités validées',
          value: `${data.validated_ads} (aujourd’hui : ${data.validated_ads_today})`,
          inline: true
        },
        {
          name: 'Parrainages',
          value: String(data.referrals_count),
          inline: true
        }
      )
      .setFooter({ text: 'ZNK ADS' })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  },

  async profil(interaction) {
    const target = interaction.options.getUser('utilisateur') || interaction.user

    if (target.id !== interaction.user.id && !isStaff(interaction)) {
      await interaction.editReply({
        content: 'Vous ne pouvez consulter que votre propre profil.'
      })
      return
    }

    const { profile } = await api(`/api/bot/user/${target.id}`)
    const user = profile.user
    const wallet = profile.wallet
    const currency = profile.currency || 'EUR'

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`Profil ZNK ADS — ${user.discord_username}`)
      .addFields(
        {
          name: 'Solde disponible',
          value: formatMoney(user.balance_cents, currency),
          inline: true
        },
        {
          name: 'Total gagné',
          value: formatMoney(user.total_earned_cents, currency),
          inline: true
        },
        {
          name: 'Publicités validées',
          value: `${wallet.validated_ads} (aujourd’hui : ${wallet.validated_ads_today})`,
          inline: true
        },
        {
          name: 'Parrainages',
          value: String(wallet.referrals_count),
          inline: true
        },
        { name: 'Code de parrainage', value: user.referral_code, inline: true },
        { name: 'Identifiant Discord', value: user.discord_id, inline: true }
      )
      .setFooter({ text: 'ZNK ADS' })
      .setTimestamp()

    if (user.discord_avatar) embed.setThumbnail(user.discord_avatar)

    if (profile.transactions?.length) {
      const recent = profile.transactions
        .slice(0, 5)
        .map(
          (transaction) =>
            `${formatSignedMoney(transaction.amount_cents, currency)} — ${typeLabel(
              transaction.type
            )} (${discordDate(transaction.created_at)})`
        )
        .join('\n')

      embed.addFields({ name: 'Dernières transactions', value: recent })
    }

    await interaction.editReply({ embeds: [embed] })
  },

  async transactions(interaction) {
    const limit = interaction.options.getInteger('limite') || 10
    const { transactions } = await api(
      `/api/bot/user/${interaction.user.id}/transactions?limit=${limit}`
    )

    if (!transactions.length) {
      await interaction.editReply({
        content: 'Aucune transaction pour le moment.'
      })
      return
    }

    const description = transactions
      .map(
        (transaction) =>
          `**${formatSignedMoney(transaction.amount_cents)}** · ${typeLabel(
            transaction.type
          )}\n${discordDate(transaction.created_at)}${
            transaction.description ? ` · ${transaction.description}` : ''
          }`
      )
      .join('\n\n')

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('Tes dernières transactions')
      .setDescription(description.slice(0, 4000))
      .setFooter({ text: `ZNK ADS · ${transactions.length} transaction(s)` })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  },

  async retraits(interaction) {
    const target = interaction.options.getUser('utilisateur') || interaction.user

    if (target.id !== interaction.user.id && !isStaff(interaction)) {
      await interaction.editReply({
        content: 'Vous ne pouvez consulter que vos propres retraits.'
      })
      return
    }

    const { withdrawals } = await api(
      `/api/bot/user/${target.id}/withdrawals?limit=15`
    )

    if (!withdrawals.length) {
      await interaction.editReply({
        content: 'Aucune demande de retrait pour cet utilisateur.'
      })
      return
    }

    const description = withdrawals
      .map(
        (withdrawal) =>
          `**${formatMoney(withdrawal.amount_cents)}** · ${statusLabel(
            withdrawal.status
          )}\n${discordDate(withdrawal.created_at)} · \`${withdrawal.id}\``
      )
      .join('\n\n')

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`Demandes de retrait — ${target.username}`)
      .setDescription(description.slice(0, 4000))
      .setFooter({ text: 'ZNK ADS' })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  },

  async 'retrait-statut'(interaction) {
    if (!isStaff(interaction)) {
      await interaction.editReply({
        content: 'Cette commande est réservée aux administrateurs (Gérer le serveur).'
      })
      return
    }

    const id = interaction.options.getString('id', true).trim()
    const status = interaction.options.getString('statut', true)

    const { withdrawal } = await api(`/api/bot/withdrawals/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })

    const lines = [
      `Statut demandé : **${statusLabel(status)}**`,
      `Transition appliquée : ${withdrawal.changed ? 'oui' : 'non (déjà à ce statut)'}`,
      `Remboursement : ${withdrawal.refunded ? 'oui' : 'non'}`,
      `Montant : ${formatMoney(withdrawal.amount_cents)}`
    ]

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('Demande de retrait mise à jour')
      .setDescription(lines.join('\n'))
      .addFields({ name: 'Identifiant', value: `\`${withdrawal.withdrawal_id}\`` })
      .setFooter({ text: 'ZNK ADS' })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  },

  async 'retraits-en-attente'(interaction) {
    if (!isStaff(interaction)) {
      await interaction.editReply({
        content: 'Cette commande est réservée aux administrateurs (Gérer le serveur).'
      })
      return
    }

    const { withdrawals } = await api('/api/bot/withdrawals?status=pending&limit=20')

    if (!withdrawals.length) {
      await interaction.editReply({
        content: 'Aucune demande de retrait en attente.'
      })
      return
    }

    const description = withdrawals
      .map((withdrawal) => {
        const relatedUser = Array.isArray(withdrawal.user)
          ? withdrawal.user[0]
          : withdrawal.user
        const username = relatedUser?.discord_username || 'Inconnu'

        return `**${formatMoney(withdrawal.amount_cents)}** · ${username} (\`${
          withdrawal.discord_id
        }\`)\n${discordDate(withdrawal.created_at)} · \`${withdrawal.id}\``
      })
      .join('\n\n')

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('Retraits en attente')
      .setDescription(description.slice(0, 4000))
      .setFooter({
        text: `ZNK ADS · ${withdrawals.length} demande(s) · /retrait-statut pour traiter`
      })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  }
}

// ------------------------------------------------------------
// Client Discord
// ------------------------------------------------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[bot] connecté en tant que ${readyClient.user.tag}`)

  try {
    const rest = new REST().setToken(TOKEN)

    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(readyClient.user.id, GUILD_ID),
        { body: commands }
      )
      console.log(`[bot] ${commands.length} commandes enregistrées sur le serveur ${GUILD_ID}`)
    } else {
      await rest.put(Routes.applicationCommands(readyClient.user.id), {
        body: commands
      })
      console.log(`[bot] ${commands.length} commandes globales enregistrées`)
    }
  } catch (error) {
    console.error('[bot] enregistrement des commandes impossible', error)
  }
})

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const handler = handlers[interaction.commandName]
  if (!handler) return

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    await handler(interaction)
  } catch (error) {
    console.error(`[bot] commande /${interaction.commandName} en échec`, {
      code: error?.code,
      message: error?.message
    })

    const content = `Erreur : ${friendlyMessage(error)}`

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content })
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral })
      }
    } catch {
      // L'interaction a peut-être expiré : rien de plus à faire.
    }
  }
})

client.login(TOKEN)
