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

// Toggle to control whether slash commands are synced (deleted/created) at startup.
// Set `SYNC_COMMANDS_ON_START=true` in .env to enable (default is false to prevent deletion on every reboot).
const SYNC_COMMANDS_ON_START = (process.env.SYNC_COMMANDS_ON_START || 'false').toString().toLowerCase() === 'true';
console.log('SYNC_COMMANDS_ON_START =', SYNC_COMMANDS_ON_START);
// Log whether a token is present (masked) and configured intents
console.log('DISCORD_TOKEN present=', !!process.env.DISCORD_TOKEN);
try { console.log('Configured intents:', client.options && client.options.intents ? client.options.intents : 'none'); } catch (e) {}

// Watchdog: if client not ready within 30s, dump some diagnostic info
setTimeout(() => {
    try {
        const isReady = typeof client.isReady === 'function' ? client.isReady() : !!client.ws?.status === 1;
        if (!isReady) {
            console.warn('Watchdog: client not ready after 30s. Dumping diagnostics...');
            try { console.warn('client.ws.status =', client.ws ? client.ws.status : 'no-ws'); } catch(_) {}
            try { console.warn('client.uptime =', client.uptime); } catch(_) {}
            try { console.warn('Guilds cached =', client.guilds ? client.guilds.cache.size : 'no-guilds'); } catch(_) {}
            try { console.warn('env SYNC_COMMANDS_ON_START =', process.env.SYNC_COMMANDS_ON_START); } catch(_) {}
        }
    } catch (err) {
        console.error('Watchdog error:', err);
    }
}, 30000);

// Normalize lootbox capy definitions: ensure one trigger and default weight
if (settings.lootbox && Array.isArray(settings.lootbox.capybaras)) {
    settings.lootbox.capybaras = settings.lootbox.capybaras.map((c) => {
        const out = Object.assign({}, c);
        // Ensure triggers is an array with exactly one entry
        if (!out.triggers) out.triggers = [];
        if (Array.isArray(out.triggers)) {
            if (out.triggers.length === 0) {
                // default to 'auto' if none provided
                out.triggers = ['auto'];
            } else if (out.triggers.length > 1) {
                // keep only the first trigger to enforce single-event per capy
                console.warn(`capybaras.${out.id} has multiple triggers; only the first will be used.`);
                out.triggers = [out.triggers[0]];
            }
        } else if (typeof out.triggers === 'string') {
            out.triggers = [out.triggers];
        } else {
            out.triggers = ['auto'];
        }
        // ensure weight is numeric and default to 1 for equal rarity
        out.weight = (typeof out.weight === 'number' && out.weight > 0) ? out.weight : 1;
        // ensure autofarm and duplicate_bonus_pct defaults
        out.autofarm = typeof out.autofarm === 'number' ? out.autofarm : 1;
        out.duplicate_bonus_pct = typeof out.duplicate_bonus_pct === 'number' ? out.duplicate_bonus_pct : 0.05;
        return out;
    });
}

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
function pickCapyFromSettings(settings) {
    const cfg = settings.lootbox && Array.isArray(settings.lootbox.capybaras) ? settings.lootbox.capybaras : [];
    if (!cfg.length) return null;
    const total = cfg.reduce((s, c) => s + (c.weight || 1), 0);
    let r = Math.random() * total;
    for (const c of cfg) {
        r -= (c.weight || 1);
        if (r <= 0) return c.id;
    }
    return cfg[cfg.length - 1].id;
}

// Apply capy triggers: when an event occurs (join/message/farm/voice), owners of capy
// that listen to that event receive their autofarm production immediately.
async function applyCapyTrigger(eventType, guildId, actorUserId) {
    try {
        const allKeys = await db.getAllLootKeys();
        // filter for this guild
        const rows = allKeys.filter(r => r.guild_id === guildId);

        // group by owner
        const grouped = {};
        for (const row of rows) {
            grouped[`${row.guild_id}:${row.discord_id}`] = grouped[`${row.guild_id}:${row.discord_id}`] || [];
            grouped[`${row.guild_id}:${row.discord_id}`].push(row);
        }

        for (const key of Object.keys(grouped)) {
            const [gId, ownerId] = key.split(':');
            // skip if trigger should not activate for the actor (e.g., owner performed the action)
            if (ownerId === actorUserId && (eventType === 'message' || eventType === 'farm')) continue;

            let totalAuto = 0;
            for (const row of grouped[key]) {
                const def = (settings.lootbox && settings.lootbox.capybaras || []).find(c => c.id === row.capy_id);
                if (!def) continue;
                const triggers = def.triggers || [];
                if (!triggers.includes(eventType)) continue;
                const count = row.count || 0;
                if (count <= 0) continue;
                const dupBonus = def.duplicate_bonus_pct || 0.05;
                const multiplier = 1 + dupBonus * (count - 1);
                totalAuto += (def.autofarm || 0) * count * multiplier;
            }

            if (totalAuto > 0) {
                // add watermelons produced by capy
                await db.addWatermelon(gId, ownerId, Math.floor(totalAuto), true);
                // apply full production cascade (same as if the player had done /farm)
                // This converts producer counts into their produced resources.
                try {
                    await db.applyProduction(gId, ownerId);
                } catch (e) {
                    console.error('applyCapyTrigger: applyProduction failed for', gId, ownerId, e);
                }
            }
        }
    } catch (err) {
        console.error('applyCapyTrigger failed:', err);
    }
}

