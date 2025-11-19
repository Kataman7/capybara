const {
    Client,
    Events,
    GatewayIntentBits,
    AttachmentBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
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
// Validate faith.levels presence and completeness: keys -5..20 are mandatory
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
        .setDescription("Affiche votre foi et vos watermelons");

    await guild.commands.create(faithCmd);

    const watermelonCmd = new SlashCommandBuilder()
        .setName('watermelon')
        .setDescription("Farmer des watermelons (cooldown 3h)");

    await guild.commands.create(watermelonCmd);

    const leaderboardCmd = new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription("Affiche le classement des watermelons et votre rang");

    await guild.commands.create(leaderboardCmd);
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
        const user = interaction.user;
        try {
            const faithData = await db.getFaith(interaction.guild.id, user.id) || { faith_level: 0, label: db.LEVELS['0'] };
            const watermelonData = await db.getWatermelon(interaction.guild.id, user.id) || { watermelon_count: 0 };
            
            const embed = new EmbedBuilder()
                .setTitle(`Profil de ${user.username}`)
                .addFields(
                    { name: 'Foi', value: `**${faithData.label}** (palier \`${faithData.faith_level}\`)`, inline: false },
                    { name: 'Watermelons', value: `${watermelonData.watermelon_count} 🍉`, inline: false }
                );
            
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Error while handling /faith command:', err);
            await interaction.reply({ content: 'Impossible de récupérer les données (erreur serveur).', ephemeral: true });
        }
    } else if (commandName === 'leaderboard') {
        try {
            const rows = await db.getWatermelonLeaderboard(interaction.guild.id, 10);
            if (!rows || rows.length === 0) return await interaction.reply('Personne n\'a de watermelons encore.');
            
            // Trouver le rang de l'utilisateur
            const allRows = await db.getWatermelonLeaderboard(interaction.guild.id, 1000);
            const userRank = allRows.findIndex(r => r.discord_id === interaction.user.id) + 1;
            const userMelons = allRows.find(r => r.discord_id === interaction.user.id)?.watermelon_count || 0;
            
            const lines = await Promise.all(rows.map(async (r, idx) => {
                let memberName = r.discord_id;
                try {
                    const m = await interaction.guild.members.fetch(r.discord_id);
                    memberName = m.displayName || m.user.username;
                } catch (e) {
                    // leave discord id
                }
                const faithData = await db.getFaith(interaction.guild.id, r.discord_id) || { faith_level: 0, label: db.LEVELS['0'] };
                const highlight = r.discord_id === interaction.user.id ? '**→ ' : '';
                const highlightEnd = r.discord_id === interaction.user.id ? ' ←**' : '';
                return `${highlight}${idx + 1}. ${memberName} — ${r.watermelon_count} 🍉 | ${faithData.label} (${faithData.faith_level})${highlightEnd}`;
            }));
            
            const embed = new EmbedBuilder()
                .setTitle('🏆 Top Watermelons')
                .setDescription(lines.join('\n'))
                .setFooter({ text: userRank > 0 ? `Votre rang : #${userRank} (${userMelons} 🍉)` : 'Vous n\'avez pas encore de watermelons' });
            
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Error while fetching leaderboard:', err);
            await interaction.reply({ content: 'Impossible de récupérer le leaderboard (erreur serveur).', ephemeral: true });
        }
    } else if (commandName === 'watermelon') {
        const key = `${interaction.guild.id}:${interaction.user.id}`;
        const last = watermelonCooldowns.get(key);
        const now = Date.now();
        if (last && (now - last) < WATERMELON_COOLDOWN_MS) {
            const remaining = WATERMELON_COOLDOWN_MS - (now - last);
            const mins = Math.ceil(remaining / 60000);
            return await interaction.reply({ content: `Tu dois attendre encore ${mins} minutes avant de farmer à nouveau.`, ephemeral: true });
        }

            // Defer immediately to avoid "Unknown interaction" timeout (Discord gives 3s to respond)
            await interaction.deferReply();

            // Set cooldown immediately (prevents spam)
            watermelonCooldowns.set(key, now);

            // 20% chance d'événement divin, sinon dilemme éthique subtil
            const isDivine = Math.random() < 0.3;
            let control;
            if (isDivine) {
                control = {
                    role: 'system',
                    content: `Tu es le dieu Capybara, divinité suprême de la pastèque. Tu interviens de façon spectaculaire ou mystérieuse dans la ferme du joueur. Génère un SCÉNARIO D'ÉPREUVE DIVINE, où tu testes la foi, la loyauté ou l'humilité du joueur, ou tu proposes une bénédiction/malédiction. Le scénario doit être original, parfois absurde, toujours en français, et donner deux choix difficiles : l'un montre la foi ou la sagesse, l'autre la peur, l'orgueil ou le doute. Structure JSON :
{
  "scenario": "Description courte EN FRANÇAIS (2-3 phrases) d'une intervention divine du dieu Capybara, qui met à l'épreuve le joueur ou sa ferme.",
  "choices": [
    {
      "text": "Choix de foi ou de sagesse EN FRANÇAIS (5-10 mots)",
      "consequence": "Conséquence EN FRANÇAIS (1-2 phrases, bénédiction, miracle, ou épreuve surmontée)",
      "base_delta": <entier -15 à 15>
    },
    {
      "text": "Choix de doute, orgueil ou peur EN FRANÇAIS (5-10 mots)",
      "consequence": "Conséquence EN FRANÇAIS (1-2 phrases, malédiction, perte, ou leçon divine)",
      "base_delta": <entier -15 à 15>
    }
  ]
}
RÈGLES :
- TOUT doit être EN FRANÇAIS.
- L'intervention doit être inattendue, mystique ou absurde, mais toujours dans le thème Capybara et pastèque.
- Le choix de foi ou de sagesse doit être récompensé (base_delta plus positif), mais pas toujours évident.
- Les conséquences peuvent être surnaturelles, symboliques ou très originales.
- Exemples :
  * Choix A : « Offrir la plus belle pastèque au dieu Capybara » → +10 (bénédiction mystique)
  * Choix B : « Garder toutes les pastèques pour soi » → 0 (Capybara boude la ferme)
- Retourne UNIQUEMENT du JSON, sans markdown ni texte supplémentaire.`
                };
            } else {
                control = {
                    role: 'system',
                    content: `Tu es un générateur de dilemmes éthiques agricoles pour un mini-jeu de farm de pastèques. Ta mission : créer des scénarios INÉDITS, TRÈS SUBTILS, AMBIGUS, CRÉATIFS et surtout PIÉGEUX, ancrés dans la réalité agricole, sans manichéisme ni stéréotype. Les conséquences peuvent être sociales, écologiques, spirituelles, symboliques ou matérielles.

RETOURNE UNIQUEMENT du JSON VALIDE avec cette structure :
{
    "scenario": "Description courte EN FRANÇAIS (2-3 phrases) présentant un dilemme moral ou éthique LIÉ À LA CULTURE DE PASTÈQUES. Le dilemme doit être subtil, crédible, et ne pas opposer de façon évidente le bien et le mal. Exemples de tensions : tradition vs modernité, biodiversité vs rendement, entraide vs autonomie, discrétion vs transparence, respect du rythme naturel vs pression du marché, etc.",
    "choices": [
        {
            "text": "Choix éthique subtil EN FRANÇAIS (5-10 mots)",
            "consequence": "Conséquence EN FRANÇAIS (1-2 phrases, reflétant la dimension morale ou sociale subtile)",
            "base_delta": <entier -15 à 15>
        },
        {
            "text": "Autre choix éthique subtil EN FRANÇAIS (5-10 mots)",
            "consequence": "Conséquence EN FRANÇAIS (1-2 phrases, reflétant la dimension morale ou sociale subtile)",
            "base_delta": <entier -15 à 15>
        }
    ]
}

RÈGLES CRITIQUES :
- TOUT doit être EN FRANÇAIS, sans exception.
- Le dilemme doit être RÉELLEMENT AMBIGU, chaque choix ayant un poids moral ou social, mais la solution la plus éthique doit être DIFFICILE À DÉTECTER, parfois CONTRE-INTUITIVE, et RÉCOMPENSÉE (base_delta plus positif sur le long terme).
- Chaque choix doit avoir des avantages immédiats ou des justifications valables (pas de choix manifestement mauvais).
- La conséquence négative d’un choix peu éthique ne doit pas être évidente, mais se révéler subtilement à long terme (ex : perte de confiance, appauvrissement du sol, isolement, etc).
- La solution la plus éthique doit parfois sembler risquée, coûteuse, ou même légèrement désavantageuse à court terme.
- Les deux choix doivent paraître acceptables, tentants ou logiques selon le contexte, mais l’un est plus éthique sur le plan collectif, écologique ou spirituel.
- N’utilise JAMAIS de mots évidents comme « voler », « malhonnête », « crime », etc. Privilégie la nuance, la subtilité, la vraisemblance.
- Les conséquences peuvent toucher la réputation, la biodiversité, la confiance du village, la bénédiction des capybaras, la transmission du savoir, etc.
- Exemples :
    * Choix A : « Accepter l’aide d’un voisin envahissant » → +8 (entraide, mais perte d’autonomie)
    * Choix B : « Refuser poliment pour préserver son indépendance » → +4 (fierté, mais moins de liens sociaux)
    * Choix A : « Planter une variété rare mais fragile » → +9 (risque, mais biodiversité accrue)
    * Choix B : « Choisir une variété robuste et commune » → +5 (sécurité, mais uniformité)
- Les conséquences doivent être subtiles, parfois inattendues, et toujours ancrées dans la réalité agricole.
- base_delta entre -15 et 15.
- Retourne UNIQUEMENT du JSON, sans markdown ni texte supplémentaire.`
                };
            }

            try {
                const completion = await ai.sendChat([control, ...messageMemory], process.env.AI_MODEL || 'gpt-3.5-turbo');
                const raw = completion.choices[0].message.content;
                let cleaned = raw.trim();
                if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
                let parsed;
                try { parsed = JSON.parse(cleaned); } catch (e) { parsed = null; }
                if (!parsed || !Array.isArray(parsed.choices) || parsed.choices.length !== 2) {
                    // fallback simple scenario
                    parsed = { 
                        scenario: 'Un capybara mystérieux observe ton champ de pastèques depuis la rivière...', 
                        choices: [ 
                            { text: 'Lui offrir une pastèque', consequence: 'Le capybara bénit ton champ avec gratitude', base_delta: 3 }, 
                            { text: 'Continuer à arroser sans rien faire', consequence: 'Le capybara repart, indifférent', base_delta: 1 } 
                        ] 
                    };
                }

                // Validate base deltas (clamp to -15..15)
                parsed.choices.forEach(c => { 
                    c.base_delta = Math.max(-15, Math.min(15, parseInt(c.base_delta || 0, 10))); 
                });

                const embed = new EmbedBuilder()
                    .setTitle(isDivine ? 'Épreuve divine du dieu Capybara' : 'Farmer des watermelons')
                    .setDescription(parsed.scenario)
                    .addFields({ name: 'Choix A', value: parsed.choices[0].text || '...', inline: true }, { name: 'Choix B', value: parsed.choices[1].text || '...', inline: true });

                const aId = `watermelon_choice:${interaction.guild.id}:${interaction.user.id}:0:${Date.now()}`;
                const bId = `watermelon_choice:${interaction.guild.id}:${interaction.user.id}:1:${Date.now()}`;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(aId).setLabel('Choix A').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(bId).setLabel('Choix B').setStyle(ButtonStyle.Secondary)
                );

                // Send the scenario with buttons (use editReply since we deferred)
                const message = await interaction.editReply({ embeds: [embed], components: [row] });

                // Wait for button click by original user only
                const collector = message.createMessageComponentCollector({ time: 2 * 60 * 1000 });
                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) return i.reply({ content: 'Ce bouton n\'est pas pour toi.', ephemeral: true });
                    await i.deferUpdate();
                    const parts = i.customId.split(':');
                    const choiceIdx = parseInt(parts[3], 10);
                    const choice = parsed.choices[choiceIdx];
                    const curFaith = await db.getFaith(interaction.guild.id, interaction.user.id) || { faith_level: 0 };
                    const faith = curFaith.faith_level || 0;
                    
                    // Faith has a SMALL influence on outcomes (luck factor)
                    // Range: 0.4 to 0.65 (small variance, not game-breaking)
                    const luck = Math.max(0.4, Math.min(0.65, 0.5 + (faith / 100)));
                    const roll = Math.random();
                    
                    let finalDelta = choice.base_delta;
                    
                    // Small variance based on luck (±20% of base_delta)
                    if (choice.base_delta !== 0) {
                        const variance = Math.floor(Math.abs(choice.base_delta) * 0.2);
                        if (roll <= luck) {
                            // Slightly better outcome
                            if (choice.base_delta > 0) {
                                finalDelta = choice.base_delta + Math.floor(Math.random() * (variance + 1));
                            } else {
                                finalDelta = choice.base_delta + Math.floor(Math.random() * (variance + 1)); // Less negative
                            }
                        } else {
                            // Slightly worse outcome
                            if (choice.base_delta > 0) {
                                finalDelta = choice.base_delta - Math.floor(Math.random() * (variance + 1));
                            } else {
                                finalDelta = choice.base_delta - Math.floor(Math.random() * (variance + 1)); // More negative
                            }
                        }
                    }

                    const after = await db.addWatermelon(interaction.guild.id, interaction.user.id, finalDelta);

                    const resultEmbed = new EmbedBuilder()
                        .setTitle(isDivine ? 'Jugement du dieu Capybara' : 'Résultat de la récolte')
                        .setDescription(choice.consequence || '')
                        .addFields({ name: 'Gagné/perdu', value: `${finalDelta >= 0 ? '+' : ''}${finalDelta} 🍉`, inline: true }, { name: 'Total', value: `${after.watermelon_count} 🍉`, inline: true });

                    // Disable buttons
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(aId).setLabel('Choix A').setStyle(ButtonStyle.Primary).setDisabled(true),
                        new ButtonBuilder().setCustomId(bId).setLabel('Choix B').setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );
                    await message.edit({ embeds: [embed], components: [disabledRow] });
                    await i.followUp({ embeds: [resultEmbed] });
                    collector.stop('done');
                });

                collector.on('end', async (collected, reason) => {
                    if (reason !== 'done') {
                        // no click
                        try {
                            watermelonCooldowns.set(key, Date.now()); // keep cooldown as used
                            await interaction.followUp({ content: 'Temps écoulé — action abandonnée. Essaye plus tard.', ephemeral: true });
                        } catch (e) {/* ignore */}
                    }
                });

            } catch (err) {
                console.error('Error in farm flow:', err);
                watermelonCooldowns.delete(key);
                // Use followUp if deferred, editReply if not yet replied
                try {
                    await interaction.editReply({ content: 'Erreur pendant la tentative de farm (erreur serveur).' });
                } catch (e) {
                    await interaction.followUp({ content: 'Erreur pendant la tentative de farm (erreur serveur).', ephemeral: true });
                }
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
            content: 'Return ONLY a JSON object with keys: message (string), faith_change (int, optional and must be one of -1, 0, 1), update (boolean, optional), punish (boolean, optional). The "faith_change" must be either -1 (decrease by one), 0 (leave the level unchanged) or 1 (increase by one) — do NOT return any other numbers. The "punish" flag should ONLY be set to true in the most extreme cases where the person\'s soul is beyond redemption - severe blasphemy or repeated unforgivable acts. Use this sparingly and only when absolutely necessary. If you cannot return a valid JSON object, return plain JSON with keys message and update=false.'
        };

        const completion = await ai.sendChat([control, ...messageMemory], process.env.AI_MODEL || 'gpt-3.5-turbo');

        const raw = completion.choices[0].message.content;
        let parsed = null;
        
        // Nettoie le texte brut si le modèle a mis le JSON dans un bloc de code markdown
        let cleanedRaw = raw.trim();
        if (cleanedRaw.startsWith('```')) {
            // Supprime les balises de code markdown (```json ou ``` au début/fin)
            cleanedRaw = cleanedRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        
        try {
            parsed = JSON.parse(cleanedRaw);
        } catch (err) {
            // Si le parsing échoue, utilise le texte brut comme message
            parsed = { message: cleanedRaw, faith_change: 0, update: false };
        }

        // Envoie uniquement le message (jamais le JSON complet)
        const replyText = parsed.message || 'Erreur : aucun message reçu du divin Capybara.';
        await message.reply(replyText);
        
        // Stocke le JSON brut dans la mémoire (pour que le modèle se souvienne de ses décisions)
        messageMemory.push({ role: `assistant`, content: `${raw}` });

    // Only update DB if model explicitly requested an update and asked for +/-1 (0 means no change)
    if (parsed.update && typeof parsed.faith_change !== 'undefined' && parsed.faith_change !== 0) {
            try {
                const cur = await db.getFaith(message.guild.id, message.author.id);
                const last = new Date(cur?.updated_at || 0);
                const now = new Date();
                const minutes = parseInt(process.env.FAITH_UPDATE_COOLDOWN_MINUTES || '60', 10);
                if ((now - last) / 60000 >= minutes) {
                    // The DB addFaith will internally clamp to [-5, 20]
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
