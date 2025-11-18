const {
    Client,
    Events,
    GatewayIntentBits,
    AttachmentBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
    PermissionFlagsBits,
    PermissionsBitField,
    Partials,
    ChannelType,
} = require('discord.js');

require('dotenv').config();
const fs = require('fs');

// Read Discord token from environment
const token = process.env.DISCORD_TOKEN;

const ai = require('./aiClient');
const db = require('../db');

const cooldowns = new Map();
const cooldownAmount = 30 * 60 * 1000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Load settings file. Default to root-level `settings.json` to make configuration simple.
const settingsFilePath = process.env.SETTINGS_FILE || './settings.json';
if (!fs.existsSync(settingsFilePath)) {
    console.error(`Missing settings file: ${settingsFilePath}. Please create it from settings.example.json and set SETTINGS_FILE.`);
    process.exit(1);
}
const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));

if (!settings.promptSystem || (Array.isArray(settings.promptSystem) && settings.promptSystem.length === 0) || (typeof settings.promptSystem === 'string' && settings.promptSystem.trim().length === 0)) {
    console.error('settings.promptSystem is required and must be a non-empty string or array in your settings JSON. Check settings.example.json');
    process.exit(1);
}
if (!Array.isArray(settings.punishMessages) || settings.punishMessages.length === 0) {
    console.error('settings.punishMessages is required and must be a non-empty array in your settings JSON. Check settings.example.json');
    process.exit(1);
}
// Validate faith.levels presence and completeness: keys -5..5 are mandatory
if (!settings.faith || !settings.faith.levels) {
    console.error('settings.json must include `faith.levels` mapping with keys -5..5. See settings.example.json');
    process.exit(1);
}
for (let i = -5; i <= 5; i++) {
    if (!(i.toString() in settings.faith.levels)) {
        console.error(`settings.json is missing faith.levels[${i}]. Please update ${settingsFilePath}`);
        process.exit(1);
    }
}

// Build system prompt
const promptSystem = Array.isArray(settings.promptSystem) ? settings.promptSystem.join('\n') : settings.promptSystem;

const messageMemory = [
    { role: 'system', content: promptSystem },
];

client.login(token);


client.once(Events.ClientReady, async () => {
    // Récupère le guild après connexion
    const guildId = "960831251126824980";
    let guild = client.guilds.cache.get(guildId);
    if (!guild) {
        try {
            guild = await client.guilds.fetch(guildId);
        } catch (err) {
            console.warn(`Warning: unable to fetch guild ${guildId}. Slash commands won't be registered:`, err);
            return;
        }
    }
    // Commands like eval and faith
    const evalCmd = new SlashCommandBuilder()
        .setName('eval')
        .setDescription('Évalue du code JavaScript')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option => option.setName('code').setDescription('Le code à évaluer').setRequired(true));

    await guild.commands.create(evalCmd);

    const faithCmd = new SlashCommandBuilder()
        .setName('faith')
        .setDescription("Affiche la foi d'un utilisateur")
        .addUserOption(option => option.setName('user').setDescription('Utilisateur'));

    await guild.commands.create(faithCmd);
    console.log('run');
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content) return;
    if (!message.guild) return;

    if (message.guild.id !== '960831251126824980') return; // only on sanctuary server

    if (message.content.includes('<@959427012194349088>')) {
        chatGpt(message, `${message.member.nickname} s'adresse à toi :`);
    } else if (Math.random() >= 0.982) {
        chatGpt(message, ` tu interceptes un message de ${message.member.nickname}, mais il ne s'adressai pas à toi, il est donc sorti de son contexte`);
    } else if (message.reference) {
        try {
            const referencedMessage = await message.fetchReference();
            if (referencedMessage.author.id === client.user.id) chatGpt(message, `${message.member.nickname} répond à ton message "${referencedMessage.content}" : `)
        } catch (error) {
            console.error('Failed to fetch the referenced message:', error);
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    const { commandName, options } = interaction;

        if (commandName === 'faith') {
            // Simple `/faith [user]` command (no subcommands). Defaults to the invoker if no user is provided.
            const user = options.getUser('user') || interaction.user;
            try {
                const u = await db.getFaith(interaction.guild.id, user.id) || { faith_level: 0, label: db.LEVELS['0'] };
                await interaction.reply({ content: `La foi de ${user.username} : ${u.faith_level} (${u.label || 'Neutre'})` });
            } catch (err) {
                console.error('Error while handling /faith command:', err);
                await interaction.reply({ content: 'Impossible de récupérer la foi (erreur serveur).', ephemeral: true });
            }
    } else if (commandName === 'ping') {
        await interaction.reply('pong');
    } else if (commandName === 'eval' && interaction.member.id === '693374876815458346') {
        const code = options.getString('code');
        try {
            const result = eval(code);
            await interaction.reply({ content: `Résultat : ${result}` });
        } catch (error) {
            await interaction.reply({ content: `Erreur : ${error.message}` });
        }
    }
});