console.log('Starting Discord client login...');
client.login(token).then(() => {
    console.log('client.login() resolved');
}).catch(err => {
    console.error('client.login() failed:', err);
});

client.on('error', (err) => {
    console.error('Discord client error:', err);
});
client.on('warn', (info) => {
    console.warn('Discord client warn:', info);
});
client.on('shardError', (err) => {
    console.error('Shard error:', err);
});
client.on('shardDisconnect', (event, shardId) => {
    console.warn('Shard disconnected:', shardId, event);
});
client.on('shardReconnecting', (shardId) => {
    console.warn('Shard reconnecting:', shardId);
});

client.once(Events.ClientReady, async () => {
    const guildId = process.env.PRIMARY_GUILD_ID || "960831251126824980";
    let guild = client.guilds.cache.get(guildId);
    if (!guild) {
        try {
            guild = await client.guilds.fetch(guildId);
        } catch (err) {
            console.warn(`Warning: unable to fetch guild ${guildId}. Will attempt to register global commands instead:`, err);
            if (SYNC_COMMANDS_ON_START) {
                try {
                    await commandRegistry.syncGlobalCommands(client.application);
                    console.log('Bot ready! (global commands synced)');
                } catch (err2) {
                    console.error('Failed to sync global commands:', err2);
                }
            } else {
                console.log('Bot ready! (command sync skipped by SYNC_COMMANDS_ON_START=false)');
            }
            return;
        }
    }

    if (SYNC_COMMANDS_ON_START) {
        await commandRegistry.syncGuildCommands(guild);
        console.log('Bot ready! (commands synced)');
    } else {
        console.log('Bot ready! (command sync skipped by SYNC_COMMANDS_ON_START=false)');
    }
        // Hourly job: run autofarm for capybaras that have trigger 'auto'
        const hourlyMs = 60 * 60 * 1000;
        setInterval(async () => {
            try {
                const allKeys = await db.getAllLootKeys();
                const grouped = {};
                for (const row of allKeys) {
                    const key = `${row.guild_id}:${row.discord_id}`;
                    grouped[key] = grouped[key] || [];
                    grouped[key].push(row);
                }
                for (const key of Object.keys(grouped)) {
                    const [guildId, userId] = key.split(':');
                    let totalAuto = 0;
                    for (const row of grouped[key]) {
                        const def = (settings.lootbox && settings.lootbox.capybaras || []).find(c => c.id === row.capy_id);
                        if (!def) continue;
                        // only apply for auto trigger
                        const triggers = def.triggers || [];
                        if (!triggers.includes('auto')) continue;
                        const count = row.count || 0;
                        if (count <= 0) continue;
                        const dupBonus = def.duplicate_bonus_pct || 0.05;
                        const multiplier = 1 + dupBonus * (count - 1);
                        totalAuto += def.autofarm * count * multiplier;
                    }
                    if (totalAuto > 0) {
                        await db.addWatermelon(guildId, userId, Math.floor(totalAuto), true);
                    }
                }
            } catch (err) {
                console.error('Hourly loot job failed:', err);
            }
        }, hourlyMs);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content) return;
    if (!message.guild) return;

        if (message.guild.id !== '960831251126824980') return;

        // trigger capybaras that listen to messages (owners gain autofarm when others send messages)
        try {
            applyCapyTrigger('message', message.guild.id, message.author.id);
        } catch (err) {
            console.error('Error applying capy trigger on message:', err);
        }

        if (message.content.includes('<@959427012194349088>')) {
        chatService.handleMessage(message, `${message.member.nickname} s'adresse à toi :`);
    } else if (Math.random() >= 0.982) {
        // Adoucir le ton pour les messages interceptés
        chatService.handleMessage(message, `${message.member.nickname} parle dans le sanctuaire, mais ne s'adresse pas directement au Capybara Divin. Réponds de façon neutre, bienveillante ou indifférente, sans punition ni colère. Ce n'est pas une provocation.`);
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
        WATERMELON_COOLDOWN_MS,
        applyCapyTrigger
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
            // trigger capybaras that listen to member joins (owners gain autofarm when someone joins)
            try {
                applyCapyTrigger('join', member.guild.id, member.id);
            } catch (err) {
                console.error('Error applying capy trigger on guild member add:', err);
            }
        } catch (err) {
        console.log(err);
    }
});

module.exports = { client };

        // Voice join: trigger capybaras that listen to voice joins
        client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            try {
                // joined a channel
                if (!oldState.channelId && newState.channelId) {
                    const guildId = newState.guild.id;
                    const userId = newState.member.id;
                    try {
                        applyCapyTrigger('voice', guildId, userId);
                    } catch (err) {
                        console.error('Error applying capy trigger on voice join:', err);
                    }
                }
            } catch (err) {
                console.error('Error handling voiceStateUpdate for loot:', err);
            }
        });
