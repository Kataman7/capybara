const {
    Client,
    Events,
    GatewayIntentBits,
    Partials,
} = require('discord.js');

require('dotenv').config();
const fs = require('fs');

const token = process.env.DISCORD_TOKEN;

const ai = require('./services/aiClient');
const db = require('../db');
const commandRegistry = require('./commands');
const createScenarioService = require('./services/scenarioService');
const ChatService = require('./services/chatService');

const watermelonCooldowns = new Map();
const WATERMELON_COOLDOWN_MS = (parseInt(process.env.WATERMELON_COOLDOWN_HOURS || '3', 10) * 60 * 60 * 1000);

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
if (!settings.faith || !settings.faith.levels) {
    console.error('settings.json must include `faith.levels` mapping with keys -5..20. See settings.example.json');
    process.exit(1);
}
for (let i = -5; i <= 20; i++) {
    if (!(i.toString() in settings.faith.levels)) {
        console.error(`settings.json is missing faith.levels[${i}]. Please update ${settingsFilePath}`);
        process.exit(1);
    }
}

const scenarioService = createScenarioService(ai, settings);
const chatService = new ChatService(ai, db, settings);

client.login(token);

client.once(Events.ClientReady, async () => {
    const guildId = process.env.PRIMARY_GUILD_ID || "960831251126824980";
    let guild = client.guilds.cache.get(guildId);
    if (!guild) {
        try {
            guild = await client.guilds.fetch(guildId);
        } catch (err) {
            console.warn(`Warning: unable to fetch guild ${guildId}. Slash commands won't be registered:`, err);
            return;
        }
    }
    
    await commandRegistry.syncGuildCommands(guild);
    console.log('Bot ready!');
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content) return;
    if (!message.guild) return;

    if (message.guild.id !== '960831251126824980') return;

    if (message.content.includes('<@959427012194349088>')) {
        chatService.handleMessage(message, `${message.member.nickname} s'adresse à toi :`);
    } else if (Math.random() >= 0.982) {
        chatService.handleMessage(message, ` tu interceptes un message de ${message.member.nickname}, mais il ne s'adressai pas à toi, il est donc sorti de son contexte`);
    } else if (message.reference) {
        try {
            const referencedMessage = await message.fetchReference();
            if (referencedMessage.author.id === client.user.id) chatService.handleMessage(message, `${message.member.nickname} répond à ton message "${referencedMessage.content}" : `)
        } catch (error) {
            console.error('Failed to fetch the referenced message:', error);
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    const context = {
        db,
        settings,
        ai,
        scenarioService,
        watermelonCooldowns,
        WATERMELON_COOLDOWN_MS
    };
    
    await commandRegistry.handleInteraction(interaction, context);
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

module.exports = { client };