client.on(Events.GuildMemberAdd, async (member) => {
    try {
        const guildConfigs = settings.guildConfigs || {};
        const cfg = guildConfigs[member.guild.id];
        if (cfg) {
            if (cfg.welcomeChannelId) {
                const welcomeChannel = member.guild.channels.cache.get(cfg.welcomeChannelId);
                if (welcomeChannel) {
                    const text = (typeof cfg.welcomeMessage === 'string') ? cfg.welcomeMessage.replace('{member}', member) : '';
                    if (text && text.length) welcomeChannel.send(text);
                }
            }
            if (cfg.roleId) {
                const role = member.guild.roles.cache.get(cfg.roleId);
                if (role) await member.roles.add(role);
            }
        }
    } catch (err) {
        console.log(err);
    }
});

async function chatGpt(message, variation) {
    message.channel.sendTyping();

    messageMemory.push({
        role: `user`,
        content: `${variation} : "${message.content.replace("<@959427012194349088>", "")}"`
    })

    if (messageMemory.length >= 30) {
        messageMemory.splice(-2, 1);
        messageMemory.splice(-3, 1);
    }

    async function main() {
        const control = {
            role: 'system',
            content: 'Return ONLY a JSON object with keys: message (string), faith_change (int, optional), update (boolean, optional), punish (boolean, optional). If you cannot, return plain JSON with keys message and update=false.'
        };

        const completion = await ai.sendChat([control, ...messageMemory], process.env.AI_MODEL || 'gpt-3.5-turbo');

        const raw = completion.choices[0].message.content;
        let parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            parsed = { message: raw, faith_change: 0, update: false };
        }

        await message.reply(parsed.message || raw);
        messageMemory.push({ role: `assistant`, content: `${raw}` });

        if (parsed.update && parsed.faith_change && parsed.faith_change !== 0) {
            try {
                const cur = await db.getFaith(message.guild.id, message.author.id);
                const last = new Date(cur?.updated_at || 0);
                const now = new Date();
                const minutes = parseInt(process.env.FAITH_UPDATE_COOLDOWN_MINUTES || '60', 10);
                if ((now - last) / 60000 >= minutes) {
                    await db.addFaith(message.guild.id, message.author.id, parsed.faith_change);
                }
            } catch (e) {
                console.error('Error updating faith:', e);
            }
        }

        if (parsed.punish) {
            try {
                console.log('un membre doit être puni (model indiqué punish:true)');
                const roleId = settings.punishRoleId;
                if (roleId) {
                    const role = message.guild.roles.cache.get(roleId);
                    if (role) await message.member.roles.add(role);
                }

                const phrases = settings.punishMessages;
                if (phrases.length > 0) {
                    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
                    message.author.send(`${phrase}`);
                }

                messageMemory.push({
                    role: `user`,
                    content: `LOG : ${message.author.nickname} a été puni (punish=true).`
                });
            } catch (err) {
                console.error('Erreur lors de l\'application de la punition :', err);
            }
        }
    }

    try {
        await main();
    } catch (err) {
        console.log(err);
    }
}

module.exports = { client };
