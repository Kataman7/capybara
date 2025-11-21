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

const promptSystem = Array.isArray(settings.promptSystem) ? settings.promptSystem.join('\n') : settings.promptSystem;

// Mémoire de conversation par utilisateur
const messageMemories = new Map();

function getMemoryForUser(userId) {
    if (!messageMemories.has(userId)) {
        messageMemories.set(userId, [
            { role: 'system', content: promptSystem }
        ]);
    }
    return messageMemories.get(userId);
}

const scenarioService = createScenarioService(ai, settings);

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

async function chatGpt(message, variation) {
    message.channel.sendTyping();

    const messageMemory = getMemoryForUser(message.author.id);

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
            content: 'Return ONLY a JSON object with keys: message (string), faith_change (int, optional and must be one of -1, 0, 1), update (boolean, optional), punish (boolean, optional). The "faith_change" must be either -1 (decrease by one), 0 (leave the level unchanged) or 1 (increase by one)  do NOT return any other numbers. The "punish" flag should ONLY be set to true in the most extreme cases where the person\'s soul is beyond redemption - severe blasphemy or repeated unforgivable acts. Use this sparingly and only when absolutely necessary. If you cannot return a valid JSON object, return plain JSON with keys message and update=false.'
        };

        const completion = await ai.sendChat([control, ...messageMemory], process.env.AI_MODEL || 'gpt-3.5-turbo');

        const raw = completion.choices[0].message.content;
        let parsed = null;
        
        let cleanedRaw = raw.trim();
        if (cleanedRaw.startsWith('```')) {
            cleanedRaw = cleanedRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        
        try {
            parsed = JSON.parse(cleanedRaw);
        } catch (err) {
            parsed = { message: cleanedRaw, faith_change: 0, update: false };
        }

        const replyText = parsed.message || 'Erreur : aucun message reçu du divin Capybara.';
        await message.reply(replyText);
        
        messageMemory.push({ role: `assistant`, content: `${raw}` });

        if (parsed.update && typeof parsed.faith_change !== 'undefined' && parsed.faith_change !== 0) {
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
                    try {
                        await message.author.send(`${phrase}`);
                    } catch (dmErr) {
                        console.warn(`Impossible d'envoyer un DM à ${message.author.tag}: ${dmErr.message}`);
                    }
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
